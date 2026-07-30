import { CrownIcon, UserRoundIcon } from "lucide-react";
import { PlayerAvatar, type SeatIdentity } from "@/components/game/player-tag";
import { seatColor } from "@/components/game/seat-palette";
import type { MatchPlayer } from "@/hooks/useMatch";
import type { Seat } from "@/lib/maets-realtime/types";

/** One row per seated player, plus ghost rows for the seats a game still needs. */
export function Roster({
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
	/** Ghost rows are drawn up to this count (the chosen game's `seats.min`).
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
		<ul className="divide-y divide-border">
			{players.map((player) => {
				const identity = identityFor(player.seat);
				const name = identity?.name ?? player.name;

				return (
					<li
						key={player.seat}
						className="flex items-center gap-3 py-3"
					>
						<PlayerAvatar
							name={name}
							avatarUrl={identity?.avatarUrl}
							connected={player.connected}
							color={seatColor(player.seat)}
						/>
						<span className="min-w-0 flex-1 truncate text-sm font-medium">
							{name}
							{player.seat === mySeat && (
								<span className="ml-2 font-normal text-muted-foreground">
									you
								</span>
							)}
						</span>
						{!player.connected && (
							<span className="text-xs text-muted-foreground">
								Disconnected
							</span>
						)}
						{player.seat === hostSeat && (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<CrownIcon className="size-3.5" />
								Host
							</span>
						)}
					</li>
				);
			})}

			{openSeats.map((openSeat) => (
				<li
					key={`open-${openSeat}`}
					className="flex items-center gap-3 py-3 text-muted-foreground"
				>
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed">
						<UserRoundIcon className="size-3.5" />
					</div>
					<span className="text-sm">Waiting for a player…</span>
				</li>
			))}
		</ul>
	);
}
