"use client";

import { CheckIcon } from "lucide-react";
import { GAMES } from "@/lib/games";
import { GAME_REGISTRY } from "@/lib/maets-realtime/games/registry";
import { cn } from "@/lib/utils";

/** The games this build can actually run. A `GAMES` entry with no plugin could
 * never be started, so it never reaches the picker. */
const PLAYABLE = GAMES.filter((game) => GAME_REGISTRY[game.id]);

/**
 * The lobby's game list. Choosing is host-only (§12.7), so `onSelect` is
 * omitted for everyone else and the rows render as a plain read-only list of
 * what the room can play.
 */
export function GamePicker({
	value,
	onSelect,
	playerCount,
}: {
	/** The currently chosen game id, if any. */
	value?: string;
	/** Host-only; omit to render the list read-only. */
	onSelect?: (gameId: string) => void;
	/** Seated players, so a game the room is still too small for says so. */
	playerCount: number;
}) {
	return (
		<ul className="divide-y divide-border">
			{PLAYABLE.map((game) => {
				const { seats } = GAME_REGISTRY[game.id];
				const selected = game.id === value;
				// Still selectable, because the host may pick a game and then wait for
				// people to arrive. Faded only so a room that's short-handed can
				// see at a glance which games it can't reach yet.
				const short = playerCount < seats.min;

				const row = (
					<>
						<CheckIcon
							className={cn(
								"size-4 shrink-0 text-primary",
								!selected && "invisible",
							)}
						/>
						<span className="flex-1 truncate text-sm font-medium">
							{game.name}
						</span>
						<span className="text-xs text-muted-foreground">
							{seats.min === seats.max
								? `${seats.min} players`
								: `${seats.min}–${seats.max} players`}
						</span>
					</>
				);

				return (
					<li key={game.id} className={cn(short && "opacity-60")}>
						{onSelect ? (
							<button
								type="button"
								onClick={() => onSelect(game.id)}
								className="flex w-full items-center gap-3 py-3 text-left transition-colors outline-none hover:text-primary focus-visible:text-primary"
							>
								{row}
							</button>
						) : (
							<div
								className={cn(
									"flex items-center gap-3 py-3",
									!selected && "text-muted-foreground",
								)}
							>
								{row}
							</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
