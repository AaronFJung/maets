import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { cn } from "@/lib/utils";

export type GameShell = {
	/** The headline: whose turn it is, what the board is waiting on. */
	stage: React.ReactNode;
	/** Identifies the current stage for animation purposes; change it whenever `stage` should animate in. */
	stageKey: React.Key;
	/** Set once the game is decided — replaces `stage` and dims the board. The
	 * caller supplies the whole line ("Blue wins!", "It's a draw!") so results
	 * that aren't a single winner can be phrased properly. */
	result?: React.ReactNode;
	/** Revealed under the headline alongside `result` (e.g. a Play Again
	 * button). A node rather than a callback so callers can withhold it —
	 * online, only the host may start a rematch. */
	actions?: React.ReactNode;
	/** Dims the board without declaring a result — for an interrupted game. */
	dimmed?: boolean;
	/** Rendered flanking the board, vertically centred against it — the seats
	 * playing on it, a score track. Deliberately outside the receding wrapper:
	 * when a result names a player, that player should stay legible. Supplying
	 * either one widens the shell to make room. */
	asideStart?: React.ReactNode;
	asideEnd?: React.ReactNode;
	/** Rendered below the board (roster strips, connection chrome). */
	footer?: React.ReactNode;
};

/**
 * Presentation shell shared by the offline games and the online lobby: an
 * animated headline over a board that recedes once play stops. It holds no game
 * or transport state — everything it shows is passed in, so the same chrome
 * wraps a local `useLocalMatch` and a networked `useMatch`.
 */
export default function GameShell({
	children,
	stage,
	stageKey,
	result,
	actions,
	dimmed,
	asideStart,
	asideEnd,
	footer,
}: React.PropsWithChildren<GameShell>) {
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
