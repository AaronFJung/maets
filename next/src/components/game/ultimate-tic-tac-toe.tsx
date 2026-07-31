"use client";

import {
	GameContainer,
	MatchFooter,
	MatchResultActions,
} from "@/components/game/game-container";
import type { GameViewProps } from "@/components/game/match-view";
import { seatColor, seatName } from "@/components/game/seat";
import { cn } from "@/lib/utils";
import type { GameResult, Seat } from "@maets/game-sync";
import {
	type UltimateBoardResult,
	type UltimateTttAction,
	type UltimateTttState,
	ultimateTicTacToe,
} from "@maets/games";

export function UltimateTicTacToeView(
	match: GameViewProps<UltimateTttState, UltimateTttAction>,
) {
	const { state, submit, seat, isHost, phase, seatLabel, selectGame } = match;

	const result = ultimateTicTacToe.isOver(state);
	const myTurn = seat !== null && state.turn === seat;
	const paused = phase === "paused";

	return (
		<GameContainer
			wide
			stage={paused ? "Paused" : <>{seatLabel(state.turn)} is up!</>}
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
						onPlayAgain={() => selectGame(ultimateTicTacToe.id)}
					/>
				) : undefined
			}
			footer={
				<MatchFooter
					match={match}
					myTurn={myTurn}
					result={result}
					myTurnCopy={
						state.nextBoard === null
							? "Your move. Choose any open board."
							: "Your move. Play in the highlighted board."
					}
				/>
			}
		>
			<UltimateBoard
				state={state}
				disabled={!myTurn || phase !== "active"}
				onCellClick={(board, cell) =>
					submit({ type: "place", board, cell })
				}
			/>
		</GameContainer>
	);
}

function Headline({
	result,
	seatLabel,
}: {
	result: GameResult;
	seatLabel: GameViewProps["seatLabel"];
}) {
	switch (result.kind) {
		case "win":
			return <>{seatLabel(result.winners[0])} wins!</>;
		case "draw":
			return <>It's a draw!</>;
		case "abandoned":
			return <>Game abandoned.</>;
	}
}

function UltimateBoard({
	state,
	onCellClick,
	disabled,
}: {
	state: UltimateTttState;
	onCellClick: (board: number, cell: number) => void;
	disabled?: boolean;
}) {
	const requiredBoard =
		state.nextBoard !== null && state.boardResults[state.nextBoard] === null
			? state.nextBoard
			: null;

	return (
		<section
			className="grid aspect-square w-full grid-cols-3 gap-2 sm:gap-3"
			aria-label="Ultimate Tic Tac Toe board"
		>
			{state.boards.map((board, boardIndex) => {
				const boardResult = state.boardResults[boardIndex];
				const playable =
					boardResult === null &&
					(requiredBoard === null || requiredBoard === boardIndex);

				return (
					<SmallBoard
						// biome-ignore lint/suspicious/noArrayIndexKey: board index is a stable identity on a fixed-size board
						key={boardIndex}
						board={board}
						boardIndex={boardIndex}
						result={boardResult}
						playable={playable}
						disabled={disabled}
						onCellClick={onCellClick}
					/>
				);
			})}
		</section>
	);
}

function SmallBoard({
	board,
	boardIndex,
	result,
	playable,
	disabled,
	onCellClick,
}: {
	board: (Seat | null)[];
	boardIndex: number;
	result: UltimateBoardResult;
	playable: boolean;
	disabled?: boolean;
	onCellClick: (board: number, cell: number) => void;
}) {
	const winner = typeof result === "number" ? result : null;
	const status =
		winner !== null
			? `won by ${seatName(winner)}`
			: result === "draw"
				? "drawn"
				: playable
					? "playable"
					: "not playable this turn";

	return (
		<fieldset
			aria-label={`Board ${boardIndex + 1}, ${status}`}
			className={cn(
				"relative grid min-w-0 grid-cols-3 gap-0.5 rounded-lg border-2 p-1 transition-all sm:gap-1 sm:p-1.5",
				playable
					? "border-primary bg-primary/5 ring-2 ring-primary/25"
					: "border-border",
				!playable && result === null && "opacity-45",
				result !== null && "bg-muted/70 opacity-80",
			)}
			style={
				winner !== null
					? {
							borderColor: seatColor(winner),
							boxShadow: `inset 0 0 0 999px ${seatColor(winner)}12`,
						}
					: undefined
			}
		>
			{result !== null && (
				<span
					className={cn(
						"pointer-events-none absolute right-1 top-1 z-10 size-2.5 rounded-full border-2 border-background sm:size-3",
						result === "draw" && "bg-muted-foreground",
					)}
					style={
						winner !== null
							? { backgroundColor: seatColor(winner) }
							: undefined
					}
					aria-hidden="true"
				/>
			)}

			{board.map((seat, cell) => (
				<Cell
					// biome-ignore lint/suspicious/noArrayIndexKey: cell index is a stable identity on a fixed-size board
					key={cell}
					board={boardIndex}
					cell={cell}
					seat={seat}
					disabled={disabled || !playable || seat !== null}
					onClick={() => onCellClick(boardIndex, cell)}
				/>
			))}
		</fieldset>
	);
}

function Cell({
	board,
	cell,
	seat,
	onClick,
	disabled,
}: {
	board: number;
	cell: number;
	seat: Seat | null;
	onClick: () => void;
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
					? `Board ${board + 1}, square ${cell + 1}, taken by ${seatName(seat)}`
					: `Board ${board + 1}, square ${cell + 1}, empty`
			}
			className={cn(
				"aspect-square min-w-0 touch-manipulation rounded-sm bg-border outline-none transition-colors duration-150",
				"focus-visible:ring-2 focus-visible:ring-ring",
				claimed && "cursor-default",
				!disabled && "cursor-pointer hover:bg-accent",
			)}
			style={claimed ? { backgroundColor: seatColor(seat) } : undefined}
		/>
	);
}
