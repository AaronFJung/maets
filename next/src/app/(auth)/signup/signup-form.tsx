"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { PageTitle } from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type SignupValues, signupSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
	const router = useRouter();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<SignupValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: { username: "", email: "", password: "" },
	});

	async function onSubmit(values: SignupValues) {
		const supabase = createClient();
		const { error } = await supabase.auth.signUp({
			email: values.email,
			password: values.password,
			options: { data: { username: values.username } },
		});

		if (error) {
			const message = error.message.toLowerCase();
			if (message.includes("already registered")) {
				setError("email", {
					message: "An account with this email already exists.",
				});
			} else if (message.includes("database error")) {
				// The signup trigger rejected the profile insert, almost always
				// a duplicate username (length is validated client-side).
				setError("username", {
					message: "That username is already taken.",
				});
			} else {
				setError("root", { message: error.message });
			}
			return;
		}

		router.push("/");
		router.refresh();
	}

	return (
		<>
			<PageTitle>Create your account</PageTitle>

			<form onSubmit={handleSubmit(onSubmit)}>
				<FieldGroup>
					{errors.root && (
						<Alert>
							<AlertTriangle />
							<AlertDescription>
								{errors.root.message}
							</AlertDescription>
						</Alert>
					)}

					<Field data-invalid={!!errors.username}>
						<FieldLabel htmlFor="username">Username</FieldLabel>
						<Input
							id="username"
							autoComplete="username"
							{...register("username")}
						/>
						<FieldDescription>
							3 to 24 characters. Shown to other players.
						</FieldDescription>
						{errors.username && (
							<FieldError>{errors.username.message}</FieldError>
						)}
					</Field>

					<Field data-invalid={!!errors.email}>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							{...register("email")}
						/>
						{errors.email && (
							<FieldError>{errors.email.message}</FieldError>
						)}
					</Field>

					<Field data-invalid={!!errors.password}>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							autoComplete="new-password"
							{...register("password")}
						/>
						{errors.password && (
							<FieldError>{errors.password.message}</FieldError>
						)}
					</Field>

					<Field>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? (
								<>
									Creating account
									<Spinner data-icon="inline-start" />
								</>
							) : (
								"Sign up"
							)}
						</Button>
					</Field>

					<FieldDescription>
						Already have an account?{" "}
						<Link href="/login">Log in</Link>
					</FieldDescription>
				</FieldGroup>
			</form>
		</>
	);
}
