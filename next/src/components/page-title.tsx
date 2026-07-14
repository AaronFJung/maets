export function PageTitle({ children }: { children: React.ReactNode }) {
	return (
		<h1 className="mb-6 mt-6 font-serif text-2xl font-semibold tracking-tight">
			{children}
		</h1>
	);
}
