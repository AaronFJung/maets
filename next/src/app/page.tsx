"use client";

import { generateLobbyCode } from "@maets/game-sync";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { HOST_GAME, NAV_LINKS } from "@/lib/nav-links";

export default function Home() {
	const router = useRouter();

	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
				Maets
			</h1>
			<p className="text-lg text-muted-foreground sm:text-xl">
				A turn-based gaming platform built for Ivy Tech SDEV 265.
			</p>

			<nav className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				{NAV_LINKS.map((link) => (
					<Link
						key={link.href}
						href={link.href}
						className={buttonVariants({
							variant: "outline",
							size: "lg",
						})}
					>
						<link.icon className="size-4" />
						{link.label}
					</Link>
				))}

				<button
					type="button"
					className={buttonVariants({ size: "lg" })}
					onClick={() => router.push(`/game/${generateLobbyCode()}`)}
				>
					<HOST_GAME.icon className="size-4" />
					{HOST_GAME.label}
				</button>
			</nav>
		</main>
	);
}
