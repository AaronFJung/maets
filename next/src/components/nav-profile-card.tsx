"use client";

import useLocalPlayerUsername from "@/hooks/useLocalPlayerUsername";
import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";

function initials(username: string) {
    return username
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] ?? "")
        .join("")
        .toUpperCase();
}

export default function NavigationProfileCard() {
    const { playerUsername } = useLocalPlayerUsername();

    if (!playerUsername) return null;

    const short = initials(playerUsername);

    return (
        <div className="flex items-center gap-2">
            <Avatar>
                <AvatarFallback>
                    {short || <UserIcon className="size-2" />}
                </AvatarFallback>
            </Avatar>

            <p
                title={playerUsername}
                className="hidden max-w-32 truncate font-medium text-sm sm:block"
            >
                {playerUsername}
            </p>
        </div>
    );
}
