"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ConnectionStage } from "@/hooks/useMatch";

function getStageText(stage: ConnectionStage): string {
	switch (stage) {
		case "idle":
			return "Identifying you...";
		case "subscribing":
			return "Opening Realtime Channel...";
		case "announcing":
			return "Announcing Presence...";
		case "handshaking":
			return "Handshaking with the Host...";
		case "creating":
			return "Creating the Match...";
		case "syncing":
			return "Syncing Match State...";
		case "ready":
			return "Connected";
		default:
			return "Connecting...";
	}
}

/**
 * Narrates where a join actually is. `ConnectionStage` has no terminal
 * "failed", so the stage a stall stops on *is* the diagnostic — which is why
 * this reports the step rather than a generic "Connecting…".
 */
export function MatchConnection({
	stage,
	error,
}: {
	stage: ConnectionStage;
	error?: string;
}) {
	const statusText = error
		? `Failed to Connect: ${error}`
		: getStageText(stage);

	return (
		<div className="flex gap-2 items-center text-lg font-medium text-muted-foreground">
			<div>
				<AnimatePresence mode="popLayout">
					<motion.p
						key={statusText}
						initial={{ y: 10, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: -10, opacity: 0 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
					>
						{statusText}
					</motion.p>
				</AnimatePresence>
			</div>
		</div>
	);
}
