"use client"

import { useEffect, useState } from "react";

const PLAYER_ID_KEY = "maets:playerId";

export default function useLocalPlayerId() {
    const [playerId, setPlayerId] = useState("");

    useEffect(() => {
        let stored = localStorage.getItem(PLAYER_ID_KEY);
        if (!stored) {
            stored = crypto.randomUUID();
            localStorage.setItem(PLAYER_ID_KEY, stored);
        }
        setPlayerId(stored);
    }, []);

    return playerId;
}