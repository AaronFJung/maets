export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <div className="mx-auto w-full max-w-sm">{children}</div>;
}
