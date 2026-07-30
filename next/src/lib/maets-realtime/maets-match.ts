"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
	applyEntry,
	type ControlEvent,
	classifyEntry,
	initialMeta,
	type LogEntry,
	type MaetsMessage,
	MaetsMessageSchema,
	type MaetsPresence,
	MaetsPresenceSchema,
	type MatchState,
	matchChannelName,
	PROTOCOL_VERSION,
	type RejectReason,
	SUBMIT_TIMEOUT_MS,
} from "./protocol";
import type { Game, GameRegistry, GameResult, Seat } from "./types";

type Role = "player" | "spectator";
type MatchEvent =
	| "state"
	| "phase"
	| "roster"
	| "game"
	| "rejected"
	| "over"
	| "stage"
	| "log";

/**
 * Where `join()` currently is in the connect sequence (README §12.2).
 * Observational only — nothing in the protocol branches on it; it exists so a
 * UI can narrate the handshake instead of showing one undifferentiated
 * "connecting".
 *
 * There is deliberately no terminal "failed" stage: a failure leaves the stage
 * on whichever step broke, so a caller can pair it with the rejected promise to
 * report *where* the join died.
 */
export type ConnectionStage =
	| "idle"
	| "subscribing"
	| "announcing"
	| "handshaking"
	| "creating"
	| "syncing"
	| "ready";

/**
 * One thing this replica observed, for the dev inspector. Nothing in the
 * protocol reads it.
 *
 * Two kinds share one timeline on purpose: a log of messages alone can't
 * explain a *silence*. Five `hello`s going out with nothing coming back only
 * reads as "no host answered" once the timeout notes sit between them.
 */
export type LogRow = { id: number; at: number } & (
	| {
			kind: "message";
			/** "out" = we put it on the wire · "in" = arrived from a peer ·
			 *  "local" = never hit the wire (host handling its own submit). */
			dir: "in" | "out" | "local";
			msg: MaetsMessage;
			/** Inbound, but `to` names another peer — `handleMessage` drops it. */
			ignored?: boolean;
	  }
	| { kind: "invalid"; raw: unknown; error: string }
	| { kind: "note"; level: "info" | "warn" | "error"; text: string }
);

/** Combined cap: holds roughly 25 envelopes plus the notes interleaved between
 * them. Rows hold parsed messages by reference rather than clones — safe
 * because the protocol reducers (`applyEntry`) are pure. */
export const LOG_LIMIT = 50;

// Plain `Omit` collapses a discriminated union's keys down to their
// intersection, losing per-variant fields — this preserves the union.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
	? Omit<T, K>
	: never;
type OutboundMessage = DistributiveOmit<
	MaetsMessage,
	"v" | "match" | "mid" | "from" | "ts"
>;

// Not specified by the README's constants table (§24) — implementation choices
// for how long/how many times to wait for a sequencer to answer `hello`.
const HELLO_TIMEOUT_MS = 3000;
export const HELLO_MAX_ATTEMPTS = 5;
const RESYNC_DEBOUNCE_MS = 500;

/**
 * The Maets protocol runtime (README §22). One instance owns one Supabase
 * Realtime channel for one match: sequencer duties (§9.1), player duties
 * (§9.2), presence-driven pause/resume (§12.5) and election/migration
 * (§9.3, §12.6), and multi-game room sessions (§12.7).
 *
 * Out of scope for this implementation (see the maets-realtime README's
 * explicitly-optional/future sections): the hidden-information reveal
 * handshake (§14), Postgres persistence (§18), anti-cheat (§23).
 */
export class MaetsMatch {
	private readonly supabase = createClient();
	private readonly code: string;
	private readonly playerId: string;
	private readonly name: string;
	private readonly games: GameRegistry;
	private readonly want: Role;
	private readonly joinedAt = Date.now();

	private channel: RealtimeChannel | null = null;
	private matchState: MatchState = {
		meta: initialMeta(0),
		game: undefined,
		lastSeq: -1,
	};
	private connectedPlayerIds = new Set<string>();
	private buffered = new Map<number, LogEntry>();
	private seenActionIds = new Set<string>();
	private pendingSubmits = new Map<
		string,
		{ action: unknown; timer: ReturnType<typeof setTimeout> }
	>();
	private snapshotWaiters: Array<(got: boolean) => void> = [];
	private lastResyncAt = 0;
	private lastSeatOrder: Seat[] | null = null;
	// React Strict Mode double-invokes effects in dev: mount, cleanup, mount
	// again. Without this, `leave()` on the abandoned first instance wouldn't
	// stop its in-flight `handshake()` (which can run for up to
	// HELLO_MAX_ATTEMPTS × HELLO_TIMEOUT_MS), so it keeps sending `hello` and
	// tracking presence under the same playerId as the second, real instance —
	// they race on the same channel and neither gets a clean answer.
	private destroyed = false;

	private _seat: Seat | null = null;
	private _role: Role = "spectator";
	private _stage: ConnectionStage = "idle";
	private _helloAttempt = 0;
	private _log: readonly LogRow[] = [];
	private _logSeq = 0;
	private _channelStatus: string | null = null;
	private lastRejection: {
		actionId: string;
		reason: RejectReason;
		message?: string;
	} | null = null;

	private readonly listeners = new Map<MatchEvent, Set<() => void>>();

	constructor(opts: {
		code: string;
		playerId: string;
		name: string;
		games: GameRegistry;
		want?: Role;
	}) {
		this.code = opts.code;
		this.playerId = opts.playerId;
		this.name = opts.name;
		this.games = opts.games;
		this.want = opts.want ?? "player";
	}

	// ─── Public API (README §22) ────────────────────────────────────────

	get seat() {
		return this._seat;
	}

	get stage() {
		return this._stage;
	}

	/** 1-based `hello` attempt currently outstanding; 0 before the first is
	 * sent. Meaningful while `stage === "handshaking"`. */
	get helloAttempt() {
		return this._helloAttempt;
	}

	get isHost() {
		return (
			this._role === "player" &&
			this._seat === this.matchState.meta.sequencerSeat
		);
	}

	get phase() {
		return this.matchState.meta.phase;
	}

	get activeGameId() {
		return this.matchState.meta.activeGameId;
	}

	get hostSeat() {
		return this.matchState.meta.sequencerSeat;
	}

	/** PUBLIC state of the active session. Narrow by `activeGameId`. */
	get state(): unknown {
		return this.matchState.game;
	}

	get rejection() {
		return this.lastRejection;
	}

	/** Log-derived identity per seat, live-overlaid with presence — the log
	 * itself never records connect/disconnect (§6.3: presence is the only
	 * liveness source). */
	get roster(): Record<
		number,
		{ playerId: string; name: string; connected: boolean }
	> {
		const out: Record<
			number,
			{ playerId: string; name: string; connected: boolean }
		> = {};
		for (const [seatStr, entry] of Object.entries(
			this.matchState.meta.roster,
		)) {
			out[Number(seatStr)] = {
				...entry,
				connected: this.connectedPlayerIds.has(entry.playerId),
			};
		}
		return out;
	}

	/** Connected participants present on the channel who hold no seat. */
	get spectatorCount(): number {
		const seatedPlayerIds = new Set(
			Object.values(this.matchState.meta.roster).map((r) => r.playerId),
		);
		let count = 0;
		for (const id of this.connectedPlayerIds) {
			if (!seatedPlayerIds.has(id)) count++;
		}
		return count;
	}

	// ─── Observational (README §12.2, same spirit as `stage`) ───────────
	// Nothing in the protocol branches on these; they exist so the dev
	// inspector can show what the replica is actually holding. Array-valued
	// ones return fresh copies — callers must not mutate internals.

	get role(): Role {
		return this._role;
	}

	get lastSeq(): number {
		return this.matchState.lastSeq;
	}

	get sessionId(): string | null {
		return this.matchState.meta.sessionId;
	}

	/** Whoever presence says is on the channel, seated or not. */
	get connectedIds(): string[] {
		return [...this.connectedPlayerIds].sort();
	}

	/** Submits broadcast but not yet acknowledged by an `event` or `reject`. */
	get pendingActionIds(): string[] {
		return [...this.pendingSubmits.keys()];
	}

	/** Entries held back by a gap — non-empty means we're missing a seq. */
	get bufferedSeqs(): number[] {
		return [...this.buffered.keys()].sort((a, b) => a - b);
	}

	/** The last status Supabase reported for the channel subscription. */
	get channelStatus(): string | null {
		return this._channelStatus;
	}

	/** Bounded ring of observed traffic and diagnostics. Identity is stable
	 * between `record` calls, so consumers can diff by reference. */
	get log(): readonly LogRow[] {
		return this._log;
	}

	clearLog() {
		this._log = [];
		this.emit("log");
	}

	on(event: MatchEvent, cb: () => void) {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)?.add(cb);
		return () => {
			this.listeners.get(event)?.delete(cb);
		};
	}

	async join(): Promise<void> {
		this.setStage("subscribing");
		const channel = this.supabase.realtime.channel(
			matchChannelName(this.code),
			{
				config: {
					broadcast: { self: false },
					presence: { key: this.playerId },
				},
			},
		);
		this.channel = channel;

		channel.on("broadcast", { event: "m" }, ({ payload }) => {
			const parsed = MaetsMessageSchema.safeParse(payload);
			if (!parsed.success) {
				// Otherwise a silent drop: a peer on a different protocol
				// version would look like an unexplained stall.
				this.record({
					kind: "invalid",
					raw: payload,
					error: parsed.error.issues
						.map(
							(issue) =>
								`${issue.path.join(".") || "(root)"}: ${issue.message}`,
						)
						.join("; "),
				});
				return;
			}
			// The `to` test mirrors `handleMessage`'s drop guard rather than
			// moving it: the tap has to be a pure observer that can't change
			// routing. Keep the two in sync.
			const { to } = parsed.data;
			this.record({
				kind: "message",
				dir: "in",
				msg: parsed.data,
				ignored: !!to && to !== this.playerId,
			});
			this.handleMessage(parsed.data);
		});

		channel
			.on("presence", { event: "sync" }, () => this.handlePresenceSync())
			.on("presence", { event: "join" }, () => this.handlePresenceSync())
			.on("presence", { event: "leave" }, () =>
				this.handlePresenceSync(),
			);

		await new Promise<void>((resolve, reject) => {
			channel.subscribe((status) => {
				this._channelStatus = status;
				if (status === "SUBSCRIBED") {
					this.setStage("announcing");
					this.track("pending", null);
					resolve();
				} else if (
					status === "CHANNEL_ERROR" ||
					status === "TIMED_OUT"
				) {
					this.note("error", `channel subscribe failed: ${status}`);
					reject(new Error(status));
				}
			});
		});
		if (this.destroyed) return;

		await this.handshake();
		if (this.destroyed) return;
		this.setStage("ready");
	}

	/** Host-only. Same id again = rematch; a different id = switch games. */
	selectGame(gameId: string) {
		if (!this.isHost) return;
		const plugin = this.games[gameId];
		if (!plugin) return;

		const seats = Object.keys(this.matchState.meta.roster)
			.map(Number)
			.sort((a, b) => a - b);
		if (seats.length < plugin.seats.min) return;

		const seatOrder =
			this.lastSeatOrder && this.lastSeatOrder.length === seats.length
				? [...this.lastSeatOrder.slice(1), this.lastSeatOrder[0]]
				: seats;
		this.lastSeatOrder = seatOrder;

		this.appendAndBroadcast({
			c: "game-selected",
			sessionId: crypto.randomUUID(),
			gameId,
			version: plugin.version,
			seatOrder,
		});
	}

	/** Validated against the active game's actionSchema; returns the actionId. */
	submit(action: unknown): string {
		const actionId = crypto.randomUUID();
		if (this.isHost) {
			// The sequencer is its own authority (§9.1), so this never reaches
			// `broadcast` — logged anyway, or the host's own moves would appear
			// in the log as `event`s caused by nothing.
			this.record({
				kind: "message",
				dir: "local",
				msg: this.envelope({ t: "submit", actionId, action }),
			});
			this.handleSubmitAsSequencer({
				actionId,
				action,
				from: this.playerId,
			});
		} else {
			this.pendingSubmits.set(actionId, {
				action,
				timer: this.scheduleRetryTimer(actionId, action),
			});
			this.broadcast({ t: "submit", actionId, action });
		}
		return actionId;
	}

	async leave() {
		this.note("info", "leaving channel");
		this.destroyed = true;
		// unblock an in-flight handshake immediately instead of letting it run
		// out its remaining wait before noticing `destroyed`
		for (const wait of this.snapshotWaiters.splice(0)) wait(false);
		for (const { timer } of this.pendingSubmits.values())
			clearTimeout(timer);
		this.pendingSubmits.clear();
		await this.channel?.unsubscribe();
		this.channel = null;
	}

	// ─── Handshake (README §12.2) ───────────────────────────────────────

	private async handshake() {
		for (let attempt = 0; attempt < HELLO_MAX_ATTEMPTS; attempt++) {
			if (this.destroyed) return;
			this._helloAttempt = attempt + 1;
			// re-announced every attempt: the attempt counter is part of what
			// observers render, so a retry is a stage change even though the
			// stage name itself doesn't move off "handshaking"
			this.setStage("handshaking");
			this.sendHello();
			const gotSnapshot = await this.waitForSnapshot(HELLO_TIMEOUT_MS);
			if (this.destroyed) return;
			if (gotSnapshot) return;

			const others = [...this.connectedPlayerIds].filter(
				(id) => id !== this.playerId,
			);
			// The peer count is the diagnostic that splits the two failures
			// apart: nobody there (we should create) vs. somebody there who
			// isn't answering (the confusing one).
			this.note(
				"warn",
				`no snapshot within ${HELLO_TIMEOUT_MS}ms (hello ${attempt + 1}/${HELLO_MAX_ATTEMPTS}); ${others.length} other peer${others.length === 1 ? "" : "s"} present`,
			);
			if (others.length === 0) {
				this.becomeCreator();
				return;
			}
		}
		this.note(
			"error",
			`no host answered in time — gave up after ${HELLO_MAX_ATTEMPTS} hello attempts`,
		);
		throw new Error(
			"maets: timed out waiting for a sequencer to answer hello",
		);
	}

	private sendHello() {
		this.broadcast({
			t: "hello",
			playerId: this.playerId,
			name: this.name,
			want: this.want,
			games: Object.entries(this.games).map(([id, g]) => ({
				id,
				version: g.version,
			})),
		});
	}

	private waitForSnapshot(timeoutMs: number): Promise<boolean> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(false), timeoutMs);
			this.snapshotWaiters.push((got) => {
				clearTimeout(timer);
				resolve(got);
			});
		});
	}

	private becomeCreator() {
		this.note(
			"info",
			"no other peers on channel — creating the match as seat 0",
		);
		this.setStage("creating");
		this._seat = 0;
		this._role = "player";
		this.matchState = {
			meta: initialMeta(0),
			game: undefined,
			lastSeq: -1,
		};
		this.track("player", 0);
		this.appendAndBroadcast({
			c: "seat-claimed",
			seat: 0,
			playerId: this.playerId,
			name: this.name,
		});
	}

	private track(role: Role | "pending", seat: Seat | null) {
		const presence: MaetsPresence = {
			playerId: this.playerId,
			role,
			seat,
			name: this.name,
			v: PROTOCOL_VERSION,
		};
		// `username`/`joinedAt` aren't part of MaetsPresence (README §6.3) — they're
		// included so useLobby's occupancy probe (join/page.tsx) still recognizes
		// this presence on a channel a MaetsMatch, not a useLobby, is hosting.
		this.channel?.track({
			...presence,
			username: this.name,
			joinedAt: this.joinedAt,
		});
	}

	// ─── Sequencer duties (README §9.1) ─────────────────────────────────

	private handleHello(msg: Extract<MaetsMessage, { t: "hello" }>) {
		if (!this.isHost) return;

		const existing = Object.entries(this.matchState.meta.roster).find(
			([, r]) => r.playerId === msg.playerId,
		);
		if (existing) {
			this.sendSnapshotTo(msg.playerId, Number(existing[0]), "player");
			return;
		}

		const seatCount = Object.keys(this.matchState.meta.roster).length;
		if (msg.want === "player" && seatCount < this.maxSeats) {
			const seat = seatCount;
			this.appendAndBroadcast({
				c: "seat-claimed",
				seat,
				playerId: msg.playerId,
				name: msg.name,
			});
			this.sendSnapshotTo(msg.playerId, seat, "player");
		} else {
			this.sendSnapshotTo(msg.playerId, null, "spectator");
		}
	}

	private get maxSeats(): number {
		const maxes = Object.values(this.games).map((g) => g.seats.max);
		return maxes.length ? Math.max(...maxes) : 0;
	}

	private handleSubmitMsg(msg: Extract<MaetsMessage, { t: "submit" }>) {
		if (!this.isHost) return;
		this.handleSubmitAsSequencer({
			actionId: msg.actionId,
			action: msg.action,
			from: msg.from,
		});
	}

	private handleSubmitAsSequencer({
		actionId,
		action,
		from,
	}: {
		actionId: string;
		action: unknown;
		from: string;
	}) {
		if (this.seenActionIds.has(actionId)) return; // idempotent replay (§11)

		const existing = Object.entries(this.matchState.meta.roster).find(
			([, r]) => r.playerId === from,
		);
		if (!existing) {
			this.sendReject(from, actionId, "unknown-seat");
			return;
		}
		const by = Number(existing[0]);

		const plugin = this.activeGameId
			? this.games[this.activeGameId]
			: undefined;
		if (!plugin || this.matchState.meta.phase !== "active") {
			this.sendReject(from, actionId, "match-not-active");
			return;
		}

		if (!plugin.activeSeats(this.matchState.game).includes(by)) {
			this.sendReject(from, actionId, "not-your-turn");
			return;
		}

		const parsed = plugin.actionSchema.safeParse(action);
		if (!parsed.success) {
			this.sendReject(from, actionId, "illegal-move");
			return;
		}

		const legal = plugin.isLegal(this.matchState.game, parsed.data, by);
		if (legal !== true) {
			this.sendReject(from, actionId, "illegal-move", legal.reason);
			return;
		}

		this.seenActionIds.add(actionId);
		const entry: LogEntry = {
			seq: this.matchState.lastSeq + 1,
			actionId,
			ts: Date.now(),
			by,
			kind: "move",
			action: parsed.data,
		};
		this.applyLocalEntry(entry);
		this.broadcast({ t: "event", entry });
		this.checkGameOver(plugin);
	}

	private checkGameOver(plugin: Game<unknown, unknown>) {
		if (!this.isHost) return;
		const result: GameResult | null = plugin.isOver(this.matchState.game);
		if (result) this.appendAndBroadcast({ c: "game-over", result });
	}

	private sendReject(
		to: string,
		actionId: string,
		reason: RejectReason,
		message?: string,
	) {
		this.broadcast({ t: "reject", to, actionId, reason, message });
	}

	private sendSnapshotTo(to: string, seat: Seat | null, role: Role) {
		this.broadcast({
			t: "snapshot",
			to,
			snapshot: {
				meta: this.matchState.meta,
				game: this.matchState.game,
				lastSeq: this.matchState.lastSeq,
			},
			yourSeat: seat,
			yourRole: role,
		});
	}

	private handleResyncMsg(msg: Extract<MaetsMessage, { t: "resync" }>) {
		if (!this.isHost) return;
		const existing = Object.entries(this.matchState.meta.roster).find(
			([, r]) => r.playerId === msg.from,
		);
		const seat = existing ? Number(existing[0]) : null;
		this.sendSnapshotTo(
			msg.from,
			seat,
			seat !== null ? "player" : "spectator",
		);
	}

	// ─── Player duties (README §9.2, §11) ───────────────────────────────

	private handleSnapshotMsg(msg: Extract<MaetsMessage, { t: "snapshot" }>) {
		// Snapshots also answer mid-game `resync` requests (§11); once joined,
		// applying one is not a re-join, so the stage must stay "ready" rather
		// than throwing the UI back to its connecting view.
		if (this._stage !== "ready") this.setStage("syncing");
		this.matchState = {
			meta: msg.snapshot.meta,
			game: msg.snapshot.game,
			lastSeq: msg.snapshot.lastSeq,
		};
		this._seat = msg.yourSeat;
		this._role = msg.yourRole;
		this.track(this._role, this._seat);
		// Anything buffered at or below the snapshot's seq is superseded; anything
		// above it (raced ahead of this snapshot) may now be exactly next.
		for (const seq of this.buffered.keys()) {
			if (seq <= this.matchState.lastSeq) this.buffered.delete(seq);
		}
		this.emitAll();
		for (const wait of this.snapshotWaiters.splice(0)) wait(true);
		this.resubmitAllPending();
		this.drainBuffered();
	}

	private handleEventMsg(entry: LogEntry) {
		const outcome = classifyEntry(this.matchState.lastSeq, entry.seq);
		if (outcome === "duplicate") return;
		if (outcome === "gap") {
			this.buffered.set(entry.seq, entry);
			this.requestResync();
			return;
		}
		this.applyLocalEntry(entry);
		this.resolvePendingSubmit(entry.actionId);
		this.drainBuffered();
	}

	private drainBuffered() {
		let next = this.buffered.get(this.matchState.lastSeq + 1);
		while (next) {
			this.buffered.delete(next.seq);
			this.applyLocalEntry(next);
			next = this.buffered.get(this.matchState.lastSeq + 1);
		}
	}

	private requestResync() {
		// No known sequencer yet (still handshaking) — nothing to target, and a
		// snapshot from the handshake itself is already in flight.
		const sequencer =
			this.matchState.meta.roster[this.matchState.meta.sequencerSeat];
		if (!sequencer) return;

		const now = Date.now();
		if (now - this.lastResyncAt < RESYNC_DEBOUNCE_MS) return;
		this.lastResyncAt = now;
		this.note(
			"warn",
			`gap after seq ${this.matchState.lastSeq} — requesting resync`,
		);
		this.broadcast({
			t: "resync",
			to: sequencer.playerId,
			haveSeq: this.matchState.lastSeq,
		});
	}

	private handleRejectMsg(msg: Extract<MaetsMessage, { t: "reject" }>) {
		this.note(
			"warn",
			`rejected ${msg.actionId.slice(0, 8)}: ${msg.reason}${msg.message ? ` — ${msg.message}` : ""}`,
		);
		this.resolvePendingSubmit(msg.actionId);
		this.lastRejection = {
			actionId: msg.actionId,
			reason: msg.reason,
			message: msg.message,
		};
		this.emit("rejected");
	}

	private scheduleRetryTimer(actionId: string, action: unknown) {
		return setTimeout(() => {
			const pending = this.pendingSubmits.get(actionId);
			if (!pending) return;
			this.note(
				"warn",
				`submit ${actionId.slice(0, 8)} unacked after ${SUBMIT_TIMEOUT_MS}ms — resending`,
			);
			this.broadcast({ t: "submit", actionId, action });
			pending.timer = this.scheduleRetryTimer(actionId, action);
		}, SUBMIT_TIMEOUT_MS);
	}

	private resolvePendingSubmit(actionId: string) {
		const pending = this.pendingSubmits.get(actionId);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pendingSubmits.delete(actionId);
	}

	private resubmitAllPending() {
		if (this.isHost) return;
		for (const [actionId, { action }] of this.pendingSubmits) {
			this.broadcast({ t: "submit", actionId, action });
		}
	}

	// ─── Presence: pause/resume (§12.5) & election/migration (§9.3, §12.6) ──

	private handlePresenceSync() {
		if (this.destroyed) return;
		const present = new Set<string>();
		for (const entries of Object.values(
			this.channel?.presenceState() ?? {},
		)) {
			for (const raw of entries) {
				const parsed = MaetsPresenceSchema.safeParse(raw);
				if (parsed.success) present.add(parsed.data.playerId);
			}
		}
		// Only note real membership changes — presence sync fires far more
		// often than it changes, and a log full of identical rows hides the
		// one row that matters.
		const joined = [...present].filter(
			(id) => !this.connectedPlayerIds.has(id),
		);
		const left = [...this.connectedPlayerIds].filter(
			(id) => !present.has(id),
		);
		if (joined.length || left.length) {
			const delta = [
				...joined.map((id) => `+${id.slice(0, 8)}`),
				...left.map((id) => `-${id.slice(0, 8)}`),
			].join(" ");
			this.note("info", `presence: ${present.size} connected (${delta})`);
		}
		this.connectedPlayerIds = present;
		this.emit("roster");

		this.checkElection();
		if (this.isHost) this.checkPauseResume();
	}

	private checkElection() {
		const sequencerEntry =
			this.matchState.meta.roster[this.matchState.meta.sequencerSeat];
		if (!sequencerEntry) return; // no sequencer claimed yet (still in handshake)
		if (this.connectedPlayerIds.has(sequencerEntry.playerId)) return; // sequencer alive

		const candidateSeats = Object.entries(this.matchState.meta.roster)
			.filter(([, r]) => this.connectedPlayerIds.has(r.playerId))
			.map(([seatStr]) => Number(seatStr))
			.sort((a, b) => a - b);

		const newSeat = candidateSeats[0];
		if (newSeat === undefined || newSeat !== this._seat) return; // not me — wait for the winner's broadcast
		if (this.matchState.meta.sequencerSeat === newSeat) return; // already elected

		this.appendAndBroadcast({
			c: "sequencer-changed",
			seat: newSeat,
			playerId: this.playerId,
		});
		this.resubmitAllPending();
		this.checkPauseResume();
	}

	private checkPauseResume() {
		if (!this.isHost) return;
		const plugin = this.activeGameId
			? this.games[this.activeGameId]
			: undefined;
		if (!plugin) return;

		const blockingSeats = plugin.activeSeats(this.matchState.game);
		const disconnectedBlocking = blockingSeats.filter((seat) => {
			const entry = this.matchState.meta.roster[seat];
			return !entry || !this.connectedPlayerIds.has(entry.playerId);
		});
		const connectedCount = Object.values(
			this.matchState.meta.roster,
		).filter((r) => this.connectedPlayerIds.has(r.playerId)).length;
		const belowMin = connectedCount < plugin.seats.min;

		if (
			this.matchState.meta.phase === "active" &&
			(disconnectedBlocking.length > 0 || belowMin)
		) {
			this.appendAndBroadcast({
				c: "paused",
				reason: "disconnect",
				waitingOn: disconnectedBlocking,
			});
		} else if (
			this.matchState.meta.phase === "paused" &&
			disconnectedBlocking.length === 0 &&
			!belowMin
		) {
			this.appendAndBroadcast({ c: "resumed" });
		}
	}

	// ─── Shared plumbing ─────────────────────────────────────────────────

	private handleMessage(msg: MaetsMessage) {
		if (this.destroyed) return;
		if (msg.to && msg.to !== this.playerId) return;

		switch (msg.t) {
			case "hello":
				return this.handleHello(msg);
			case "submit":
				return this.handleSubmitMsg(msg);
			case "snapshot":
				return this.handleSnapshotMsg(msg);
			case "event":
				return this.handleEventMsg(msg.entry);
			case "reject":
				return this.handleRejectMsg(msg);
			case "resync":
				return this.handleResyncMsg(msg);
		}
	}

	/** Appends a locally-authored control event — sequencer-only. */
	private appendAndBroadcast(event: ControlEvent) {
		const entry: LogEntry = {
			seq: this.matchState.lastSeq + 1,
			actionId: crypto.randomUUID(),
			ts: Date.now(),
			by: "core",
			kind: "control",
			event,
		};
		this.applyLocalEntry(entry);
		this.broadcast({ t: "event", entry });
	}

	/** README §6.1: broadcast.self is false, so the sequencer applies its own
	 * accepted events locally at append time rather than hearing them back. */
	private applyLocalEntry(entry: LogEntry) {
		if (classifyEntry(this.matchState.lastSeq, entry.seq) !== "apply")
			return;
		this.matchState = applyEntry(this.matchState, entry, this.games);
		this.emitAll();
		if (entry.kind === "control" && entry.event.c === "game-over")
			this.emit("over");
	}

	private emitAll() {
		this.emit("state");
		this.emit("phase");
		this.emit("roster");
		this.emit("game");
	}

	/** Always emits, even when `stage` is unchanged — see the `handshake()` call
	 * site, where the attempt counter moves under a stable stage name. */
	private setStage(stage: ConnectionStage) {
		this._stage = stage;
		this.note(
			"info",
			stage === "handshaking"
				? `stage → handshaking (hello ${this._helloAttempt}/${HELLO_MAX_ATTEMPTS})`
				: `stage → ${stage}`,
		);
		this.emit("stage");
	}

	private emit(event: MatchEvent) {
		for (const cb of this.listeners.get(event) ?? []) cb();
	}

	private record(row: DistributiveOmit<LogRow, "id" | "at">) {
		const next = { ...row, id: ++this._logSeq, at: Date.now() } as LogRow;
		// A fresh array identity only when something actually lands, so a
		// consumer can treat reference equality as "nothing new".
		this._log = [...this._log, next].slice(-LOG_LIMIT);
		this.emit("log");
	}

	private note(level: "info" | "warn" | "error", text: string) {
		this.record({ kind: "note", level, text });
	}

	/** Split out of `broadcast` so the host's self-submit — which never reaches
	 * the wire — can log a truthful envelope for what it did in-process. */
	private envelope(fields: OutboundMessage): MaetsMessage {
		return {
			v: PROTOCOL_VERSION,
			match: this.code,
			mid: crypto.randomUUID(),
			from: this.playerId,
			ts: Date.now(),
			...fields,
		} as MaetsMessage;
	}

	private broadcast(fields: OutboundMessage) {
		if (!this.channel) {
			this.note("warn", `dropped ${fields.t}: no channel`);
			return;
		}
		const envelope = this.envelope(fields);
		// Recorded before the send so the log reads in causal order even if the
		// socket buffers.
		this.record({ kind: "message", dir: "out", msg: envelope });
		this.channel.send({ type: "broadcast", event: "m", payload: envelope });
	}
}
