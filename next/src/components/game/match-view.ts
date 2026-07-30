import type { SeatIdentity, SeatLabel } from "@/components/game/player-tag";
import type { MatchPlayer } from "@/hooks/useMatch";
import type { MatchPhase } from "@/lib/maets-realtime/protocol";
import type { Seat } from "@/lib/maets-realtime/types";

/**
 * The room-level projection of `useMatch` that every match-aware view sees.
 * Deliberately narrow: none of `useMatch`'s observational fields (the block it
 * marks "for the dev inspector") appear here, so no view can branch on them.
 */
export type MatchView = {
	/** This client's seat, or `null` while spectating. */
	seat: Seat | null;
	/** Is this client the current sequencer? Gates every host-only control. */
	isHost: boolean;
	phase: MatchPhase;
	players: readonly MatchPlayer[];
	/** Seat of the current sequencer, if one is seated. */
	hostSeat?: Seat;
	/** Profile-resolved display name of the sequencer, if there is one. */
	hostName?: string;
	spectators: number;
	identityFor: (seat: Seat) => SeatIdentity | undefined;
	nameFor: (seat: Seat) => string | undefined;
	seatLabel: SeatLabel;
	/** Host-only (§12.7); passing the same id again starts a rematch. */
	selectGame: (gameId: string) => void;
};

/** Everything a game's online view is handed. */
export type GameViewProps<State = unknown, Action = unknown> = MatchView & {
	/** Public state of the active session. Never `undefined` — the dispatcher
	 * only mounts a view once state has arrived. */
	state: State;
	/** Submit a move for this client's seat. */
	submit: (action: Action) => void;
};

export type GameView<State = unknown, Action = unknown> = React.ComponentType<
	GameViewProps<State, Action>
>;

/**
 * Views for games with differing `State`/`Action` types have no common
 * supertype, so the registry is heterogeneous. `any` is bidirectionally
 * assignable, which means a typed view registers without a cast *and* renders
 * against the room's `unknown` state without one — containing the unsoundness
 * to this single token. Mirrors `GameRegistry` in maets-realtime/types.ts.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above — one `any` here beats a cast per game
export type GameViewRegistry = Record<string, GameView<any, any>>;
