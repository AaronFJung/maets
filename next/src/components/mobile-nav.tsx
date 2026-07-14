"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_LINKS } from "@/lib/nav-links";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileNav() {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className="md:hidden">
					<MenuIcon />
				</Button>
			</SheetTrigger>

			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Menu</SheetTitle>
				</SheetHeader>

				<nav className="flex flex-col gap-1 px-4">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							onClick={() => setOpen(false)}
							className="rounded-lg px-2.5 py-2 font-medium text-sm transition-colors hover:bg-muted"
						>
							{link.label}
						</Link>
					))}
				</nav>
			</SheetContent>
		</Sheet>
	);
}
