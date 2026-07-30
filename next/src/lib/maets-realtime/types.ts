import type { z } from "zod";

export type Seat = number;

export type GameResult =
	| { kind: "win"; winners: Seat[] }
	| { kind: "draw" }
	| { kind: "abandoned" };

/**
 * A game is a set of pure, deterministic functions (README §13). Purity is
 * what lets every replica of the maets-realtime event log derive identical
 * state and lets a disconnected sequencer be replaced without losing state.
 */
export interface Game<
	State,
	Action,
	Setup = void,
	Private = void,
	Reveal = void,
> {
	readonly id: string;
	readonly version: string;
	readonly seats: { min: number; max: number };

	readonly actionSchema: z.ZodType<Action>;
	readonly revealSchema?: z.ZodType<Reveal>;

	init(seats: Seat[]): State;

	activeSeats(state: State): Seat[];

	isLegal(state: State, action: Action, by: Seat): true | { reason: string };

	needsReveal?(state: State, action: Action, by: Seat): Seat | null;

	reduce(
		state: State,
		action: Action,
		ctx: { by: Seat; reveal?: Reveal },
	): State;

	isOver(state: State): GameResult | null;

	// Hidden-information hooks — run only on the owning client.
	initPrivate?(setup: Setup): Private;
	resolveReveal?(priv: Private, action: Action, state: State): Reveal;
	reducePrivate?(priv: Private, action: Action, reveal: Reveal): Private;
}

// biome-ignore lint/suspicious/noExplicitAny: a registry holds games with differing State/Action/... types
export type GameRegistry = Record<string, Game<any, any, any, any, any>>;
