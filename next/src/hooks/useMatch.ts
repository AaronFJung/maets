"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ConnectionStage,
	HELLO_MAX_ATTEMPTS,
	LOG_LIMIT,
	type LogRow,
	MaetsMatch,
} from "@/lib/maets-realtime/maets-match";
import type { GameRegistry, Seat } from "@/lib/maets-realtime/types";

export type { ConnectionStage, LogRow };

/**
 * One seated participant, as the UI sees them. `playerId` is the auth user id
 * when the caller passed one, so profiles (avatars, renames) resolve from it —
 * see `useSeatIdentities`.
 */
export type MatchPlayer = {
	seat: Seat;
	playerId: string;
	name: string;
	connected: boolean;
};

const PLAYER_ID_KEY = "maets:playerId";

function getOrCreatePlayerId(): string {
	if (typeof window === "undefined") return "";
	const existing = window.localStorage.getItem(PLAYER_ID_KEY);
	if (existing) return existing;
	const created = crypto.randomUUID();
	window.localStorage.setItem(PLAYER_ID_KEY, created);
	return created;
}

/**
 * React binding for `MaetsMatch` (README §22). `games` and `want` should be
 * stable references (e.g. a module-level registry) — they're effect
 * dependencies, so a fresh object identity on every render reconnects.
 */
export function useMatch<State = unknown, Action = unknown>({
	code,
	games,
	playerId,
	name,
	want,
}: {
	code: string;
	games: GameRegistry;
	playerId?: string;
	name: string;
	want?: "player" | "spectator";
}) {
	const resolvedPlayerId = playerId ?? getOrCreatePlayerId();

	const matchRef = useRef<MaetsMatch | null>(null);
	const [stage, setStage] = useState<ConnectionStage>("idle");
	const [helloAttempt, setHelloAttempt] = useState(0);
	const [error, setError] = useState<string>();
	const [log, setLog] = useState<readonly LogRow[]>([]);
	// Where `join()` died. `ConnectionStage` deliberately has no terminal
	// "failed", so the stage it stopped on *is* the diagnostic — but it keeps
	// moving afterwards on reconnect, so pin it at rejection time.
	const [failedAt, setFailedAt] = useState<{
		stage: ConnectionStage;
		at: number;
	}>();
	const [, forceRender] = useState(0);

	useEffect(() => {
		if (!code || !resolvedPlayerId || !name) return;

		const match = new MaetsMatch({
			code,
			playerId: resolvedPlayerId,
			name,
			games,
			want,
		});
		matchRef.current = match;

		const bump = () => forceRender((n) => n + 1);
		const syncStage = () => {
			setStage(match.stage);
			setHelloAttempt(match.helloAttempt);
		};
		const unsubs = [
			match.on("state", bump),
			match.on("phase", bump),
			match.on("roster", bump),
			match.on("game", bump),
			match.on("rejected", bump),
			match.on("over", bump),
			match.on("stage", syncStage),
			match.on("log", () => setLog(match.log)),
		];
		syncStage();
		setLog(match.log);

		match
			.join()
			.then(() => {
				setError(undefined);
				setFailedAt(undefined);
			})
			.catch((err) => {
				// the stage is left where it broke, so callers can report which
				// step failed alongside this message
				setError(err instanceof Error ? err.message : String(err));
				setFailedAt({ stage: match.stage, at: Date.now() });
			});

		return () => {
			for (const unsub of unsubs) unsub();
			match.leave();
			matchRef.current = null;
			setStage("idle");
			setHelloAttempt(0);
			setLog([]);
			setFailedAt(undefined);
		};
	}, [code, resolvedPlayerId, name, games, want]);

	const submit = useCallback((action: Action) => {
		matchRef.current?.submit(action);
	}, []);

	const selectGame = useCallback((gameId: string) => {
		matchRef.current?.selectGame(gameId);
	}, []);

	const clearLog = useCallback(() => {
		matchRef.current?.clearLog();
	}, []);

	const match = matchRef.current;
	const players: MatchPlayer[] = match
		? Object.entries(match.roster).map(([seat, r]) => ({
				seat: Number(seat),
				// The auth user id when the caller passed one, so callers can look
				// the seat's live profile (avatar, renames) up by it.
				playerId: r.playerId,
				name: r.name,
				connected: r.connected,
			}))
		: [];

	const host = match
		? (players.find((p) => p.seat === match.hostSeat) ?? null)
		: null;

	return {
		playerId: resolvedPlayerId,
		activeGameId: match?.activeGameId ?? null,
		// Undefined until the first snapshot lands, and again between sessions —
		// callers must guard rather than assume the active game's state shape.
		state: match?.state as State | undefined,
		phase: match?.phase ?? "lobby",
		seat: match?.seat ?? null,
		isHost: match?.isHost ?? false,
		players,
		host,
		spectators: match?.spectatorCount ?? 0,
		rejection: match?.rejection ?? null,
		submit,
		selectGame,
		stage,
		helloAttempt,
		helloMaxAttempts: HELLO_MAX_ATTEMPTS,
		error,

		// Observational — for the dev inspector. Nothing in the UI should
		// branch on these.
		code,
		name,
		role: match?.role ?? "spectator",
		lastSeq: match?.lastSeq ?? -1,
		sessionId: match?.sessionId ?? null,
		sequencerSeat: match?.hostSeat ?? null,
		connectedIds: match?.connectedIds ?? [],
		pending: match?.pendingActionIds ?? [],
		buffered: match?.bufferedSeqs ?? [],
		channelStatus: match?.channelStatus ?? null,
		log,
		logLimit: LOG_LIMIT,
		clearLog,
		failedAt,
	};
}
