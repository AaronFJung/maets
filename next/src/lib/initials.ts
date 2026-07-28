/** Up to two uppercase initials from a display name, for avatar fallbacks. */
export function initials(username: string) {
	return username
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0] ?? "")
		.join("")
		.toUpperCase();
}
