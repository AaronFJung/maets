"use client";

import GameShell from "@/components/game/game-shell";
import { MatchFooter } from "@/components/game/match-footer";
import type { GameViewProps } from "@/components/game/match-view";
import { SeatRail } from "@/components/game/seat-rail";
import { TicTacToeBoard, TttResultLine } from "@/components/game/tic-tac-toe";
import { Button } from "@/components/ui/button";
import {
	type TttAction,
	type TttState,
	ticTacToe,
} from "@/lib/maets-realtime/games/tictactoe";
import type { Seat } from "@/lib/maets-realtime/types";

/** Tic-tac-toe as played over a live match. */
export function TicTacToeView(match: GameViewProps<TttState, TttAction>) {
	const {
		state,
		submit,
		seat,
		isHost,
		phase,
		players,
		identityFor,
		seatLabel,
		selectGame,
	} = match;

	const result = ticTacToe.isOver(state);
	const myTurn = seat !== null && state.turn === seat;
	const paused = phase === "paused";

	// The two seats flank the board in seat order, so a player always sits on
	// the same side for the whole match.
	const seats = players.map((player) => player.seat).sort((a, b) => a - b);
	// Nobody is "up" once play stops, so neither rail recedes then.
	const awaiting = result || paused ? null : state.turn;

	const rail = (railSeat: Seat | undefined) =>
		railSeat === undefined ? undefined : (
			<SeatRail
				seat={railSeat}
				identity={identityFor(railSeat)}
				waiting={awaiting === null || awaiting === railSeat}
			/>
		);

	return (
		<GameShell
			asideStart={rail(seats[0])}
			asideEnd={rail(seats[1])}
			stage={paused ? "Paused" : <>{seatLabel(state.turn)} is up!</>}
			// Keyed by seat so the headline animates on every turn change.
			stageKey={paused ? "paused" : `seat-${state.turn}`}
			result={
				result ? (
					<TttResultLine result={result} seatLabel={seatLabel} />
				) : undefined
			}
			dimmed={paused}
			actions={
				result && isHost ? (
					<Button
						variant="secondary"
						size="lg"
						onClick={() => selectGame(ticTacToe.id)}
					>
						Play Again
					</Button>
				) : undefined
			}
			footer={
				<MatchFooter
					match={match}
					myTurn={myTurn}
					result={result}
					myTurnCopy="Your move. Pick a square."
				/>
			}
		>
			<TicTacToeBoard
				state={state}
				disabled={!myTurn || phase !== "active"}
				onCellClick={(cell) => submit({ type: "place", cell })}
			/>
		</GameShell>
	);
}
