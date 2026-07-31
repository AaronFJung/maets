import type { Game, GameResult, Seat } from "@maets/game-sync";
import { z } from "zod";

export type UltimateBoardResult = Seat | "draw" | null;

export type UltimateTttState = {
	/** Nine small boards, row-major; each small board is also row-major. */
	boards: (Seat | null)[][];
	/** The result of each small board. */
	boardResults: UltimateBoardResult[];
	turn: Seat;
	/** The small board that must be played next, or null for any open board. */
	nextBoard: number | null;
};

export const UltimateTttActionSchema = z.object({
	type: z.literal("place"),
	board: z.number().int().min(0).max(8),
	cell: z.number().int().min(0).max(8),
});
export type UltimateTttAction = z.infer<typeof UltimateTttActionSchema>;

const LINES = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
] as const;

function winner(cells: readonly (Seat | "draw" | null)[]): Seat | null {
	for (const [a, b, c] of LINES) {
		const seat = cells[a];
		if (
			typeof seat === "number" &&
			seat === cells[b] &&
			seat === cells[c]
		) {
			return seat;
		}
	}
	return null;
}

function isFull(board: readonly (Seat | null)[]) {
	return board.every((cell) => cell !== null);
}

function resultForBoard(board: readonly (Seat | null)[]): UltimateBoardResult {
	return winner(board) ?? (isFull(board) ? "draw" : null);
}

function gameResult(state: UltimateTttState): GameResult | null {
	const winningSeat = winner(state.boardResults);
	if (winningSeat !== null) return { kind: "win", winners: [winningSeat] };
	if (state.boardResults.every((result) => result !== null)) {
		return { kind: "draw" };
	}
	return null;
}

function nextSeat(currentSeat: Seat) {
	return currentSeat === 0 ? 1 : 0;
}

export const ultimateTicTacToe: Game<UltimateTttState, UltimateTttAction> = {
	id: "ultimate-tic-tac-toe",
	version: 1,
	seats: { min: 2, max: 2 },
	actionSchema: UltimateTttActionSchema,

	init: (seats: Seat[]): UltimateTttState => ({
		boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
		boardResults: Array(9).fill(null),
		turn: seats[0],
		nextBoard: null,
	}),

	activeSeats: (state) => (gameResult(state) ? [] : [state.turn]),

	isLegal: (state, action) => {
		if (gameResult(state)) return { reason: "game-over" };
		if (state.boardResults[action.board] !== null) {
			return { reason: "board-closed" };
		}
		if (
			state.nextBoard !== null &&
			state.boardResults[state.nextBoard] === null &&
			action.board !== state.nextBoard
		) {
			return { reason: "wrong-board" };
		}
		if (state.boards[action.board][action.cell] !== null) {
			return { reason: "cell-occupied" };
		}
		return true;
	},

	reduce: (state, action, context): UltimateTttState => {
		const board = state.boards[action.board].slice();
		board[action.cell] = context.by;

		const boards = state.boards.slice();
		boards[action.board] = board;

		const boardResults = state.boardResults.slice();
		boardResults[action.board] = resultForBoard(board);

		return {
			boards,
			boardResults,
			turn: nextSeat(context.by),
			nextBoard: boardResults[action.cell] === null ? action.cell : null,
		};
	},

	isOver: gameResult,
};
