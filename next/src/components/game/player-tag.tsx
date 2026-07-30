import { seatColor, seatName } from "@/components/game/seat-palette";
import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import type { Seat } from "@/lib/maets-realtime/types";
import { cn } from "@/lib/utils";

/** Who holds a seat, as far as the UI is concerned. */
export type SeatIdentity = {
	name: string;
	avatarUrl?: string | null;
	connected?: boolean;
};

/** How a caller renders the holder of a seat. Offline play has only seat
 * colours to go on; online, `seatLabel` resolves to the real player. */
export type SeatLabel = (seat: Seat) => React.ReactNode;

/**
 * A player's name in their seat colour. Inline-flex and baseline-friendly so it
 * can sit inside a headline ("Alice is up!") rather than only in a list.
 */
export function PlayerTag({
	name,
	color,
	className,
}: {
	name: string;
	/** Seat colour, e.g. from `seatColor` — so the tag reads as "the blue
	 * player" even at a glance. */
	color?: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 align-middle",
				className,
			)}
		>
			<span
				className="font-semibold"
				style={color ? { color } : undefined}
			>
				{name}
			</span>
		</span>
	);
}

/**
 * A player's avatar, ringed in their seat colour and badged with their
 * connection state. The one place an avatar is drawn for a seat.
 */
export function PlayerAvatar({
	name,
	avatarUrl,
	connected,
	color,
	size = "default",
	className,
}: SeatIdentity & {
	/** Seat colour, e.g. from `seatColor` — drawn as the avatar's ring so the
	 * row ties back to the colour that seat plays as on the board. */
	color?: string;
	size?: "sm" | "default" | "lg";
	className?: string;
}) {
	return (
		<Avatar
			size={size}
			className={className}
			// Inline rather than a ring utility: the colour is per-seat data,
			// not one of a fixed set Tailwind could generate classes for.
			style={color ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
		>
			{avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
			<AvatarFallback>{initials(name)}</AvatarFallback>
			{connected !== undefined && (
				<AvatarBadge
					className={
						connected
							? "bg-green-600 dark:bg-green-500"
							: "bg-muted-foreground"
					}
				/>
			)}
		</Avatar>
	);
}

/** The seat's colour name — the fallback when nobody's identity is known. */
export const colorSeatLabel: SeatLabel = (seat) => (
	<PlayerTag name={seatName(seat)} color={seatColor(seat)} />
);
