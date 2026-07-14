import { PageTitle } from "@/components/page-title";
import { GAMES } from "@/lib/games";
import { HostGameCard } from "./host-game-card";

export default function Page() {
	return (
		<div className="mx-auto w-full">
			<PageTitle>Host a Game</PageTitle>

			<div className="grid gap-6 grid-cols-6">
				{GAMES.map((game) => (
					<HostGameCard key={game.id} game={game} />
				))}
			</div>
		</div>
	);
}
