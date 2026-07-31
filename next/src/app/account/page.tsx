import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { getProfile } from "@/lib/auth/dal";
import AccountForm from "./account-form";

export default async function AccountPage() {
	const profile = await getProfile();
	if (!profile) {
		redirect("/login");
	}

	return (
		<div className="mx-auto w-full max-w-sm">
			<PageTitle>Account</PageTitle>
			<AccountForm
				username={profile.username}
				avatarUrl={profile.avatarUrl}
			/>
		</div>
	);
}
