"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import z from "zod";

const ChatMessageSchema = z.object({
    from: z.string(),
    content: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const ChatPresenceSchema = z.object({
    username: z.string(),
});

export type ChatPresence = z.infer<typeof ChatPresenceSchema>;

// join/leave hand back an array of presence objects
const ChatPresenceListSchema = z.array(ChatPresenceSchema);

export type ReceivedChatMessage = ChatMessage & { id: string };

export default function useChat({
    channelName,
    username,
}: {
    channelName: string;
    username: string;
}) {
    const [messages, setMessages] = useState<ReceivedChatMessage[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (username.length === 0) return;

        const supabase = createClient();
        const channel = supabase.realtime.channel(channelName, {
            config: {
                broadcast: {
                    self: false,
                },
            },
        });

        channel
            .on("broadcast", { event: "msg" }, ({ payload }) => {
                const result = ChatMessageSchema.safeParse(payload);
                if (result.success) {
                    setMessages((prev) => [
                        ...prev,
                        { ...result.data, id: crypto.randomUUID() },
                    ]);
                }
            })
            // .on("presence", { event: "sync" }, () => {
            //     console.log("Presence sync", channel.presenceState());
            // })
            .on("presence", { event: "join" }, ({ newPresences }) => {
                const result = ChatPresenceListSchema.safeParse(newPresences);
                if (!result.success) return;

                console.log("Presence: Join", newPresences);

                setMessages((prev) => [
                    ...prev,
                    ...result.data.map((p) => ({
                        from: "System",
                        content: `${p.username} has joined`,
                        id: crypto.randomUUID(),
                    })),
                ]);
            })
            .on("presence", { event: "leave" }, ({ leftPresences }) => {
                const result = ChatPresenceListSchema.safeParse(leftPresences);
                if (!result.success) return;

                console.log("Presence: Leave", leftPresences);

                setMessages((prev) => [
                    ...prev,
                    ...result.data.map((p) => ({
                        from: "System",
                        content: `${p.username} left`,
                        id: crypto.randomUUID(),
                    })),
                ]);
            });

        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                // track only once the subscription is live
                const presence: ChatPresence = { username };
                channel.track(presence);
            }
        });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [channelName, username]);

    const sendMessage = useCallback(
        (content: string) => {
            const channel = channelRef.current;
            if (!channel) {
                return;
            }

            const message: ChatMessage = { from: username, content };

            channel.send({
                type: "broadcast",
                event: "msg",
                payload: message,
            });

            setMessages((prev) => [
                ...prev,
                { ...message, id: crypto.randomUUID() },
            ]);
        },
        [username],
    );

    return { messages, sendMessage };
}
