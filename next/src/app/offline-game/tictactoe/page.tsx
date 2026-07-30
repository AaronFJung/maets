import { CenteredContent } from "@/components/centered-content";
import TicTacToe from "@/components/game/tic-tac-toe";

export default function Page() {
	return (
		<CenteredContent width="narrow">
			<TicTacToe />
		</CenteredContent>
	);
}
