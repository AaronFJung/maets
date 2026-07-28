import { z } from "zod";

// minimum_password_length = 6 in supabase/config.toml
export const passwordSchema = z
	.string()
	.min(6, "Password must be at least 6 characters.");

export const emailSchema = z
	.string()
	.trim()
	.email("Enter a valid email address.");

// Matches the check constraint on public.profiles.username (3–24 chars).
export const usernameSchema = z
	.string()
	.trim()
	.min(3, "Username must be at least 3 characters.")
	.max(24, "Username must be at most 24 characters.");

export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});

export const signupSchema = z.object({
	username: usernameSchema,
	email: emailSchema,
	password: passwordSchema,
});

export const profileUpdateSchema = z.object({
	username: usernameSchema,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>;
