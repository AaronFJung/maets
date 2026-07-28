"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
	type ProfileUpdateValues,
	profileUpdateSchema,
} from "@/lib/auth/schema";
import { initials } from "@/lib/initials";
import { updateProfile } from "./actions";

export default function AccountForm({
	username,
	avatarUrl,
}: {
	username: string;
	avatarUrl: string | null;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [saved, setSaved] = useState(false);

	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<ProfileUpdateValues>({
		resolver: zodResolver(profileUpdateSchema),
		defaultValues: { username },
	});

	function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const next = event.target.files?.[0] ?? null;
		setPreview((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return next ? URL.createObjectURL(next) : null;
		});
		setFile(next);
		setSaved(false);
	}

	async function onSubmit(values: ProfileUpdateValues) {
		setSaved(false);

		const formData = new FormData();
		formData.set("username", values.username);
		if (file) formData.set("avatar", file);

		const result = await updateProfile(formData);

		if (result.error) {
			setError("root", { message: result.error });
			return;
		}

		if (fileRef.current) fileRef.current.value = "";
		setPreview((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
		setFile(null);
		setSaved(true);
	}

	const shownAvatar = preview ?? avatarUrl ?? undefined;

	return (
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

				{saved && (
					<Alert>
						<CheckCircle2 />
						<AlertDescription>Profile saved.</AlertDescription>
					</Alert>
				)}

				<Field orientation="horizontal">
					<Avatar size="lg">
						{shownAvatar && (
							<AvatarImage src={shownAvatar} alt={username} />
						)}
						<AvatarFallback>{initials(username)}</AvatarFallback>
					</Avatar>

					<div className="flex flex-col gap-1.5">
						<input
							ref={fileRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif"
							onChange={onFileChange}
							className="hidden"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fileRef.current?.click()}
						>
							Change picture
						</Button>
						<FieldDescription>
							PNG, JPG, GIF or WebP. Max 2MB.
						</FieldDescription>
					</div>
				</Field>

				<Field data-invalid={!!errors.username}>
					<FieldLabel htmlFor="username">Username</FieldLabel>
					<Input
						id="username"
						autoComplete="username"
						{...register("username")}
					/>
					{errors.username && (
						<FieldError>{errors.username.message}</FieldError>
					)}
				</Field>

				<Field>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								Saving
								<Spinner data-icon="inline-start" />
							</>
						) : (
							"Save changes"
						)}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}
