import type { MatchView } from "@/components/game/match-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { GameResult } from "@maets/game-sync";
import { PauseIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";

export type GameShellProps = {
	stage: React.ReactNode;
	stageKey: React.Key;
	result?: React.ReactNode;
	actions?: React.ReactNode;
	dimmed?: boolean;
	asideStart?: React.ReactNode;
	asideEnd?: React.ReactNode;
	footer?: React.ReactNode;
};

export function GameContainer({
	children,
	stage,
	stageKey,
	result,
	actions,
	dimmed,
	asideStart,
	asideEnd,
	footer,
}: React.PropsWithChildren<GameShellProps>) {
	const receded = Boolean(result) || Boolean(dimmed);
	const hasAsides = Boolean(asideStart || asideEnd);

	return (
		<div
			className={cn(
				"mx-auto w-full",
				hasAsides ? "max-w-lg" : "max-w-sm",
			)}
		>
			<div className="mb-6 flex flex-col items-center gap-3">
				<AnimatePresence mode="wait" initial={false}>
					<motion.p
						key={result ? "result" : stageKey}
						className="text-2xl font-semibold text-center"
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						{result ?? stage}
					</motion.p>
				</AnimatePresence>

				<AnimatePresence>
					{actions && (
						<motion.div
							initial={{ opacity: 0, height: 0, scale: 0.9 }}
							animate={{ opacity: 1, height: "auto", scale: 1 }}
							exit={{ opacity: 0, height: 0, scale: 0.9 }}
							transition={{ duration: 0.25, ease: "easeOut" }}
						>
							{actions}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className="flex items-center gap-2 sm:gap-4">
				{asideStart}

				<motion.div
					className="min-w-0 flex-1"
					animate={{
						opacity: receded ? 0.85 : 1,
						filter: receded
							? "grayscale(0.5) blur(1px)"
							: "grayscale(0) blur(0px)",
					}}
					transition={{ duration: 0.3, ease: "easeOut" }}
					role="document"
					onClick={(ev) => {
						if (receded) {
							ev.stopPropagation();
						}
					}}
				>
					{children}
				</motion.div>

				{asideEnd}
			</div>

			{footer && <div className="mt-6">{footer}</div>}
		</div>
	);
}

export function MatchFooter({
	match,
	myTurn,
	result,
	myTurnCopy = "Your move.",
}: {
	match: MatchView;
	myTurn: boolean;
	result: GameResult | null;
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
