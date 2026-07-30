"use client";

import { LobbyView } from "@/app/game/[lobbyCode]/lobby-view";
import { MatchHeader } from "@/app/game/[lobbyCode]/match-header";
import { CenteredContent } from "@/components/centered-content";
import { gameViewFor } from "@/components/game/game-views";
import { MatchConnection } from "@/components/game/match-connection";
import { MatchDevSidecar } from "@/components/game/match-dev-sidecar";
import type { MatchView } from "@/components/game/match-view";
import { UnsupportedGame } from "@/components/game/unsupported-game";
import { useDevMenu } from "@/hooks/useDevMenu";
import { useMatch } from "@/hooks/useMatch";
import useProfile from "@/hooks/useProfile";
import { useSeatIdentities } from "@/hooks/useSeatIdentities";
import { GAME_REGISTRY } from "@/lib/maets-realtime/games/registry";

/**
 * Everything at `/game/<code>`: resolves who you are, runs the match, and picks
 * the screen for whatever the room is currently doing. It holds no game
 * knowledge — boards come from `GAME_VIEWS`, keyed by the room's active game.
 */
export default function MatchRoom({
	lobbyCode,
	hostGameId,
}: {
	lobbyCode: string;
	/** The game the host picked, carried on `?game=` (see `host-game-card.tsx`).
	 * Absent for joiners — §12.7 has no lobby-phase "intended game" yet. */
	hostGameId?: string;
}) {
	const { profile, loading } = useProfile();
	const [devMenuEnabled] = useDevMenu();

	// No type arguments: the room can't know which game's state is live, so it
	// stays at `unknown` and the registry hands it to a view that does know.
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

	// The routes are behind the auth proxy, so this is a fallback rather than an
	// expected state — but without it a signed-out visitor would sit on the
	// identity step forever with nothing explaining why.
	const identityError =
		!loading && !profile
			? "You're not signed in, so there's no identity to join with. Sign in and try again."
			: undefined;

	// The host has it from the URL; everyone else can only know it once a game
	// has actually been selected, which also covers the lobby a finished match
	// drops back to.
	const roomGameId = hostGameId ?? activeGameId ?? undefined;
	const GameView = gameViewFor(activeGameId);

	let body: React.ReactNode;
	// The strip exists because the board has no room for the code or the roster.
	// The lobby is nothing *but* those, at full size, so showing both puts the code
	// on screen twice and every player's name twice.
	let showHeader = true;

	if (stage !== "ready" || error || identityError) {
		// Every pre-join state, including failure, is narrated by the same
		// stepper: a stall is then attributable to a specific step rather than
		// leaving an undifferentiated "Connecting…" on screen.
		body = <MatchConnection stage={stage} error={error ?? identityError} />;
	} else if (phase === "lobby") {
		body = (
			<LobbyView lobbyCode={lobbyCode} gameId={roomGameId} match={view} />
		);
		showHeader = false;
	} else if (GameView && match.state !== undefined) {
		body = <GameView {...view} state={match.state} submit={match.submit} />;
	} else if (GameView) {
		// Known game, state not here yet — a sync gap, not a version problem.
		body = <MatchConnection stage="syncing" />;
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
				<div className="w-full pt-4 pb-6">
					<CenteredContent>
						<MatchHeader
							lobbyCode={lobbyCode}
							players={players}
							identityFor={identityFor}
						/>
					</CenteredContent>
				</div>
			)}

			<CenteredContent>{body}</CenteredContent>

			{devMenuEnabled && stage === "ready" && (
				<MatchDevSidecar match={match} />
			)}
		</>
	);
}
