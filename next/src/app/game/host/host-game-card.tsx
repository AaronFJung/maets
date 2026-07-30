"use client";

import { Gamepad2Icon, Grid3X3Icon, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Game } from "@/lib/games";
import { generateLobbyCode } from "@/lib/maets-realtime/lobby-code";

// No per-game artwork exists yet — an icon per game id, falling back to a
// generic one, reads as a finished tile instead of an empty placeholder box.
const GAME_ICONS: Record<string, LucideIcon> = {
	"tic-tac-toe": Grid3X3Icon,
};

export function HostGameCard({ game }: { game: Game }) {
	const router = useRouter();
	const Icon = GAME_ICONS[game.id] ?? Gamepad2Icon;

	function hostGame() {
		// the chosen game rides along as a query param until game selection
		// becomes a real `game-selected` control event (spec §12.7)
		router.push(`/game/${generateLobbyCode()}?game=${game.id}`);
	}

	return (
		<motion.button
			type="button"
			onClick={hostGame}
			className="block w-full text-left"
			whileHover={{ y: -3 }}
			whileTap={{ scale: 0.97 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
		>
			<Card className="transition-shadow hover:shadow-md hover:ring-primary/40">
				<CardContent>
					<div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
						<Icon className="size-12 text-muted-foreground" />
					</div>
				</CardContent>
				<CardHeader>
					<CardTitle className="text-center font-serif">
						{game.name}
					</CardTitle>
				</CardHeader>
			</Card>
		</motion.button>
	);
}
