import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
				Maets
			</h1>
			<p className="text-lg text-muted-foreground sm:text-xl">
				A turn-based gaming platform built for Ivy Tech SDEV 265.
			</p>
			<Link href="https://gsithub.com/AaronFJung/maets">
				<Button variant={"link"}>Source Code</Button>
			</Link>
		</main>
	);
}
