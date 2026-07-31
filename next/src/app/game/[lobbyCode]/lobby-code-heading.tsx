import { cn } from "@/lib/utils";

export function LobbyCodeHeading({
	code,
	align = "start",
	children,
}: {
	code: string;
	align?: "start" | "center";
	children?: React.ReactNode;
}) {
	return (
		<div className={align === "center" ? "text-center" : undefined}>
			<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
				Lobby code
			</p>
			<div
				className={cn(
					"mt-1.5 flex flex-wrap items-center gap-4",
					align === "center" && "justify-center",
				)}
			>
				<h1 className="font-mono text-4xl font-bold tracking-[0.15em] sm:text-5xl">
					{code}
				</h1>
				{children}
			</div>
		</div>
	);
}
