"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useChat from "@/hooks/useChat";

const CHANNEL_NAME = "chat-1";

export default function Page() {
	const [nameDraft, setNameDraft] = useState("");
	const [username, setUsername] = useState("");
	const [joined, setJoined] = useState(false);
	const [draft, setDraft] = useState("");
	const { messages, sendMessage } = useChat({
		channelName: CHANNEL_NAME,
		username,
	});

	const handleJoin = () => {
		const trimmed = nameDraft.trim();
		if (!trimmed) {
			return;
		}
		setUsername(trimmed);
		setJoined(true);
	};

	if (!joined) {
		return (
			<div className="flex flex-1 items-center justify-center p-4">
				<Card className="w-full max-w-sm">
					<CardHeader>
						<CardTitle>Join the Chat (:{CHANNEL_NAME})</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Input
							placeholder="Your name"
							value={nameDraft}
							onChange={(event) =>
								setNameDraft(event.target.value)
							}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									handleJoin();
								}
							}}
						/>
						<Button
							className="w-full"
							disabled={!nameDraft.trim()}
							onClick={handleJoin}
							suppressHydrationWarning
						>
							Join
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const handleSend = () => {
		if (!draft.trim()) {
			return;
		}
		sendMessage(draft.trim());
		setDraft("");
	};

	return (
		<div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
			<Card className="flex flex-1 flex-col overflow-hidden">
				<CardHeader>
					<CardTitle>Chat</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto">
					{messages.map((message) => (
						<div key={message.id} className="text-sm">
							<span className="font-medium">
								{message.from}:{" "}
							</span>
							<span>{message.content}</span>
						</div>
					))}
				</CardContent>
			</Card>
			<div className="flex gap-2">
				<Input
					placeholder="Type a message"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							handleSend();
						}
					}}
				/>
				<Button onClick={handleSend}>Send</Button>
			</div>
		</div>
	);
}