"use client";

import {
	GameContainer,
	MatchFooter,
	MatchResultActions,
} from "@/components/game/game-container";
import type { GameViewProps } from "@/components/game/match-view";
import { type SeatLabel, seatColor, seatName } from "@/components/game/seat";
import { cn } from "@/lib/utils";
import type { GameResult, Seat } from "@maets/game-sync";
import { type TttAction, type TttState, ticTacToe } from "@maets/games";

export function TicTacToeView(match: GameViewProps<TttState, TttAction>) {
	const { state, submit, seat, isHost, phase, seatLabel, selectGame } = match;

	const result = ticTacToe.isOver(state);
	const myTurn = seat !== null && state.turn === seat;
	const paused = phase === "paused";

	return (
		<GameContainer
			stage={paused ? "Paused" : <>{seatLabel(state.turn)} is up!</>}
			// Keyed by seat so the headline animates on every turn change.
			stageKey={paused ? "paused" : `seat-${state.turn}`}
			result={
				result ? (
					<Headline result={result} seatLabel={seatLabel} />
				) : undefined
			}
			dimmed={paused}
			actions={
				result ? (
					<MatchResultActions
						isHost={isHost}
						onPlayAgain={() => selectGame(ticTacToe.id)}
					/>
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
			<Board
				state={state}
				disabled={!myTurn || phase !== "active"}
				onCellClick={(cell) => submit({ type: "place", cell })}
			/>
		</GameContainer>
	);
}

function Headline({
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

function Board({
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
			aria-label={
				claimed
					? `Square ${cell + 1}, taken by ${seatName(seat)}`
					: `Square ${cell + 1}, empty`
			}
			className={cn(
				"size-full rounded-md outline-none transition-colors duration-150",
				"focus-visible:ring-3 focus-visible:ring-ring/50",
				claimed ? "cursor-default" : "bg-border",
				!disabled && "cursor-pointer hover:bg-accent",
			)}
			style={claimed ? { backgroundColor: seatColor(seat) } : undefined}
		/>
	);
}
