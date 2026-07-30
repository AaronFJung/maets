"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PublicProfile = {
	userId: string;
	username: string;
	avatarUrl: string | null;
};

/**
 * Profiles for other users, keyed by user id — the client-side counterpart to
 * `getProfilesByIds` (which is `server-only`). Ids without a profile are simply
 * absent from the map, so callers should keep a fallback for them.
 *
 * The realtime roster only carries the name each player joined under (§6.2), so
 * this is what supplies avatars for anyone other than the signed-in user.
 */
export function useProfiles(userIds: string[]) {
	const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(
		new Map(),
	);

	// Depend on the id *set*, not the array identity: callers build this list
	// fresh on every render from the roster, which re-renders on every presence
	// tick.
	const key = [...new Set(userIds)].sort().join(",");

	useEffect(() => {
		const ids = key ? key.split(",") : [];
		if (ids.length === 0) {
			setProfiles(new Map());
			return;
		}

		let active = true;
		(async () => {
			const supabase = createClient();
			const { data, error } = await supabase
				.from("profiles")
				.select("id, username, avatar_url")
				.in("id", ids);

			if (!active) return;

			if (error) {
				// Non-fatal: callers fall back to the roster's join-time names.
				console.error("useProfiles failed to load profiles", error);
				return;
			}

			setProfiles(
				new Map(
					data.map((row) => [
						row.id,
						{
							userId: row.id,
							username: row.username,
							avatarUrl: row.avatar_url,
						},
					]),
				),
			);
		})();

		return () => {
			active = false;
		};
	}, [key]);

	return profiles;
}
