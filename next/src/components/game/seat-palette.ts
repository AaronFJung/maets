import type { Seat } from "@/lib/maets-realtime/types";

/**
 * Seat colours belong to the seat, not to any one game — every board and every
 * roster row tints seat 0 the same blue. Kept free of JSX so the lobby chrome
 * can colour a seat without importing a game.
 */
export const SEAT_COLORS = ["#3336e8", "#e8203e"] as const;

/** What to call a seat when nobody's identity is known. */
export const SEAT_NAMES = ["Blue", "Red"] as const;

// Wrapping keeps these total for any seat number. Games with more seats than
// colours will repeat rather than render undefined.
export const seatColor = (seat: Seat): string =>
	SEAT_COLORS[seat % SEAT_COLORS.length];

export const seatName = (seat: Seat): string =>
	SEAT_NAMES[seat % SEAT_NAMES.length];
