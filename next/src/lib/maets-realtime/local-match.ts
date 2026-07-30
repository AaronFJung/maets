"use client";

import { useCallback, useMemo, useState } from "react";
import type { Game, GameResult, Seat } from "./types";

function randomSeatOrder(seatCount: number): Seat[] {
	const order = Array.from({ length: seatCount }, (_, i) => i);
	return Math.random() > 0.5 ? order : order.reverse();
}

/**
 * Drives a `Game` plugin locally, with no networking, log, or snapshot —
 * offline pass-and-play is a trivially-trusted single sequencer that applies
 * every move instantly. Uses the exact same plugin an online match would.
 */
export function useLocalMatch<State, Action>(game: Game<State, Action>) {
	const seatCount = game.seats.min;

	const [seatOrder, setSeatOrder] = useState<Seat[]>(() =>
		randomSeatOrder(seatCount),
	);
	const [state, setState] = useState<State>(() => game.init(seatOrder));

	const activeSeats = useMemo(() => game.activeSeats(state), [game, state]);
	const result: GameResult | null = useMemo(
		() => game.isOver(state),
		[game, state],
	);

	const submit = useCallback(
		(by: Seat, action: Action) => {
			setState((prev) => {
				if (!game.activeSeats(prev).includes(by)) return prev;
				if (game.isLegal(prev, action, by) !== true) return prev;
				return game.reduce(prev, action, { by });
			});
		},
		[game],
	);

	const reset = useCallback(() => {
		const nextOrder = randomSeatOrder(seatCount);
		setSeatOrder(nextOrder);
		setState(game.init(nextOrder));
	}, [game, seatCount]);

	return { state, seatOrder, activeSeats, result, submit, reset };
}
