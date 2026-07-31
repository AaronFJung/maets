"use client";

import { matchChannelName, PROTOCOL_VERSION } from "@maets/game-sync";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import z from "zod";
import { createClient } from "@/lib/supabase/client";

const LobbyPresenceSchema = z.object({
	playerId: z.string(),
	username: z.string(),
	avatarUrl: z.string().optional(),
	joinedAt: z.number(),
	v: z.number(),
});

export type LobbyPresence = z.infer<typeof LobbyPresenceSchema>;

export type LobbyMember = LobbyPresence & { isHost: boolean };

export type LobbyStatus = "connecting" | "joined" | "error";

export function useLobby({
	lobbyCode,
	playerId,
	username,
	avatarUrl,
}: {
	lobbyCode: string;
	playerId?: string;
	username?: string;
	avatarUrl?: string;
}) {
	const [members, setMembers] = useState<LobbyMember[]>([]);
	const [status, setStatus] = useState<LobbyStatus>("connecting");
	const [error, setError] = useState<string>();
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		if (!lobbyCode || !playerId || !username || username.length === 0)
			return;

		const supabase = createClient();
		const channel = supabase.realtime.channel(matchChannelName(lobbyCode), {
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
					avatarUrl,
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
	}, [lobbyCode, playerId, username, avatarUrl]);

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
