"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import z from "zod";

export const PROTOCOL_VERSION = 1;
export const CHANNEL_PREFIX = "maets:v1:match:";

export function lobbyChannelName(code: string) {
	return `${CHANNEL_PREFIX}${code.toUpperCase()}`;
}

const LobbyPresenceSchema = z.object({
	playerId: z.string(),
	username: z.string(),
	joinedAt: z.number(),
	v: z.number(),
});

export type LobbyPresence = z.infer<typeof LobbyPresenceSchema>;

export type LobbyMember = LobbyPresence & { isHost: boolean };

export type LobbyStatus = "connecting" | "joined" | "error";

/**
 * Stage 1 of the Maets protocol: a presence-only lobby roster.
 *
 * The roster is re-derived from `presenceState()` on every presence event, so
 * there are no deltas to drift. The host is whoever joined first, which every
 * client computes identically from the same presence payloads — no election
 * messages needed.
 */
export function useLobby({
	lobbyCode,
	playerId,
	username,
}: {
	lobbyCode: string;
	playerId?: string;
	username?: string;
}) {
	const [members, setMembers] = useState<LobbyMember[]>([]);
	const [status, setStatus] = useState<LobbyStatus>("connecting");
	const [error, setError] = useState<string>();
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		if (!lobbyCode || !playerId || !username || username.length === 0)
			return;

		const supabase = createClient();
		const channel = supabase.realtime.channel(lobbyChannelName(lobbyCode), {
			config: {
				broadcast: { self: false },
				// a reconnect re-registers under the same key rather than duplicating
				presence: { key: playerId },
			},
		});

		const joinedAt = Date.now();

		function syncMembers() {
			const present: LobbyPresence[] = [];

			for (const entries of Object.values(channel.presenceState())) {
				for (const entry of entries) {
					const result = LobbyPresenceSchema.safeParse(entry);
					if (result.success) present.push(result.data);
				}
			}

			// one player in two tabs can briefly appear twice; keep their earliest
			const byPlayerId = new Map<string, LobbyPresence>();
			for (const member of present) {
				const seen = byPlayerId.get(member.playerId);
				if (!seen || member.joinedAt < seen.joinedAt) {
					byPlayerId.set(member.playerId, member);
				}
			}

			const sorted = [...byPlayerId.values()].sort(
				(a, b) =>
					a.joinedAt - b.joinedAt ||
					a.playerId.localeCompare(b.playerId),
			);

			setMembers(
				sorted.map((member, index) => ({
					...member,
					isHost: index === 0,
				})),
			);
		}

		channel
			.on("presence", { event: "sync" }, syncMembers)
			.on("presence", { event: "join" }, syncMembers)
			.on("presence", { event: "leave" }, syncMembers);

		channel.subscribe((subscribeStatus) => {
			if (subscribeStatus === "SUBSCRIBED") {
				const presence: LobbyPresence = {
					playerId,
					username,
					joinedAt,
					v: PROTOCOL_VERSION,
				};
				channel.track(presence);
				setError(undefined);
				setStatus("joined");
			} else if (
				subscribeStatus === "CHANNEL_ERROR" ||
				subscribeStatus === "TIMED_OUT"
			) {
				setStatus("error");
				setError(subscribeStatus);
			}
		});

		channelRef.current = channel;

		return () => {
			channel.unsubscribe();
			channelRef.current = null;
			setMembers([]);
			setError(undefined);
			setStatus("connecting");
		};
	}, [lobbyCode, playerId, username]);

	const leave = useCallback(() => {
		channelRef.current?.unsubscribe();
		channelRef.current = null;
		setMembers([]);
		setError(undefined);
		setStatus("connecting");
	}, []);

	const host = members[0] ?? null;

	return {
		members,
		memberCount: members.length,
		host,
		isHost: host?.playerId === playerId,
		// only meaningful once status === "joined" and presence has synced
		lobbyExists: members.some((member) => member.playerId !== playerId),
		status,
		leave,
		error,
	};
}
