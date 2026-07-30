"use client";

import { BugIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConnectionStage } from "@/hooks/useMatch";

// A structural subset of useMatch's return value — omits `submit`/`selectGame`
// (never called here; this is a read-only inspector) so it accepts any of
// useMatch's game-specific instantiations without generic-variance friction.
type Match = {
	playerId: string;
	stage: ConnectionStage;
	helloAttempt: number;
	error: string | undefined;
	seat: number | null;
	isHost: boolean;
	phase: "lobby" | "active" | "paused" | "finished";
	activeGameId: string | null;
	host: { seat: number; name: string; connected: boolean } | null;
	spectators: number;
	players: Array<{ seat: number; name: string; connected: boolean }>;
	rejection: { actionId: string; reason: string; message?: string } | null;
	state: unknown;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-2 py-0.5">
			<span className="text-muted-foreground">{label}</span>
			<span className="truncate font-medium">{value}</span>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="border-t border-border/60 py-2 first:border-t-0 first:pt-0">
			<div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
				{title}
			</div>
			{children}
		</div>
	);
}

/** Read-only inspector for a live `useMatch` connection. Toggled via the
 * settings menu (`useDevMenu`); only rendered by the caller once a match is
 * actually joined. */
export function MatchDevSidecar({ match }: { match: Match }) {
	const [open, setOpen] = useState(true);

	if (!open) {
		return (
			<Button
				variant="outline"
				size="icon"
				className="fixed top-1/2 right-0 z-50 -translate-y-1/2 rounded-r-none"
				onClick={() => setOpen(true)}
			>
				<ChevronLeftIcon />
				<span className="sr-only">Open developer menu</span>
			</Button>
		);
	}

	return (
		<div className="fixed top-1/2 right-0 z-50 flex max-h-[80vh] w-72 -translate-y-1/2 flex-col rounded-l-xl border border-border bg-card font-mono text-xs text-card-foreground shadow-lg ring-1 ring-foreground/10">
			<div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
				<div className="flex items-center gap-1.5 font-sans text-sm font-semibold">
					<BugIcon className="size-4" />
					Dev
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setOpen(false)}
				>
					<ChevronRightIcon />
					<span className="sr-only">Collapse developer menu</span>
				</Button>
			</div>

			<div className="overflow-y-auto px-3 py-2">
				<Section title="Connection">
					<Field label="stage" value={match.stage} />
					<Field label="helloAttempt" value={match.helloAttempt} />
					{match.error && <Field label="error" value={match.error} />}
				</Section>

				<Section title="Identity">
					<Field label="playerId" value={match.playerId} />
					<Field label="seat" value={match.seat ?? "—"} />
					<Field label="isHost" value={String(match.isHost)} />
				</Section>

				<Section title="Room">
					<Field label="phase" value={match.phase} />
					<Field label="game" value={match.activeGameId ?? "—"} />
					<Field label="host" value={match.host?.name ?? "—"} />
					<Field label="spectators" value={match.spectators} />
					<div className="mt-1 space-y-0.5">
						{match.players.map((player) => (
							<div
								key={player.seat}
								className="flex items-center justify-between gap-2"
							>
								<span className="text-muted-foreground">
									seat {player.seat}
								</span>
								<span className="truncate">
									{player.name}{" "}
									<span
										className={
											player.connected
												? "text-green-600 dark:text-green-400"
												: "text-destructive"
										}
									>
										{player.connected ? "●" : "○"}
									</span>
								</span>
							</div>
						))}
					</div>
				</Section>

				{match.rejection && (
					<Section title="Last Rejection">
						<Field label="reason" value={match.rejection.reason} />
						{match.rejection.message && (
							<Field
								label="message"
								value={match.rejection.message}
							/>
						)}
					</Section>
				)}

				<Section title="Game State">
					<pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 break-all whitespace-pre-wrap">
						{match.state === undefined
							? "undefined"
							: JSON.stringify(match.state, null, 2)}
					</pre>
				</Section>
			</div>
		</div>
	);
}
