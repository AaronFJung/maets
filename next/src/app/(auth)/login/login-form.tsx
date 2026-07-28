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
import { type LoginValues, loginSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
	const router = useRouter();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	async function onSubmit(values: LoginValues) {
		const supabase = createClient();
		const { error } = await supabase.auth.signInWithPassword(values);

		if (error) {
			setError("root", { message: "Invalid email or password." });
			return;
		}

		router.push("/");
		router.refresh();
	}

	return (
		<>
			<PageTitle>Log in</PageTitle>

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
							autoComplete="current-password"
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
									Logging in
									<Spinner data-icon="inline-start" />
								</>
							) : (
								"Log in"
							)}
						</Button>
					</Field>

					<FieldDescription>
						Don't have an account?{" "}
						<Link href="/signup">Sign up</Link>
					</FieldDescription>
				</FieldGroup>
			</form>
		</>
	);
}
