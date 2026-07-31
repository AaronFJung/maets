export const CODE_LENGTH = 4;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLobbyCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));

	let code = "";
	for (const byte of bytes) {
		code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
	}

	return code;
}
