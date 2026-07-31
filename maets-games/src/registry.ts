import type { GameRegistry } from "@maets/game-sync";
import { ticTacToe } from "./tictactoe";

export const GAME_REGISTRY: GameRegistry = {
	[ticTacToe.id]: ticTacToe,
};
