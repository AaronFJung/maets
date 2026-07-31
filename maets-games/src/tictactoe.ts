import type { Game, GameResult, Seat } from "@maets/game-sync";
import { z } from "zod";

// Tic Tac Toe shared state.

export type TttState = {
	board: (Seat | null)[]; // length 9, row-major; cell holds the seat that marked it
	turn: Seat;
};

// User's action available in Tic Tac Toe.

export const TttActionSchema = z.object({
	type: z.literal("place"),
	cell: z.number().int().min(0).max(8),
});
export type TttAction = z.infer<typeof TttActionSchema>;

// Winning lines for Tic Tac Toe.

const LINES = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8], // rows
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8], // cols
	[0, 4, 8],
	[2, 4, 6], // diagonals
];

// Helper and game-logic functions for Tic Tac Toe.

function winner(board: (Seat | null)[]): Seat | null {
	for (const [a, b, c] of LINES) {
		const s = board[a];
		if (s !== null && s === board[b] && s === board[c]) return s;
	}
	return null;
}

function isFull(board: (Seat | null)[]) {
	return board.every((c) => c !== null);
}

function isGameOver(s: TttState) {
	return winner(s.board) !== null || isFull(s.board);
}

function isCellOccupied(s: TttState, cell: number) {
	return s.board[cell] !== null;
}

function withCell(board: (Seat | null)[], cell: number, mark: Seat) {
	const next = board.slice();
	next[cell] = mark;
	return next;
}

function nextSeat(currentSeat: Seat) {
	return currentSeat === 0 ? 1 : 0;
}

export const ticTacToe: Game<TttState, TttAction> = {
	id: "tic-tac-toe",
	version: 1,
	seats: { min: 2, max: 2 },
	actionSchema: TttActionSchema,

	init: (seats: Seat[]): TttState => ({
		board: Array(9).fill(null),
		turn: seats[0],
	}),

	activeSeats: (s: TttState): Seat[] => (isGameOver(s) ? [] : [s.turn]),

	isLegal: (s: TttState, a: TttAction, _by: Seat) => {
		if (isGameOver(s)) return { reason: "game-over" };
		if (isCellOccupied(s, a.cell)) return { reason: "cell-occupied" };

		return true;
	},

	reduce: (s: TttState, a: TttAction, ctx: { by: Seat }): TttState => ({
		board: withCell(s.board, a.cell, ctx.by),
		turn: nextSeat(ctx.by),
	}),

	isOver: (s: TttState): GameResult | null => {
		const w = winner(s.board);

		if (w !== null) return { kind: "win", winners: [w] };
		if (isFull(s.board)) return { kind: "draw" };

		return null;
	}
};
