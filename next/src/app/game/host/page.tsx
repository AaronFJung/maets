import { CenteredContent } from "@/components/centered-content";
import { PageTitle } from "@/components/page-title";
import { GAMES } from "@/lib/games";
import { HostGameCard } from "./host-game-card";

export default function Page() {
	return (
		<CenteredContent>
			<PageTitle>Host a Game</PageTitle>

			<div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
				{GAMES.map((game) => (
					<HostGameCard key={game.id} game={game} />
				))}
			</div>
		</CenteredContent>
	);
}
