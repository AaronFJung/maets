import { seatColor } from "@/components/game/seat";
import { ticTacToe } from "@maets/games";

export const GAME_PREVIEWS: Record<string, React.ReactNode> = {
	[ticTacToe.id]: <TicTacToePreview />,
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
