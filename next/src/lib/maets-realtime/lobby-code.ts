export const CODE_LENGTH = 6;

// no 0/O or 1/I: codes get read aloud and typed in by hand
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A fresh lobby code. Stage 1 has no lobby registry — the code *is* the
 *  lobby, and whoever occupies it first becomes its host. */
export function generateLobbyCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));

	let code = "";
	for (const byte of bytes) {
		code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
	}

	return code;
}
