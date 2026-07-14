export type NavLink = {
	href: string;
	label: string;
};

export const NAV_LINKS: NavLink[] = [
	{ href: "/game/join", label: "Join Game" },
	{ href: "/game/host", label: "Host Game" },
];
