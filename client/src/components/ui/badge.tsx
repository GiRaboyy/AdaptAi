import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-[12px] px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-white/[0.10] text-white/90 border border-white/[0.10]",
        secondary: "bg-white/[0.06] text-white/64 border border-white/[0.10]",
        destructive: "bg-[#FB7185]/[0.14] text-[#FB7185] border border-[#FB7185]/20",
        outline: "bg-transparent border border-white/[0.10] text-white/90",
        success: "bg-[#A6E85B]/[0.14] text-[#A6E85B] border border-[#A6E85B]/20",
        warning: "bg-[#FBBF24]/[0.14] text-[#FBBF24] border border-[#FBBF24]/20",
        info: "bg-[#60A5FA]/[0.14] text-[#60A5FA] border border-[#60A5FA]/20",
        teal: "bg-[#2DD4BF]/[0.14] text-[#2DD4BF] border border-[#2DD4BF]/20",
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
