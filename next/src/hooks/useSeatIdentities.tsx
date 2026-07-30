"use client";

import { useMemo } from "react";
import {
	colorSeatLabel,
	PlayerTag,
	type SeatIdentity,
	type SeatLabel,
} from "@/components/game/player-tag";
import { seatColor } from "@/components/game/seat-palette";
import type { MatchPlayer } from "@/hooks/useMatch";
import { useProfiles } from "@/hooks/useProfiles";
import type { Seat } from "@/lib/maets-realtime/types";

/**
 * Resolves the roster into displayable identities. The roster only carries the
 * name each player joined under (§6.2), so avatars — and any rename since —
 * come from their profiles; this is the one place those two are merged.
 */
export function useSeatIdentities(players: readonly MatchPlayer[]): {
	/** Who holds a seat, preferring their live profile over the roster's
	 * join-time name. `undefined` for an unclaimed seat. */
	identityFor: (seat: Seat) => SeatIdentity | undefined;
	/** Plain text, for prose ("Waiting for Alice to reconnect"). */
	nameFor: (seat: Seat) => string | undefined;
	/** The holder's name in their seat colour, falling back to the colour. */
	seatLabel: SeatLabel;
} {
	const profiles = useProfiles(players.map((player) => player.playerId));

	// `useMatch` rebuilds `players` with a fresh array identity on every render
	// and re-renders on every match event, so memoise against the roster's
	// *value*. Same trick `useProfiles` uses on its own inputs.
	const signature = players
		.map((p) => `${p.seat}:${p.playerId}:${p.name}:${p.connected ? 1 : 0}`)
		.join("|");

	// biome-ignore lint/correctness/useExhaustiveDependencies: `signature` is the value identity of `players`, which is a fresh array on every render
	return useMemo(() => {
		const identities = new Map<Seat, SeatIdentity>();
		for (const player of players) {
			const profile = profiles.get(player.playerId);
			identities.set(player.seat, {
				name: profile?.username ?? player.name,
				avatarUrl: profile?.avatarUrl ?? null,
				connected: player.connected,
			});
		}

		const identityFor = (seat: Seat) => identities.get(seat);

		return {
			identityFor,
			nameFor: (seat: Seat) => identities.get(seat)?.name,
			seatLabel: (seat: Seat) => {
				const identity = identities.get(seat);
				if (!identity) return colorSeatLabel(seat);
				return (
					<PlayerTag name={identity.name} color={seatColor(seat)} />
				);
			},
		};
	}, [signature, profiles]);
}
