import { MobileNav } from "@/components/mobile-nav";
import NavigationProfileCard from "@/components/nav-profile-card";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import { NAV_LINKS } from "@/lib/nav-links";
import type { Metadata } from "next";
import { Merriweather, Montserrat, Ubuntu_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";

const montserrat = Montserrat({
	variable: "--font-montserrat",
	subsets: ["latin"],
});

const merriweather = Merriweather({
	variable: "--font-merriweather",
	subsets: ["latin"],
});

const ubuntuMono = Ubuntu_Mono({
	variable: "--font-ubuntu-mono",
	subsets: ["latin"],
	weight: ["400", "700"],
});

export const metadata: Metadata = {
	title: "Maets",
	description: "IvyTech SDEV turn-based gaming platform",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${montserrat.variable} ${merriweather.variable} ${ubuntuMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<Navigation />

					<Separator />

					<div className="flex flex-1 flex-col px-6">{children}</div>
				</ThemeProvider>
			</body>
		</html>
	);
}

function Navigation() {
	return (
		<header className="flex items-center justify-between py-4 px-6">
			<div className="flex items-center gap-2.5">
				<Link
					href="/"
					className="text-xl font-bold tracking-tight transition-colors hover:text-primary"
				>
					Maets
				</Link>

				<NavigationMenu className="hidden md:flex">
					<NavigationMenuList>
						{NAV_LINKS.map((link) => (
							<NavigationMenuItem key={link.href}>
								<NavigationMenuLink
									asChild
									className={navigationMenuTriggerStyle()}
								>
									<Link href={link.href}>{link.label}</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>
						))}
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			<div className="flex items-center gap-2">

				<Suspense>

					<NavigationProfileCard />

				</Suspense>

				<ThemeToggle />
				<MobileNav />
			</div>
		</header>
	);
}
