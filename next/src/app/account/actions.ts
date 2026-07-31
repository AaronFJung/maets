"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { verifySession } from "@/lib/auth/dal";
import { profileUpdateSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UpdateProfileResult = { error?: string; success?: boolean };

function storagePathFromPublicUrl(url: string): string | null {
	const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
	const index = url.indexOf(marker);
	if (index === -1) return null;
	return url.slice(index + marker.length);
}

export async function updateProfile(
	formData: FormData,
): Promise<UpdateProfileResult> {
	const user = await verifySession();
	const supabase = await createClient();

	const parsed = profileUpdateSchema.safeParse({
		username: formData.get("username"),
	});
	if (!parsed.success) {
		return {
			error: parsed.error.issues[0]?.message ?? "Invalid username.",
		};
	}
	const { username } = parsed.data;

	const file = formData.get("avatar");
	const hasFile = file instanceof File && file.size > 0;

	let newAvatarUrl: string | undefined;
	let previousAvatarUrl: string | null = null;

	if (hasFile) {
		if (file.size > MAX_UPLOAD_BYTES) {
			return { error: "Image is too large (max 5MB)." };
		}

		// Remember the current avatar so we can delete it after a successful swap.
		const { data: current } = await supabase
			.from("profiles")
			.select("avatar_url")
			.eq("id", user.id)
			.single();

		previousAvatarUrl = current?.avatar_url ?? null;

		let processed: Buffer;
		try {
			const input = Buffer.from(await file.arrayBuffer());
			processed = await sharp(input)
				.rotate() // honor EXIF orientation before metadata is dropped
				.resize(256, 256, { fit: "cover" })
				.webp()
				.toBuffer();
		} catch {
			return { error: "That file could not be processed as an image." };
		}

		const path = `${user.id}/avatar-${Date.now()}.webp`;
		const { error: uploadError } = await supabase.storage
			.from(AVATAR_BUCKET)
			.upload(path, processed, {
				contentType: "image/webp",
				upsert: false,
			});

		if (uploadError) {
			return { error: "Failed to upload image." };
		}

		newAvatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
			.data.publicUrl;
	}

	const { error: updateError } = await supabase
		.from("profiles")
		.update({
			username,
			...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
		})
		.eq("id", user.id);

	if (updateError) {
		// Roll back the freshly uploaded file if the row update failed.
		if (newAvatarUrl) {
			const orphan = storagePathFromPublicUrl(newAvatarUrl);
			if (orphan) {
				await supabase.storage.from(AVATAR_BUCKET).remove([orphan]);
			}
		}
		if (updateError.code === "23505") {
			return { error: "That username is already taken." };
		}
		return { error: "Failed to save your profile." };
	}

	// New avatar is live, so delete the old one to avoid accumulating files.
	if (newAvatarUrl && previousAvatarUrl) {
		const oldPath = storagePathFromPublicUrl(previousAvatarUrl);
		if (oldPath) {
			await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
		}
	}

	revalidatePath("/account");
	revalidatePath("/");
	return { success: true };
}
