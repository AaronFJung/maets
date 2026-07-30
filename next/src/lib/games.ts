export type Game = {
	id: string;
	name: string;
};

export const GAMES: Game[] = [{ id: "tic-tac-toe", name: "Tic Tac Toe" }];

/** Display name for a game id, falling back to the id itself so a game this
 * build doesn't know about still renders something readable. */
export const gameName = (id: string): string =>
	GAMES.find((game) => game.id === id)?.name ?? id;
