import { Gamepad2Icon, LogInIcon } from "lucide-react";
import type { ComponentType } from "react";

export type NavLink = {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
};

export const NAV_LINKS: NavLink[] = [
	{ href: "/game/join", label: "Join Game", icon: LogInIcon },
];

/** Hosting has no page of its own — it mints a lobby code and routes into the
 * room, where the game actually gets picked. The label and icon live here
 * anyway so both navs keep dressing it like the links beside it. */
export const HOST_GAME = { label: "Host Game", icon: Gamepad2Icon };
