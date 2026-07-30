import { PlayerAvatar, type SeatIdentity } from "@/components/game/player-tag";
import { seatColor, seatName } from "@/components/game/seat-palette";
import type { Seat } from "@/lib/maets-realtime/types";
import { cn } from "@/lib/utils";

/**
 * One seat standing beside the board it plays on — avatar, name, and whether
 * the game is currently waiting on them. Pair two of these into `GameShell`'s
 * `asideStart`/`asideEnd` to flank a board with its players.
 */
export function SeatRail({
	seat,
	identity,
	waiting,
	className,
}: {
	seat: Seat;
	/** Who holds it. `undefined` for a seat nobody has claimed, which falls
	 * back to the seat's colour name. */
	identity?: SeatIdentity;
	/** Whether the game is waiting on this seat. The seat that isn't recedes,
	 * so the board reads as "it's their move" without reading the headline. */
	waiting?: boolean;
	className?: string;
}) {
	const color = seatColor(seat);
	const name = identity?.name ?? seatName(seat);

	return (
		<div
			className={cn(
				"flex w-16 shrink-0 flex-col items-center gap-2 text-center transition-opacity duration-300 sm:w-20",
				waiting ? "opacity-100" : "opacity-45",
				className,
			)}
		>
			<PlayerAvatar
				name={name}
				avatarUrl={identity?.avatarUrl}
				connected={identity?.connected}
				color={color}
				className={cn(
					"transition-transform duration-300",
					waiting && "scale-110",
				)}
			/>
			{/* Wraps rather than truncates: a rail is narrow enough that
			    "Isabella Sosa" would otherwise read as "Isabella ...", which
			    tells you less than the two lines it fits in. */}
			<span
				className="line-clamp-2 w-full text-xs leading-tight font-semibold break-words"
				style={{ color }}
				title={name}
			>
				{name}
			</span>
		</div>
	);
}
