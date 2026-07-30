import { Gamepad2Icon } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { gameName } from "@/lib/games";

/**
 * The registry-miss fallback: this client joined a room running a game it has
 * no view for — version skew, or a game added after this build.
 */
export function UnsupportedGame({
	lobbyCode,
	activeGameId,
}: {
	lobbyCode: string;
	/** The game the room reports running, if it reported one at all. */
	activeGameId: string | null;
}) {
	return (
		<>
			<PageTitle>Unsupported game ({lobbyCode})</PageTitle>
			<Alert variant="destructive">
				<Gamepad2Icon />
				<AlertTitle>This client can't play that game</AlertTitle>
				<AlertDescription>
					The room is playing{" "}
					{activeGameId ? gameName(activeGameId) : "an unknown game"},
					which this version of Maets doesn't know how to render.
				</AlertDescription>
			</Alert>
		</>
	);
}
