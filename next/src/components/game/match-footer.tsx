import { PauseIcon } from "lucide-react";
import type { MatchView } from "@/components/game/match-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GameResult } from "@/lib/maets-realtime/types";

/**
 * The chrome under any board: why play has stopped, whose move it is, and what
 * everyone is waiting on. Game-agnostic apart from `myTurnCopy`, so a new game
 * inherits all of it.
 */
export function MatchFooter({
	match,
	myTurn,
	result,
	myTurnCopy = "Your move.",
}: {
	/** The same projection the game view received. */
	match: MatchView;
	/** Whether it's this client's turn — only the game knows. */
	myTurn: boolean;
	result: GameResult | null;
	/** Game-specific nudge shown on your turn ("pick a square"). */
	myTurnCopy?: React.ReactNode;
}) {
	const { phase, seat, isHost, players, hostName, nameFor } = match;
	const paused = phase === "paused";
	const disconnected = players.filter((player) => !player.connected);

	return (
		<div className="flex flex-col gap-4">
			{paused && (
				<Alert>
					<PauseIcon />
					<AlertTitle>Game paused</AlertTitle>
					<AlertDescription>
						{disconnected.length > 0
							? `Waiting for ${disconnected
									.map(
										(player) =>
											nameFor(player.seat) ?? player.name,
									)
									.join(", ")} to reconnect.`
							: "Waiting for a disconnected player to return."}
					</AlertDescription>
				</Alert>
			)}

			{!result && !paused && (
				<p className="text-center text-sm text-muted-foreground">
					{seat === null
						? "You're spectating this match."
						: myTurn
							? myTurnCopy
							: "Waiting on your opponent's move."}
				</p>
			)}

			{result && !isHost && (
				<p className="text-center text-sm text-muted-foreground">
					Waiting for {hostName ?? "the host"} to start a rematch.
				</p>
			)}
		</div>
	);
}
