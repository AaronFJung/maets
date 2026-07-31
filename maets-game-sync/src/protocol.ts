import { z } from "zod";
import type { GameRegistry, GameResult, Seat } from "./types";

// ─── Constants (README §24) ────────────────────────────────────────────

export const PROTOCOL_VERSION = 1;
export const CHANNEL_PREFIX = `maets:v${PROTOCOL_VERSION}:match:`;
export const SUBMIT_TIMEOUT_MS = 4000;
export const RESYNC_DEBOUNCE_MS = 500;

export function matchChannelName(code: string) {
	// Codes are generated uppercase (lobby-code.ts); uppercase defensively so a
	// hand-typed or manually-edited URL still lands on the same channel.
	return `${CHANNEL_PREFIX}${code.toUpperCase()}`;
}

// ─── Presence (README §6.3) ────────────────────────────────────────────

const SeatSchema: z.ZodType<Seat> = z.number().int().nonnegative();

export const MaetsPresenceSchema = z.object({
	playerId: z.string(),
	role: z.enum(["player", "spectator", "pending"]),
	seat: SeatSchema.nullable(),
	name: z.string(),
	v: z.literal(PROTOCOL_VERSION),
});
export type MaetsPresence = z.infer<typeof MaetsPresenceSchema>;

// ─── Event log (README §8.1) ───────────────────────────────────────────

const GameResultSchema: z.ZodType<GameResult> = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("win"), winners: z.array(SeatSchema) }),
	z.object({ kind: z.literal("draw") }),
	z.object({ kind: z.literal("abandoned") }),
]);

export const ControlEventSchema = z.discriminatedUnion("c", [
	z.object({
		c: z.literal("seat-claimed"),
		seat: SeatSchema,
		playerId: z.string(),
		name: z.string(),
	}),
	z.object({
		c: z.literal("game-selected"),
		sessionId: z.string(),
		gameId: z.string(),
		version: z.int(),
		seatOrder: z.array(SeatSchema),
	}),
	z.object({
		c: z.literal("paused"),
		reason: z.enum(["disconnect", "reveal-timeout", "manual"]),
		waitingOn: z.array(SeatSchema),
	}),
	z.object({ c: z.literal("resumed") }),
	z.object({
		c: z.literal("sequencer-changed"),
		seat: SeatSchema,
		playerId: z.string(),
	}),
	z.object({ c: z.literal("game-over"), result: GameResultSchema }),
]);
export type ControlEvent = z.infer<typeof ControlEventSchema>;

export const LogEntrySchema = z.discriminatedUnion("kind", [
	z.object({
		seq: z.number().int().nonnegative(),
		actionId: z.string(),
		ts: z.number(),
		by: z.literal("core"),
		kind: z.literal("control"),
		event: ControlEventSchema,
	}),
	z.object({
		seq: z.number().int().nonnegative(),
		actionId: z.string(),
		ts: z.number(),
		by: SeatSchema,
		kind: z.literal("move"),
		action: z.unknown(),
		reveal: z.unknown().optional(),
	}),
]);
export type LogEntry = z.infer<typeof LogEntrySchema>;

// ─── Match state (README §8.2) ─────────────────────────────────────────

const RosterEntrySchema = z.object({
	playerId: z.string(),
	name: z.string(),
	connected: z.boolean(),
});

export const MatchMetaSchema = z.object({
	phase: z.enum(["lobby", "active", "paused", "finished"]),
	roster: z.record(z.string(), RosterEntrySchema), // JSON keys are strings; keyed by seat
	sequencerSeat: SeatSchema,
	activeGameId: z.string().nullable(),
	sessionId: z.string().nullable(),
});
export type MatchMeta = z.infer<typeof MatchMetaSchema>;

/** Room lifecycle (README §12.1). Derived from the schema so it can't drift. */
export type MatchPhase = MatchMeta["phase"];

export type MatchState<Game = unknown> = {
	meta: MatchMeta;
	game: Game;
	lastSeq: number;
};

export const SnapshotSchema = z.object({
	meta: MatchMetaSchema,
	// Optional, and it has to be: before the first `game-selected` there is no
	// session, so `game` is `undefined`, and `JSON.stringify` drops undefined
	// values, so the key is simply absent on the wire. Zod treats a bare
	// `z.unknown()` key as required, which made every lobby-phase snapshot fail
	// validation and left joiners stuck on "handshaking" until a game started.
	game: z.unknown().optional(),
	lastSeq: z.number().int(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export function initialMeta(sequencerSeat: Seat): MatchMeta {
	return {
		phase: "lobby",
		roster: {},
		sequencerSeat,
		activeGameId: null,
		sessionId: null,
	};
}

/** The core (room-level) reducer — consumes `control` events only (README §8.2). */
export function applyControlEvent(
	meta: MatchMeta,
	event: ControlEvent,
): MatchMeta {
	switch (event.c) {
		case "seat-claimed":
			return {
				...meta,
				roster: {
					...meta.roster,
					[event.seat]: {
						playerId: event.playerId,
						name: event.name,
						connected: true,
					},
				},
			};
		case "game-selected":
			return {
				...meta,
				phase: "active",
				activeGameId: event.gameId,
				sessionId: event.sessionId,
			};
		case "paused":
			return { ...meta, phase: "paused" };
		case "resumed":
			return {
				...meta,
				phase: meta.activeGameId ? "active" : meta.phase,
			};
		case "sequencer-changed":
			return { ...meta, sequencerSeat: event.seat };
		case "game-over":
			return { ...meta, phase: "finished" };
	}
}

// ─── Ordering, sequencing & idempotency (README §11) ───────────────────

export type EntryOutcome = "apply" | "duplicate" | "gap";

/** Classifies an incoming `seq` against the replica's `lastSeq`. Pure — the
 * caller applies on "apply", ignores on "duplicate", and buffers + resyncs
 * on "gap". */
export function classifyEntry(lastSeq: number, seq: number): EntryOutcome {
	if (seq <= lastSeq) return "duplicate";
	if (seq > lastSeq + 1) return "gap";
	return "apply";
}

/** Applies one already-contiguous `LogEntry` to `MatchState` (README §8.2).
 * Caller must have already checked `classifyEntry(state.lastSeq, entry.seq) === "apply"`. */
export function applyEntry(
	state: MatchState,
	entry: LogEntry,
	registry: GameRegistry,
): MatchState {
	if (entry.kind === "control") {
		const meta = applyControlEvent(state.meta, entry.event);
		const game =
			entry.event.c === "game-selected"
				? registry[entry.event.gameId]?.init(entry.event.seatOrder)
				: state.game;
		return { meta, game, lastSeq: entry.seq };
	}

	const plugin = state.meta.activeGameId
		? registry[state.meta.activeGameId]
		: undefined;
	if (!plugin) return { ...state, lastSeq: entry.seq };

	const game = plugin.reduce(state.game, entry.action, {
		by: entry.by,
		reveal: entry.reveal,
	});
	return { ...state, game, lastSeq: entry.seq };
}

// ─── Message envelopes (README §10) ────────────────────────────────────

const EnvelopeBaseSchema = z.object({
	v: z.literal(PROTOCOL_VERSION),
	match: z.string(),
	mid: z.string(),
	from: z.string(),
	to: z.string().optional(),
	ts: z.number(),
});

export const RejectReasonSchema = z.enum([
	"not-your-turn",
	"illegal-move",
	"match-not-active",
	"unknown-seat",
	"version-mismatch",
	"match-full",
	"stale",
]);
export type RejectReason = z.infer<typeof RejectReasonSchema>;

const HelloSchema = EnvelopeBaseSchema.extend({
	t: z.literal("hello"),
	playerId: z.string(),
	name: z.string(),
	want: z.enum(["player", "spectator"]),
	games: z.array(z.object({ id: z.string(), version: z.int() })),
});

const SnapshotMsgSchema = EnvelopeBaseSchema.extend({
	t: z.literal("snapshot"),
	snapshot: SnapshotSchema,
	yourSeat: SeatSchema.nullable(),
	yourRole: z.enum(["player", "spectator"]),
});

const SubmitSchema = EnvelopeBaseSchema.extend({
	t: z.literal("submit"),
	actionId: z.string(),
	action: z.unknown(),
});

const EventMsgSchema = EnvelopeBaseSchema.extend({
	t: z.literal("event"),
	entry: LogEntrySchema,
});

const RejectSchema = EnvelopeBaseSchema.extend({
	t: z.literal("reject"),
	actionId: z.string(),
	reason: RejectReasonSchema,
	message: z.string().optional(),
});

const ResyncSchema = EnvelopeBaseSchema.extend({
	t: z.literal("resync"),
	haveSeq: z.number().int(),
});

export const MaetsMessageSchema = z.discriminatedUnion("t", [
	HelloSchema,
	SnapshotMsgSchema,
	SubmitSchema,
	EventMsgSchema,
	RejectSchema,
	ResyncSchema,
]);
export type MaetsMessage = z.infer<typeof MaetsMessageSchema>;
