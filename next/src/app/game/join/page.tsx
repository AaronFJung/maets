"use client";

import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import useLocalPlayerId from "@/hooks/useLocalPlayerId";
import { CODE_LENGTH } from "@/lib/maets-realtime/lobby-code";
import { useLobby } from "@/lib/maets-realtime/maets-realtime";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useEffect, useState } from "react";

// presence takes a beat to sync, so a live lobby looks empty right after
// subscribing; only call a code dead once it has stayed empty this long
const PROBE_SETTLE_MS = 1500;

// checking a code means occupying its channel, so the probe needs *a* name;
// the player's real one belongs to whatever happens after the lobby is found
const PROBE_USERNAME = ".";

export default function Page() {
	const [code, setCode] = useState("");
	const [probeCode, setProbeCode] = useState("");
	const [notFound, setNotFound] = useState("");

	const router = useRouter();
	const playerId = useLocalPlayerId();

	const isComplete = code.length === CODE_LENGTH;
	const isChecking = probeCode.length > 0;

	const { lobbyExists, status, error } = useLobby({
		lobbyCode: probeCode,
		playerId,
		username: PROBE_USERNAME,
	});

	// the hook only reports transport failures; an empty lobby is not one
	const message = notFound || error;

	useEffect(() => {
		if (!probeCode) return;

		if (status === "error") {
			setProbeCode("");
			return;
		}

		if (status !== "joined") return;

		if (lobbyExists) {
			// Leaving this page unmounts the hook, which drops the probe's
			// subscription; the lobby page re-joins under the real username.
			router.push(`/game/${probeCode}`);
			return;
		}

		const timer = setTimeout(() => {
			setNotFound(`No lobby is using the code ${probeCode}.`);
			setProbeCode("");
		}, PROBE_SETTLE_MS);

		return () => clearTimeout(timer);
	}, [probeCode, status, lobbyExists, router]);

	function joinLobby(lobbyCode: string) {
		if (lobbyCode.length !== CODE_LENGTH || isChecking || !playerId) return;

		setNotFound("");
		setProbeCode(lobbyCode);
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		joinLobby(code);
	}

	return (
		<div className="w-full max-w-sm">
			<PageTitle>Join a Game</PageTitle>

			<form onSubmit={handleSubmit}>
				<FieldGroup>
					<Field data-invalid={message}>
						<FieldLabel htmlFor="lobby-code">Lobby Code</FieldLabel>
						<FieldDescription>
							Enter the {CODE_LENGTH}-character code from your
							host.
						</FieldDescription>
						<InputOTP
							id="lobby-code"
							maxLength={CODE_LENGTH}
							pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
							value={code}
							disabled={isChecking}
							onChange={(value) => {
								setNotFound("");
								setCode(value.toUpperCase());
							}}
							onComplete={(value: string) =>
								joinLobby(value.toUpperCase())
							}
						>
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
							</InputOTPGroup>
						</InputOTP>
						{message && <FieldError>{message}</FieldError>}
					</Field>

					<Field orientation="horizontal">
						<Button
							type="submit"
							disabled={!isComplete || isChecking || !playerId}
						>
							{isChecking ? (
								<>
									Joining
									<Spinner data-icon="inline-start" />
								</>
							) : (
								"Join"
							)}
						</Button>
					</Field>
				</FieldGroup>
			</form>
		</div>
	);
}
