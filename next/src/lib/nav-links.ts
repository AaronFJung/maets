import { Gamepad2Icon, LogInIcon } from "lucide-react";
import type { ComponentType } from "react";

export type NavLink = {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
};

export const NAV_LINKS: NavLink[] = [
	{ href: "/game/join", label: "Join Game", icon: LogInIcon },
	{ href: "/game/host", label: "Host Game", icon: Gamepad2Icon },
	// {
	// 	href: "/offline-game/tictactoe",
	// 	label: "Play Tic Tac Toe",
	// 	icon: Grid3X3Icon,
	// },
];
