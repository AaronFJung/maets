import { CenteredContent } from "@/components/centered-content";
import NavigationProfileCard from "@/components/nav-profile-card";
import { ThemeProvider } from "@/components/theme-provider";
import { Separator } from "@/components/ui/separator";
import type { Metadata } from "next";
import { Merriweather, Montserrat, Ubuntu_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import maetsLogo from "../../public/maets-logo.png";
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
					defaultTheme="light"
					forcedTheme="light"
					enableSystem={false}
					disableTransitionOnChange
				>
					<div className="">
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

/**
 * Just the logo, centred, doubling as the link home. The profile control is
 * absolutely positioned so it never pulls the logo off centre — everything else
 * that used to live up here now sits on the home page.
 */
function Navigation() {
	return (
		<header className="relative flex items-center justify-center py-7">
			<Link
				href="/"
				aria-label="Maets home"
				className="transition-opacity hover:opacity-80"
			>
				<Image
					src={maetsLogo}
					alt="Maets"
					priority
					className="h-7 w-auto"
				/>
			</Link>

			<div className="absolute right-0 flex items-center">
				<Suspense>
					<NavigationProfileCard />
				</Suspense>
			</div>
		</header>
	);
}
