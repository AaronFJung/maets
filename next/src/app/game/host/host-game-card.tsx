"use client";

import type { Game } from "@/lib/games";
import { generateLobbyCode } from "@/lib/maets-realtime/lobby-code";
import { useRouter } from "next/navigation";

export function HostGameCard({ game }: { game: Game }) {
	const router = useRouter();

	function hostGame() {
		// the chosen game rides along as a query param until game selection
		// becomes a real `game-selected` control event (spec §12.7)
		router.push(`/game/${generateLobbyCode()}?game=${game.id}`);
	}

	return (
		<button
			type="button"
			onClick={hostGame}
			className="group flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
		>
			<span className="font-serif font-medium">{game.name}</span>
			{/* Placeholder for the game's artwork */}
			<div className="aspect-square w-full rounded-md bg-muted transition-colors group-hover:bg-background" />
		</button>
	);
}
