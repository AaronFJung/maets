"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "maets:devMenu";
const CHANGE_EVENT = "maets:devMenu:change";

function readEnabled(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/**
 * Whether the developer sidecar is on, backed by localStorage so it's shared
 * between components that aren't in the same tree (the settings menu lives in
 * the root layout; the sidecar lives on the match page). Writers dispatch a
 * same-tab custom event (storage events don't fire in the writing tab) so
 * every mounted reader updates immediately, plus the native `storage` event
 * for cross-tab sync.
 */
export function useDevMenu() {
	const [enabled, setEnabledState] = useState(readEnabled);

	useEffect(() => {
		const sync = () => setEnabledState(readEnabled());
		window.addEventListener(CHANGE_EVENT, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(CHANGE_EVENT, sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	const setEnabled = useCallback((value: boolean) => {
		window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
		window.dispatchEvent(new Event(CHANGE_EVENT));
	}, []);

	return [enabled, setEnabled] as const;
}
