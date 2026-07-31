import type { NextConfig } from "next";
import path from "node:path";

// The workspace root: the @maets/* sources and the hoisted node_modules both
// live outside this folder, so the tracer and Turbopack have to start there.
const workspaceRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
	// Produce a self-contained `.next/standalone/` bundle (server.js + a pruned
	// node_modules) so the Docker image can run without `npm install`.
	output: "standalone",
	// Nests the bundle at `.next/standalone/next/server.js` — the Dockerfile
	// COPYs match that.
	outputFileTracingRoot: workspaceRoot,
	// sharp has native binaries; keep it external so it isn't bundled and its
	// platform-specific binaries are traced into the standalone output.
	serverExternalPackages: ["sharp"],
	// The workspace packages ship raw TypeScript, so Next compiles them itself.
	transpilePackages: ["@maets/game-sync", "@maets/games"],
	turbopack: {
		root: workspaceRoot,
	},

	experimental: {
		serverActions: {
			bodySizeLimit: "5mb"
		}
	}


};

export default nextConfig;
