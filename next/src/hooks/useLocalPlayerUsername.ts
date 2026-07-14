"use client";

import { useCallback, useEffect, useState } from "react";

const PLAYER_USERNAME_KEY = "maets:username";

export default function useLocalPlayerUsername() {
    const [playerUsername, setPlayerUsernameState] = useState<string>();

    useEffect(() => {
        const stored = localStorage.getItem(PLAYER_USERNAME_KEY);

        if (!stored) return;

        setPlayerUsernameState(stored);
    }, []);

    const setPlayerUsername = useCallback((username: string) => {
        localStorage.setItem(PLAYER_USERNAME_KEY, username);
        setPlayerUsernameState(username);
    }, []);

    return { playerUsername, setPlayerUsername };
}
