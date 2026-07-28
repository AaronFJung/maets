import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
	id: string;
	username: string;
	avatarUrl: string | null;
};

/**
 * The current authenticated user, or null. Memoized per request render.
 */
export const getUser = cache(async () => {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
});

/**
 * Like getUser, but redirects to /login when there is no session. Use in
 * Server Components / Server Actions that require an authenticated user.
 */
export const verifySession = cache(async () => {
	const user = await getUser();
	if (!user) redirect("/login");
	return user;
});

/**
 * The current user's profile (id, username, avatar), or null when signed out.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
	const user = await getUser();
	if (!user) return null;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("id, username, avatar_url")
		.eq("id", user.id)
		.single();

	if (error) {
		console.error("getProfile failed", error);
		return null;
	}

	if (!data) return null;

	return {
		id: data.id,
		username: data.username,
		avatarUrl: data.avatar_url,
	};
});

/**
 * Profiles for the given user ids, keyed by id. Any id without a profile is
 * simply absent from the map. Requires a session: the profiles select policy is
 * scoped to `authenticated`, so this returns an empty map when signed out.
 */
export async function getProfilesByIds(
	userIds: string[],
): Promise<Map<string, Profile>> {
	const ids = [...new Set(userIds)];
	if (ids.length === 0) return new Map();

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("id, username, avatar_url")
		.in("id", ids);

	if (error) {
		console.error("getProfilesByIds failed", error);
		return new Map();
	}

	return new Map(
		data.map((row) => [
			row.id,
			{ id: row.id, username: row.username, avatarUrl: row.avatar_url },
		]),
	);
}
