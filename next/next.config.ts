import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Produce a self-contained `.next/standalone/` bundle (server.js + a pruned
	// node_modules) so the Docker image can run without `npm install`.
	output: "standalone",
	// Pin the output-file-tracing root to this folder. Without this, Next walks
	// up and finds the workspace-root package-lock.json, which would nest the
	// bundle at `.next/standalone/next/server.js` and break the Dockerfile COPY.
	outputFileTracingRoot: __dirname,
	turbopack: {
		// Needed because there is also a package-lock.json at the workspace root
		// (for Biome), which confuses Turbopack's auto-detection of the project root.
		root: __dirname,
	},
};

export default nextConfig;
