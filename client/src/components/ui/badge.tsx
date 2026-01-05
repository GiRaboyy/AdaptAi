import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-primary/20",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border border-foreground/10",
        destructive: "bg-destructive/15 text-destructive border border-destructive/20",
        outline: "bg-white/55 dark:bg-slate-900/55 backdrop-blur-sm border border-foreground/10 text-foreground",
        success: "bg-primary/15 text-primary border border-primary/20",
        warning: "bg-warning/15 text-warning border border-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
