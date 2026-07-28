"use client";

import {
	AlertTriangle,
	Gamepad2Icon,
	UserIcon,
	UserRoundCheckIcon,
	UsersIcon,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import useProfile from "@/hooks/useProfile";
import { GAMES } from "@/lib/games";
import { initials } from "@/lib/initials";
import { useLobby } from "@/lib/maets-realtime/maets-realtime";

export default function Lobby({
	lobbyCode,
	hostGameId,
}: {
	lobbyCode: string;
	hostGameId?: string;
}) {
	const { profile, loading } = useProfile();

	const hostGameName = hostGameId
		? (GAMES.find((game) => game.id === hostGameId)?.name ?? hostGameId)
		: undefined;

	const { status, members, host } = useLobby({
		lobbyCode,
		playerId: profile?.userId,
		username: profile?.username,
		avatarUrl: profile?.avatarUrl ?? undefined,
	});

	if (loading || !profile) {
		return (
			<PageTitle>
				Loading
				<Spinner data-icon="inline-start" />
			</PageTitle>
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
									{profile.username}
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
									<div className="flex flex-wrap gap-2 pt-1">
										{members.map((member) => (
											<span
												key={member.playerId}
												className="flex items-center gap-1.5"
											>
												<Avatar size="sm">
													{member.avatarUrl && (
														<AvatarImage
															src={
																member.avatarUrl
															}
															alt={
																member.username
															}
														/>
													)}
													<AvatarFallback>
														{initials(
															member.username,
														)}
													</AvatarFallback>
												</Avatar>
												{member.username}
											</span>
										))}
									</div>
								</ItemDescription>
							</ItemContent>
						</Item>
					</div>
				</>
			)}
		</>
	);
}
