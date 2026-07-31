"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CurrentProfile = {
	userId: string;
	username: string;
	avatarUrl: string | null;
};

export default function useProfile() {
	const [profile, setProfile] = useState<CurrentProfile>();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;
		const supabase = createClient();

		(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				if (active) setLoading(false);
				return;
			}

			const { data, error } = await supabase
				.from("profiles")
				.select("username, avatar_url")
				.eq("id", user.id)
				.single();

			if (!active) return;

			if (error) {
				console.error("useProfile failed to load profile", error);
			}

			if (data) {
				setProfile({
					userId: user.id,
					username: data.username,
					avatarUrl: data.avatar_url,
				});
			}
			setLoading(false);
		})();

		return () => {
			active = false;
		};
	}, []);

	return { profile, loading };
}
