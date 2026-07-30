"use client";

import GameShell from "@/components/game/game-shell";
import { colorSeatLabel, type SeatLabel } from "@/components/game/player-tag";
import { seatColor, seatName } from "@/components/game/seat-palette";
import { Button } from "@/components/ui/button";
import { type TttState, ticTacToe } from "@/lib/maets-realtime/games/tictactoe";
import { useLocalMatch } from "@/lib/maets-realtime/local-match";
import type { GameResult, Seat } from "@/lib/maets-realtime/types";
import { cn } from "@/lib/utils";

/**
 * The headline for a decided game, or `null` while play continues. Shared by
 * the offline board and the online view so both phrase draws and abandonment
 * the same way.
 */
export function TttResultLine({
	result,
	seatLabel,
}: {
	result: GameResult | null;
	seatLabel: SeatLabel;
}) {
	if (!result) return null;
	switch (result.kind) {
		case "win":
			return <>{seatLabel(result.winners[0])} wins!</>;
		case "draw":
			return <>It's a draw!</>;
		case "abandoned":
			return <>Game abandoned.</>;
	}
}

/** Pass-and-play tic-tac-toe: one device, no transport, seats are just colours. */
export default function TicTacToe() {
	const { state, activeSeats, result, submit, reset } =
		useLocalMatch(ticTacToe);

	const currentSeat = activeSeats[0];

	return (
		<GameShell
			stage={<>{colorSeatLabel(state.turn)} is up!</>}
			stageKey={state.turn}
			result={
				result ? (
					// Local hotseat play has no usernames — seats are just colours.
					<TttResultLine result={result} seatLabel={colorSeatLabel} />
				) : undefined
			}
			actions={
				result ? (
					<Button variant="secondary" size="lg" onClick={reset}>
						Play Again
					</Button>
				) : undefined
			}
		>
			<TicTacToeBoard
				state={state}
				disabled={currentSeat === undefined}
				onCellClick={(cell) => {
					if (currentSeat === undefined) return;
					submit(currentSeat, { type: "place", cell });
				}}
			/>
		</GameShell>
	);
}

export function TicTacToeBoard({
	state,
	onCellClick,
	disabled,
}: {
	state: TttState;
	onCellClick: (cell: number) => void;
	disabled?: boolean;
}) {
	return (
		<div className="grid grid-cols-3 gap-3 w-full aspect-square sm:gap-4">
			{state.board.map((seat, cell) => (
				<Cell
					// biome-ignore lint/suspicious/noArrayIndexKey: cell index is a stable identity on a fixed-size board
					key={cell}
					cell={cell}
					seat={seat}
					disabled={disabled || seat !== null}
					onClick={() => onCellClick(cell)}
				/>
			))}
		</div>
	);
}

function Cell({
	cell,
	seat,
	onClick,
	disabled,
}: {
	/** Index on the board, for the square's accessible name. */
	cell: number;
	seat: Seat | null;
	onClick?: () => void;
	disabled?: boolean;
}) {
	const claimed = seat !== null;

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			// Squares are indistinguishable to a screen reader without this: the
			// mark is a background colour, so there is no text to announce.
			aria-label={
				claimed
					? `Square ${cell + 1}, taken by ${seatName(seat)}`
					: `Square ${cell + 1}, empty`
			}
			className={cn(
				"size-full rounded-md outline-none transition-colors duration-150",
				"focus-visible:ring-3 focus-visible:ring-ring/50",
				claimed ? "cursor-default" : "bg-border",
				// Only an empty square on a live board invites a click; a taken
				// one arrives here disabled and must not look playable.
				!disabled && "cursor-pointer hover:bg-accent",
			)}
			style={claimed ? { backgroundColor: seatColor(seat) } : undefined}
		/>
	);
}
