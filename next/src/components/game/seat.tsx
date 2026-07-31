import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { Seat } from "@maets/game-sync";

export const SEAT_COLORS = ["#3336e8", "#e8203e"] as const;

export const SEAT_NAMES = ["Blue", "Red"] as const;

export const seatColor = (seat: Seat): string =>
	SEAT_COLORS[seat % SEAT_COLORS.length];

export const seatName = (seat: Seat): string =>
	SEAT_NAMES[seat % SEAT_NAMES.length];

export type SeatIdentity = {
	name: string;
	avatarUrl?: string | null;
	connected?: boolean;
};

export type SeatLabel = (seat: Seat) => React.ReactNode;

export function PlayerTag({
	name,
	color,
	className,
}: {
	name: string;
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

export function PlayerAvatar({
	name,
	avatarUrl,
	connected,
	color,
	size = "default",
	className,
}: SeatIdentity & {
	color?: string;
	size?: "sm" | "default" | "lg";
	className?: string;
}) {
	return (
		<Avatar
			size={size}
			className={className}
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

export const colorSeatLabel: SeatLabel = (seat) => (
	<PlayerTag name={seatName(seat)} color={seatColor(seat)} />
);

export function SeatRail({
	seat,
	identity,
	waiting,
	className,
}: {
	seat: Seat;
	identity?: SeatIdentity;
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
