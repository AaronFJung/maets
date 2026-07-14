import Lobby from "./Lobby";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ lobbyCode: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { lobbyCode } = await params;
	const { game } = await searchParams;

	// a repeated ?game= yields an array; only a single value is meaningful
	const hostGameId = typeof game === "string" ? game : undefined;

	return <Lobby lobbyCode={lobbyCode} hostGameId={hostGameId} />;
}
