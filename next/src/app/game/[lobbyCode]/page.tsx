import MatchRoom from "./match-room";

export default async function Page({
	params,
}: {
	params: Promise<{ lobbyCode: string }>;
}) {
	const { lobbyCode } = await params;

	return <MatchRoom lobbyCode={lobbyCode} />;
}
