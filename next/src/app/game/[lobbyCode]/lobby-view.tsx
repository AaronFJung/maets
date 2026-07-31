"use client";

import type { Seat } from "@maets/game-sync";
import { GAME_REGISTRY } from "@maets/games";
import {
	CheckIcon,
	CopyIcon,
	CrownIcon,
	Gamepad2Icon,
	PlayIcon,
	UserRoundIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { gamePreviewFor } from "@/components/game/game-previews";
import type { MatchView } from "@/components/game/match-view";
import {
	PlayerAvatar,
	type SeatIdentity,
	seatColor,
} from "@/components/game/seat";
import { Button } from "@/components/ui/button";
import type { MatchPlayer } from "@/hooks/useMatch";
import { GAMES, gameName } from "@/lib/games";
import { cn } from "@/lib/utils";
import { LobbyCodeHeading } from "./lobby-code-heading";

/** The games this build can actually run. A `GAMES` entry with no plugin could
 * never be started, so it never reaches the picker. Filtered once at module
 * scope rather than per render. */
const PLAYABLE = GAMES.filter((game) => GAME_REGISTRY[game.id]);

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

/**
 * The pre-game screen, in two steps: the host picks a game, then the room
 * gathers around it. One thing on screen at a time — a host who hasn't chosen
 * yet has no use for a roster, and once they have, the game is settled.
 *
 * Only the host steps. A guest has no way to know what's been picked (§12.7 has
 * no lobby-phase "intended game"), so they sit on the second step throughout.
 */
export function LobbyView({
	lobbyCode,
	gameId,
	match,
}: {
	lobbyCode: string;
	/** The game the room means to run — the last one played (§12.7). Only a
	 * starting point: the host can pick a different one from here. */
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
	// Requires a known plugin: a game this build doesn't have would otherwise
	// enable Start, and `selectGame` would silently drop the click.
	const plugin = choice ? GAME_REGISTRY[choice] : undefined;
	const canStart = plugin !== undefined && players.length >= plugin.seats.min;

	// Guests never step: with nothing to tell them what the host is choosing,
	// the picker would just be an empty wait.
	const choosing = isHost && plugin === undefined;

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
		if (!canStart) return `Need at least ${plugin?.seats.min} players.`;
		return "Everyone's here. Start whenever you're ready.";
	}

	return (
		<div className="flex flex-col gap-8">
			{/* The code *is* the heading: it's the one thing on this screen
			    anyone needs to read out loud. */}
			<div>
				<LobbyCodeHeading code={lobbyCode}>
					<Button variant="outline" onClick={copyCode}>
						{copied ? <CheckIcon /> : <CopyIcon />}
						{copied ? "Copied" : "Copy code"}
					</Button>
				</LobbyCodeHeading>
				<p className="mt-2 text-sm text-muted-foreground">
					Share this code so others can join from Join Game.
				</p>
			</div>

			{choosing ? (
				<Section title="Pick a game">
					<GamePicker
						value={choice}
						onSelect={setPicked}
						playerCount={players.length}
					/>
				</Section>
			) : (
				<>
					<Section
						title="Game"
						aside={
							isHost ? (
								<button
									type="button"
									onClick={() => setPicked(undefined)}
									className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									Change
								</button>
							) : (
								`${hostName ?? "The host"} chooses`
							)
						}
					>
						<p className="py-3 font-serif text-2xl font-semibold">
							{choice ? gameName(choice) : "No game picked yet"}
						</p>
					</Section>

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
				</>
			)}

			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
				<p className="text-sm text-muted-foreground">
					{choosing ? "Pick a game to get started." : status()}
				</p>
				<div className="flex items-center gap-2">
					<Button variant="ghost" asChild>
						<Link href="/">Leave</Link>
					</Button>
					{isHost && !choosing && (
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

/** One card per seat, plus ghost cards for the seats a game still needs. */
function Roster({
	players,
	identityFor,
	hostSeat,
	mySeat,
	minSeats,
}: {
	players: readonly MatchPlayer[];
	identityFor: (seat: Seat) => SeatIdentity | undefined;
	/** Seat of the current sequencer, marked with a crown. */
	hostSeat?: Seat;
	/** This client's seat, marked "you". `null` while spectating. */
	mySeat: Seat | null;
	/** Ghost cards are drawn up to this count (the chosen game's `seats.min`).
	 * Omitted when no game is known yet, so no placeholders appear. */
	minSeats?: number;
}) {
	// Seat numbers are assigned in order from 0 (§9.1), so the seats a game is
	// still short of are the ones just past the last claimed seat.
	const openSeats = Array.from(
		{ length: Math.max(0, (minSeats ?? 0) - players.length) },
		(_, index) => players.length + index,
	);

	return (
		<ul className="flex flex-col gap-3 pt-3">
			{players.map((player) => {
				const identity = identityFor(player.seat);
				const name = identity?.name ?? player.name;
				const color = seatColor(player.seat);

				return (
					<motion.li
						key={player.seat}
						layout
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						className="flex items-center gap-4 rounded-xl border bg-card p-4"
						// A hairline of the seat's colour down the left edge, so
						// a card ties back to the colour it plays as.
						style={{ borderLeft: `4px solid ${color}` }}
					>
						<PlayerAvatar
							size="lg"
							name={name}
							avatarUrl={identity?.avatarUrl}
							connected={player.connected}
							color={color}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-semibold">{name}</p>
							<p className="text-xs text-muted-foreground">
								{player.seat === mySeat && "you"}
								{player.seat === mySeat &&
									!player.connected &&
									" · "}
								{!player.connected && "Disconnected"}
							</p>
						</div>
						{player.seat === hostSeat && (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<CrownIcon className="size-3.5" />
								Host
							</span>
						)}
					</motion.li>
				);
			})}

			{openSeats.map((openSeat) => (
				<li
					key={`open-${openSeat}`}
					className="flex animate-pulse items-center gap-4 rounded-xl border border-dashed p-4 text-muted-foreground"
				>
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed">
						<UserRoundIcon className="size-5" />
					</div>
					<p className="text-sm">Waiting for a player…</p>
				</li>
			))}
		</ul>
	);
}

/**
 * The lobby's game grid — a still of each board rather than a name in a list,
 * so picking a game looks like picking a game. Host-only (§12.7); nobody else
 * ever reaches this step.
 */
function GamePicker({
	value,
	onSelect,
	playerCount,
}: {
	/** The currently chosen game id, if any. */
	value?: string;
	onSelect: (gameId: string) => void;
	/** Seated players, so a game the room is still too small for says so. */
	playerCount: number;
}) {
	return (
		<div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3">
			{PLAYABLE.map((game) => {
				const { seats } = GAME_REGISTRY[game.id];
				const selected = game.id === value;
				// Still selectable, because the host may pick a game and then wait for
				// people to arrive. Faded only so a room that's short-handed can
				// see at a glance which games it can't reach yet.
				const short = playerCount < seats.min;
				const preview = gamePreviewFor(game.id);

				return (
					<motion.button
						key={game.id}
						type="button"
						onClick={() => onSelect(game.id)}
						whileHover={{ y: -3 }}
						whileTap={{ scale: 0.97 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
						className={cn(
							"flex flex-col gap-3 rounded-xl border bg-card p-4 text-left outline-none transition-shadow",
							"hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
							selected && "ring-2 ring-primary",
							short && "opacity-60",
						)}
					>
						<div className="flex aspect-square items-center justify-center rounded-lg bg-muted p-3">
							{preview ?? (
								<Gamepad2Icon className="size-10 text-muted-foreground" />
							)}
						</div>
						<div>
							<p className="font-serif font-semibold">
								{game.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{seats.min === seats.max
									? `${seats.min} players`
									: `${seats.min}–${seats.max} players`}
							</p>
						</div>
					</motion.button>
				);
			})}
		</div>
	);
}
