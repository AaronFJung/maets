"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PublicProfile = {
	userId: string;
	username: string;
	avatarUrl: string | null;
};

export function useProfiles(userIds: string[]) {
	const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(
		new Map(),
	);

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
