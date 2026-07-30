import { z } from "zod";
import type { Game, GameResult, Seat } from "../types";

export type TttState = {
	board: (Seat | null)[]; // length 9, row-major; cell holds the seat that marked it
	turn: Seat;
};

export const TttActionSchema = z.object({
	type: z.literal("place"),
	cell: z.number().int().min(0).max(8),
});
export type TttAction = z.infer<typeof TttActionSchema>;

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

function winner(board: (Seat | null)[]): Seat | null {
	for (const [a, b, c] of LINES) {
		const s = board[a];
		if (s !== null && s === board[b] && s === board[c]) return s;
	}
	return null;
}

const isFull = (board: (Seat | null)[]) => board.every((c) => c !== null);
const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0); // 2-seat game

function withCell(board: (Seat | null)[], cell: number, mark: Seat) {
	const next = board.slice(); // never mutate input (contract §13)
	next[cell] = mark;
	return next;
}

export const ticTacToe = {
	id: "tic-tac-toe",
	version: "1.0.0",
	seats: { min: 2, max: 2 },
	actionSchema: TttActionSchema,

	init: (seats: Seat[]): TttState => ({
		board: Array(9).fill(null),
		turn: seats[0], // seat 0 (the creator) moves first
	}),

	activeSeats: (s: TttState): Seat[] =>
		winner(s.board) !== null || isFull(s.board) ? [] : [s.turn],

	isLegal: (s: TttState, a: TttAction, _by: Seat) => {
		if (winner(s.board) !== null || isFull(s.board))
			return { reason: "game-over" };
		if (s.board[a.cell] !== null) return { reason: "cell-occupied" };
		return true as const;
	},

	reduce: (s: TttState, a: TttAction, ctx: { by: Seat }): TttState => ({
		board: withCell(s.board, a.cell, ctx.by),
		turn: other(ctx.by),
	}),

	isOver: (s: TttState): GameResult | null => {
		const w = winner(s.board);
		if (w !== null) return { kind: "win", winners: [w] };
		if (isFull(s.board)) return { kind: "draw" };
		return null;
	},
} satisfies Game<TttState, TttAction>;
