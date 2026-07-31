import { seatColor } from "@/components/game/seat";
import { ticTacToe, ultimateTicTacToe } from "@maets/games";

export const GAME_PREVIEWS: Record<string, React.ReactNode> = {
	[ticTacToe.id]: <TicTacToePreview />,
	[ultimateTicTacToe.id]: <UltimateTicTacToePreview />,
};

export function gamePreviewFor(gameId: string): React.ReactNode | undefined {
	return GAME_PREVIEWS[gameId];
}

// Tic Tac Toe.

const TTT_CELLS: (number | null)[] = [0, null, 1, null, 0, null, 1, null, 0];

function TicTacToePreview() {
	return (
		<div className="grid size-full grid-cols-3 gap-1.5">
			{TTT_CELLS.map((seat, cell) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: cell index is a stable identity on a fixed-size board
					key={cell}
					className="rounded-sm bg-border"
					style={
						seat !== null
							? { backgroundColor: seatColor(seat) }
							: undefined
					}
				/>
			))}
		</div>
	);
}

// Ultimate Tic Tac Toe.

const ULTIMATE_PREVIEW_BOARDS: (number | null)[][] = [
	[0, null, 1, null, 0, null, 1, null, 0],
	[null, 1, null, 0, null, null, null, null, null],
	[1, null, null, null, 0, null, null, null, 1],
	[null, null, 0, null, 1, null, null, null, null],
	[1, null, 0, null, 1, null, 0, null, 1],
	[null, null, null, 0, null, 1, null, null, null],
	[0, null, null, null, 1, null, null, null, 0],
	[null, null, null, 1, null, 0, null, 1, null],
	[1, null, 0, null, 1, null, 0, null, 1],
];

function UltimateTicTacToePreview() {
	return (
		<div className="grid size-full grid-cols-3 gap-1" aria-hidden="true">
			{ULTIMATE_PREVIEW_BOARDS.map((board, boardIndex) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: board index is a stable identity on a fixed-size preview
					key={boardIndex}
					className="grid grid-cols-3 gap-px rounded-sm border border-border p-0.5"
				>
					{board.map((seat, cell) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: cell index is a stable identity on a fixed-size preview
							key={cell}
							className="rounded-[1px] bg-border"
							style={
								seat !== null
									? {
											backgroundColor: seatColor(seat),
										}
									: undefined
							}
						/>
					))}
				</div>
			))}
		</div>
	);
}
