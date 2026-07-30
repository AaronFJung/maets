"use client";

import { CheckIcon, CopyIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GamePicker } from "@/components/game/game-picker";
import type { MatchView } from "@/components/game/match-view";
import { Roster } from "@/components/game/roster";
import { Button } from "@/components/ui/button";
import { gameName } from "@/lib/games";
import { GAME_REGISTRY } from "@/lib/maets-realtime/games/registry";

/** A label and a hairline rule. The whole lobby is one flat column of these. */
function Section({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section>
			<div className="mb-1 flex items-baseline justify-between gap-3 border-b pb-2">
				<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					{title}
				</h2>
				{aside && (
					<span className="text-xs text-muted-foreground">
						{aside}
					</span>
				)}
			</div>
			{children}
		</section>
	);
}

/** The pre-game screen: who's here, what's being played, and who can start it. */
export function LobbyView({
	lobbyCode,
	gameId,
	match,
}: {
	lobbyCode: string;
	/** The game the room means to run: `?game=` for the host, otherwise the
	 * last game played (§12.7). Only a starting point: the host can pick a
	 * different one from here. */
	gameId?: string;
	match: MatchView;
}) {
	const {
		seat,
		isHost,
		players,
		hostSeat,
		hostName,
		spectators,
		identityFor,
	} = match;

	const [picked, setPicked] = useState<string>();
	const [copied, setCopied] = useState(false);

	// The host's own pick wins once they make one; until then the room shows
	// whatever it already meant to play.
	const choice =
		picked ?? (gameId && GAME_REGISTRY[gameId] ? gameId : undefined);
	// Requires a known plugin: a `?game=` this build doesn't have would
	// otherwise enable Start, and `selectGame` would silently drop the click.
	const plugin = choice ? GAME_REGISTRY[choice] : undefined;
	const canStart = plugin !== undefined && players.length >= plugin.seats.min;

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(lobbyCode);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard access needs a secure context; the code is on screen
			// anyway, so there's nothing to recover from
		}
	}

	function status() {
		if (!isHost)
			return `Waiting for ${hostName ?? "the host"} to start a game.`;
		if (!plugin) return "Pick a game to get started.";
		if (!canStart) return `Need at least ${plugin.seats.min} players.`;
		return "Everyone's here. Start whenever you're ready.";
	}

	return (
		<div className="flex flex-col gap-8 pt-6 pb-10">
			{/* The code *is* the heading: it's the one thing on this screen
			    anyone needs to read out loud. */}
			<div>
				<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Lobby code
				</p>
				<div className="mt-1.5 flex flex-wrap items-center gap-4">
					<h1 className="font-mono text-4xl font-bold tracking-[0.15em] sm:text-5xl">
						{lobbyCode}
					</h1>
					<Button variant="outline" onClick={copyCode}>
						{copied ? <CheckIcon /> : <CopyIcon />}
						{copied ? "Copied" : "Copy code"}
					</Button>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Share this code so others can join from Join Game.
				</p>
			</div>

			<Section
				title="Players"
				aside={
					plugin
						? `${players.length} of ${plugin.seats.max}`
						: players.length
				}
			>
				<Roster
					players={players}
					identityFor={identityFor}
					hostSeat={hostSeat}
					mySeat={seat}
					minSeats={plugin?.seats.min}
				/>
				{(spectators > 0 || seat === null) && (
					<p className="pt-3 text-sm text-muted-foreground">
						{seat === null
							? "You're spectating. The seats are full."
							: `${spectators} watching without a seat.`}
					</p>
				)}
			</Section>

			<Section
				title="Game"
				aside={
					isHost ? "You choose" : `${hostName ?? "The host"} chooses`
				}
			>
				<GamePicker
					value={choice}
					onSelect={isHost ? setPicked : undefined}
					playerCount={players.length}
				/>
			</Section>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
				<p className="text-sm text-muted-foreground">{status()}</p>
				<div className="flex items-center gap-2">
					<Button variant="ghost" asChild>
						<Link href="/">Leave</Link>
					</Button>
					{isHost && (
						<Button
							size="lg"
							disabled={!canStart}
							onClick={() => choice && match.selectGame(choice)}
						>
							<PlayIcon />
							{choice ? `Start ${gameName(choice)}` : "Start"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
