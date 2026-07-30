import { logout } from "@/app/(auth)/actions";
import { getProfile } from "@/lib/auth/dal";
import { initials } from "@/lib/initials";
import { UserIcon } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default async function NavigationProfileCard() {
	const profile = await getProfile();

	if (!profile) {
		return (
			<Button asChild variant="outline" size="sm">
				<Link href="/login">Log in</Link>
			</Button>
		);
	}

	const short = initials(profile.username);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
				<span className="hidden max-w-32 truncate font-medium text-sm sm:block">
					{profile.username}
				</span>

				<Avatar>
					{profile.avatarUrl && (
						<AvatarImage
							src={profile.avatarUrl}
							alt={profile.username}
						/>
					)}
					<AvatarFallback>
						{short || <UserIcon className="size-4" />}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end">
				<DropdownMenuLabel className="truncate">
					{profile.username}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/account">Account</Link>
				</DropdownMenuItem>
				<form action={logout}>
					<DropdownMenuItem asChild>
						<button type="submit" className="w-full">
							Log out
						</button>
					</DropdownMenuItem>
				</form>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
