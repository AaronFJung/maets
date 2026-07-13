import type { Metadata } from "next";
import { Merriweather, Montserrat, Ubuntu_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

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
					{children}
					<div className="fixed right-4 top-4 z-50">
						<ThemeToggle />
					</div>
				</ThemeProvider>
			</body>
		</html>
	);
}
