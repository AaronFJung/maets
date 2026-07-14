"use client";

import { PageTitle } from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import useLocalPlayerId from "@/hooks/useLocalPlayerId";
import useLocalPlayerUsername from "@/hooks/useLocalPlayerUsername";
import { GAMES } from "@/lib/games";
import { useLobby } from "@/lib/maets-realtime/maets-realtime";
import {
	AlertTriangle,
	Gamepad2Icon,
	UserIcon,
	UserRoundCheckIcon,
	UsersIcon,
} from "lucide-react";
import { useState } from "react";

export default function Lobby({
	lobbyCode,
	hostGameId,
}: {
	lobbyCode: string;
	hostGameId?: string;
}) {
	const localPlayerId = useLocalPlayerId();

	const hostGameName = hostGameId
		? (GAMES.find((game) => game.id === hostGameId)?.name ?? hostGameId)
		: undefined;

	const {
		playerUsername: localPlayerUsername,
		setPlayerUsername: setLocalPlayerUsername,
	} = useLocalPlayerUsername();

	const [usernameDraft, setUsernameDraft] = useState("");

	const { status, members, host } = useLobby({
		lobbyCode,
		playerId: localPlayerId,
		username: localPlayerUsername,
	});

	if (!localPlayerUsername || localPlayerUsername.length === 0) {
		const submitUsername = () => {
			const trimmed = usernameDraft.trim();
			if (trimmed.length === 0) return;
			setLocalPlayerUsername(trimmed);
		};

		return (
			<>
				<PageTitle>Make your Profile</PageTitle>

				<FieldGroup>
					<Field>
						<FieldLabel>Username</FieldLabel>
						<Input
							value={usernameDraft}
							onChange={(e) => setUsernameDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") submitUsername();
							}}
						/>
					</Field>
					<Button type="submit" onClick={submitUsername}>
						Join
					</Button>
				</FieldGroup>
			</>
		);
	}

	return (
		<>
			{status === "connecting" && (
				<PageTitle>
					Connecting ({lobbyCode})
					<Spinner data-icon="inline-start" />
				</PageTitle>
			)}

			{status === "error" && (
				<>
					<PageTitle>Couldn't Connect ({lobbyCode})</PageTitle>

					<Alert>
						<AlertTriangle />
						<AlertDescription>
							An unknown issue occurred.
						</AlertDescription>
					</Alert>
				</>
			)}

			{status === "joined" && (
				<>
					<PageTitle>Connected ({lobbyCode})</PageTitle>

					<div className="flex flex-col gap-2">
						<Item variant="muted" size="xs">
							<ItemMedia>
								<UserIcon />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Username</ItemTitle>
								<ItemDescription>
									{localPlayerUsername}
								</ItemDescription>
							</ItemContent>
						</Item>

						<Item variant="muted" size="xs">
							<ItemMedia>
								<UserRoundCheckIcon />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Host</ItemTitle>
								<ItemDescription>
									{host?.username}
								</ItemDescription>
							</ItemContent>
						</Item>

						{hostGameName && (
							<Item variant="muted" size="xs">
								<ItemMedia>
									<Gamepad2Icon />
								</ItemMedia>
								<ItemContent>
									<ItemTitle>Game</ItemTitle>
									<ItemDescription>
										{hostGameName}
									</ItemDescription>
								</ItemContent>
							</Item>
						)}

						<Item variant="muted" size="xs">
							<ItemMedia>
								<UsersIcon />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Members</ItemTitle>
								<ItemDescription>
									{members.map((m) => m.username).join(", ")}
								</ItemDescription>
							</ItemContent>
						</Item>
					</div>
				</>
			)}
		</>
	);
}
