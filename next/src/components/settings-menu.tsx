"use client";

import { SettingsIcon, SunMoonIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDevMenu } from "@/hooks/useDevMenu";

export function SettingsMenu() {
	const { theme, setTheme } = useTheme();
	const [devMenuEnabled, setDevMenuEnabled] = useDevMenu();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon">
					<SettingsIcon className="h-[1.2rem] w-[1.2rem]" />
					<span className="sr-only">Settings</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Settings</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<SunMoonIcon />
						<span>Theme</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup
							value={theme}
							onValueChange={setTheme}
						>
							<DropdownMenuRadioItem value="light">
								Light
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="dark">
								Dark
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="system">
								System
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem
					checked={devMenuEnabled}
					onCheckedChange={setDevMenuEnabled}
				>
					Developer Menu
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
