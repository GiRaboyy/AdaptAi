import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground border border-border",
        secondary: "bg-muted text-muted-foreground border border-border",
        destructive: "bg-red-50 text-red-600 border border-red-200",
        outline: "bg-transparent border border-border text-foreground",
        success: "bg-[#A6E85B]/15 text-[#3D7A1E] border border-[#A6E85B]/30",
        warning: "bg-amber-50 text-amber-700 border border-amber-200",
        info: "bg-blue-50 text-blue-700 border border-blue-200",
        teal: "bg-teal-50 text-teal-700 border border-teal-200",
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
