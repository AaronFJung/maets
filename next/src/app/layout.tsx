import { CenteredContent } from "@/components/centered-content";
import { MobileNav } from "@/components/mobile-nav";
import NavigationProfileCard from "@/components/nav-profile-card";
import { ThemeProvider } from "@/components/theme-provider";
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
			className={`${montserrat.variable} ${merriweather.variable} ${ubuntuMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<div className="bg-accent">
						<CenteredContent>
							<Navigation />
						</CenteredContent>
					</div>

					<Separator />

					<div className="flex flex-1 flex-col">{children}</div>
				</ThemeProvider>
			</body>
		</html>
	);
}

function Navigation() {
	return (
		<header className="flex items-center justify-between py-4 bg-accent">
			<div className="flex items-center gap-2.5">
				<Link
					href="/"
					className="text-xl font-bold tracking-tight transition-colors hover:text-primary text-accent-foreground"
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
									<Link
										href={link.href}
										className="text-accent-foreground"
									>
										<link.icon className="size-4" />
										{link.label}
									</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>
						))}
					</NavigationMenuList>
				</NavigationMenu>

				{/* <SettingsMenu /> */}
			</div>

			<div className="flex items-center gap-2">
				<Suspense>
					<NavigationProfileCard />
				</Suspense>

				<MobileNav />
			</div>
		</header>
	);
}
