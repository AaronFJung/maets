"use client";

import type { ConnectionStage, Seat } from "@maets/game-sync";
import { GAME_REGISTRY, ticTacToe } from "@maets/games";
import { CircleAlertIcon, Gamepad2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { LobbyCodeHeading } from "@/app/game/[lobbyCode]/lobby-code-heading";
import { LobbyView } from "@/app/game/[lobbyCode]/lobby-view";
import { CenteredContent } from "@/components/centered-content";
import type {
	GameView,
	GameViewRegistry,
	MatchView,
} from "@/components/game/match-view";
import {
	PlayerAvatar,
	type SeatIdentity,
	seatColor,
} from "@/components/game/seat";
import { TicTacToeView } from "@/components/game/tic-tac-toe";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { type MatchPlayer, useMatch } from "@/hooks/useMatch";
import useProfile from "@/hooks/useProfile";
import { useSeatIdentities } from "@/hooks/useSeatIdentities";
import { gameName } from "@/lib/games";

const GAME_VIEWS: GameViewRegistry = {
	[ticTacToe.id]: TicTacToeView,
};

function gameViewFor(gameId: string | null): GameView | undefined {
	return gameId ? GAME_VIEWS[gameId] : undefined;
}

export default function MatchRoom({ lobbyCode }: { lobbyCode: string }) {
	const { profile, loading } = useProfile();

	const match = useMatch({
		code: lobbyCode,
		games: GAME_REGISTRY,
		playerId: profile?.userId,
		name: profile?.username ?? "",
		want: "player",
	});

	const { stage, error, phase, seat, isHost, players, host, activeGameId } =
		match;

	const { identityFor, nameFor, seatLabel } = useSeatIdentities(players);

	const view: MatchView = {
		seat,
		isHost,
		phase,
		players,
		hostSeat: host?.seat,
		hostName: host ? (nameFor(host.seat) ?? host.name) : undefined,
		spectators: match.spectators,
		identityFor,
		nameFor,
		seatLabel,
		selectGame: match.selectGame,
	};

	const identityError =
		!loading && !profile
			? "You're not signed in, so there's no identity to join with. Sign in and try again."
			: undefined;

	const roomGameId = activeGameId ?? undefined;
	const GameView = gameViewFor(activeGameId);

	let body: React.ReactNode;
	// The compact header only makes sense once a game is actually on screen —
	// every other state already shows the lobby code as its own big heading,
	// so a second copy above it would just repeat itself.
	let showHeader = false;

	if (stage !== "ready" || error || identityError) {
		body = (
			<MatchConnection
				lobbyCode={lobbyCode}
				stage={stage}
				error={error ?? identityError}
			/>
		);
	} else if (phase === "lobby") {
		body = (
			<LobbyView lobbyCode={lobbyCode} gameId={roomGameId} match={view} />
		);
	} else if (GameView && match.state !== undefined) {
		body = <GameView {...view} state={match.state} submit={match.submit} />;
		showHeader = true;
	} else if (GameView) {
		body = <MatchConnection lobbyCode={lobbyCode} stage="syncing" />;
	} else {
		body = (
			<UnsupportedGame
				lobbyCode={lobbyCode}
				activeGameId={activeGameId}
			/>
		);
	}

	return (
		<>
			{showHeader && (
				<div className="w-full pt-4">
					<CenteredContent width="narrow">
						<MatchHeader
							lobbyCode={lobbyCode}
							players={players}
							identityFor={identityFor}
						/>
					</CenteredContent>
				</div>
			)}

			<CenteredContent width="narrow" className="flex flex-1 flex-col">
				<div className="my-auto w-full py-8">{body}</div>
			</CenteredContent>
		</>
	);
}

function MatchHeader({
	lobbyCode,
	players,
	identityFor,
}: {
	lobbyCode: string;
	players: readonly MatchPlayer[];
	identityFor: (seat: Seat) => SeatIdentity | undefined;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-b pb-3">
			<p className="flex items-baseline gap-2">
				<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Lobby
				</span>
				<span className="font-mono text-sm font-bold tracking-[0.15em]">
					{lobbyCode}
				</span>
			</p>

			<div className="flex items-center gap-1.5">
				{players.map((player) => {
					const identity = identityFor(player.seat);
					const name = identity?.name ?? player.name;

					return (
						<span key={player.seat} title={name}>
							<PlayerAvatar
								size="sm"
								name={name}
								avatarUrl={identity?.avatarUrl}
								connected={player.connected}
								color={seatColor(player.seat)}
							/>
						</span>
					);
				})}
			</div>
		</div>
	);
}

function getStageText(stage: ConnectionStage): string {
	switch (stage) {
		case "idle":
			return "Identifying you...";
		case "subscribing":
			return "Opening Realtime Channel...";
		case "announcing":
			return "Announcing Presence...";
		case "handshaking":
			return "Handshaking with the Host...";
		case "creating":
			return "Creating the Match...";
		case "syncing":
			return "Syncing Match State...";
		case "ready":
			return "Connected";
		default:
			return "Connecting...";
	}
}

function MatchConnection({
	lobbyCode,
	stage,
	error,
}: {
	lobbyCode: string;
	stage: ConnectionStage;
	error?: string;
}) {
	const statusText = getStageText(stage);

	return (
		<div className="flex flex-col items-center gap-8 text-center">
			<LobbyCodeHeading code={lobbyCode} align="center" />

			{error ? (
				<Alert
					variant="destructive"
					className="mx-auto max-w-md text-left"
				>
					<CircleAlertIcon />
					<AlertTitle>Can't connect</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : (
				<div className="flex items-center gap-2.5 text-base font-medium text-muted-foreground">
					<Spinner />
					<AnimatePresence mode="popLayout">
						<motion.p
							key={statusText}
							initial={{ y: 10, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -10, opacity: 0 }}
							transition={{ duration: 0.2, ease: "easeInOut" }}
						>
							{statusText}
						</motion.p>
					</AnimatePresence>
				</div>
			)}
		</div>
	);
}

function UnsupportedGame({
	lobbyCode,
	activeGameId,
}: {
	lobbyCode: string;
	activeGameId: string | null;
}) {
	return (
		<div className="flex flex-col items-center gap-8 text-center">
			<LobbyCodeHeading code={lobbyCode} align="center" />

			<Alert variant="destructive" className="mx-auto max-w-md text-left">
				<Gamepad2Icon />
				<AlertTitle>This client can't play that game</AlertTitle>
				<AlertDescription>
					The room is playing{" "}
					{activeGameId ? gameName(activeGameId) : "an unknown game"},
					which this version of Maets doesn't know how to render.
				</AlertDescription>
			</Alert>
		</div>
	);
}
