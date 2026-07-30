import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Horizontal-only wrapper: centers its children in the viewport and grows the
 * content column step by step as the device gets wider, while keeping a gutter
 * so nothing ever touches the screen edge.
 *
 * On phones the content is full width minus the gutter; each breakpoint raises
 * the ceiling until it settles at a comfortable reading/working width on large
 * desktops. It sets no vertical spacing, display, or height of its own.
 *
 * Note: the widths are breakpoint-prefixed, so overriding via `className` needs
 * matching prefixes (e.g. `className="lg:max-w-4xl"`, not `max-w-4xl`) for
 * tailwind-merge to drop the default.
 */
const centeredContentVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
	variants: {
		width: {
			// Long-form text and forms — capped near a 60-75 character measure.
			narrow: "sm:max-w-xl md:max-w-2xl lg:max-w-3xl",
			// General pages.
			default:
				"sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
			// Boards, tables, dashboards — uses the extra room on big monitors.
			wide: "sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[100rem]",
			// Edge to edge, gutters only.
			full: "max-w-none",
		},
	},
	defaultVariants: {
		width: "default",
	},
});

function CenteredContent({
	className,
	width,
	asChild = false,
	...props
}: React.ComponentProps<"div"> &
	VariantProps<typeof centeredContentVariants> & {
		/** Render the styles onto the only child instead of a `div`. */
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "div";

	return (
		<Comp
			data-slot="centered-content"
			data-width={width ?? "default"}
			className={cn(centeredContentVariants({ width }), className)}
			{...props}
		/>
	);
}

export { CenteredContent, centeredContentVariants };
