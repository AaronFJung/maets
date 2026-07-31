import type { GameRegistry } from "@maets/game-sync";
import { ticTacToe } from "./tictactoe";
import { ultimateTicTacToe } from "./ultimate-tictactoe";

export const GAME_REGISTRY: GameRegistry = {
	[ticTacToe.id]: ticTacToe,
	[ultimateTicTacToe.id]: ultimateTicTacToe,
};
