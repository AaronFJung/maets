import type { GameRegistry } from "../types";
import { ticTacToe } from "./tictactoe";

/** Every game this app's rooms can play. Keep this a stable module-level
 * reference — `useMatch` reconnects whenever its `games` identity changes. */
export const GAME_REGISTRY: GameRegistry = {
	[ticTacToe.id]: ticTacToe,
};
