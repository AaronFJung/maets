import { PlayerAvatar, type SeatIdentity } from "@/components/game/player-tag";
import { seatColor } from "@/components/game/seat-palette";
import type { MatchPlayer } from "@/hooks/useMatch";
import type { Seat } from "@/lib/maets-realtime/types";

/**
 * The persistent bar above a board: which room this is, and who's in it. The
 * lobby draws both of those at full size, so it hides this and owns the screen;
 * everywhere else the board leaves no room for them.
 *
 * Avatars rather than names: a game that flanks its board with seats (see
 * `SeatRail`) would otherwise print every player's name twice on one screen.
 */
export function MatchHeader({
	lobbyCode,
	players,
	identityFor,
}: {
	lobbyCode: string;
	players: readonly MatchPlayer[];
	identityFor: (seat: Seat) => SeatIdentity | undefined;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-b pb-3">
			{/* Same label-over-mono treatment the lobby gives the code, shrunk:
			    the room reads as the same object in both places. */}
			<p className="flex items-baseline gap-2">
				<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Lobby
				</span>
				<span className="font-mono text-sm font-bold tracking-[0.15em]">
					{lobbyCode}
				</span>
			</p>

			<div className="flex items-center gap-1.5">
				{players.map((player) => {
					const identity = identityFor(player.seat);
					const name = identity?.name ?? player.name;

					return (
						<span key={player.seat} title={name}>
							<PlayerAvatar
								size="sm"
								name={name}
								avatarUrl={identity?.avatarUrl}
								connected={player.connected}
								color={seatColor(player.seat)}
							/>
						</span>
					);
				})}
			</div>
		</div>
	);
}
