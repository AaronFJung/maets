import type { GameView, GameViewRegistry } from "@/components/game/match-view";
import { TicTacToeView } from "@/components/game/tic-tac-toe-view";
import { ticTacToe } from "@/lib/maets-realtime/games/tictactoe";

/**
 * Board UIs by game id, parallel to `GAME_REGISTRY` — that one says how a game
 * is *played*, this one says how it's *drawn*. A room running a game missing
 * here renders `<UnsupportedGame>`: this build simply can't draw it.
 *
 * Keyed off the plugin's own `id` so the two registries can't drift apart.
 */
export const GAME_VIEWS: GameViewRegistry = {
	[ticTacToe.id]: TicTacToeView,
};

/**
 * The view for a game, or `undefined` when this build can't render it. A
 * function rather than a bare index because `noUncheckedIndexedAccess` is off,
 * so indexing would type as always-present and hide the fallback branch.
 */
export function gameViewFor(gameId: string | null): GameView | undefined {
	return gameId ? GAME_VIEWS[gameId] : undefined;
}
