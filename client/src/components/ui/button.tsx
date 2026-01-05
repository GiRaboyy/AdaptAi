import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A6E85B]/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#A6E85B] hover:bg-[#93D94B] text-[#0a1f12] border-2 border-[#0a1f12] shadow-md rounded-xl",
        destructive: "bg-destructive text-destructive-foreground border-2 border-destructive rounded-xl hover:bg-destructive/90",
        outline: "bg-white border-2 border-[#0a1f12] text-[#0a1f12] rounded-xl hover:bg-[#0a1f12]/5 shadow-sm",
        secondary: "bg-muted text-[#0a1f12] border-2 border-[#0a1f12]/30 rounded-xl hover:border-[#0a1f12] shadow-sm",
        ghost: "text-[#0a1f12] rounded-xl hover:bg-[#0a1f12]/10",
        link: "text-[#A6E85B] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-3 text-base lg:h-14 lg:px-6 lg:py-4",
        sm: "h-10 px-4 text-sm rounded-lg",
        lg: "h-14 px-6 text-lg lg:h-16 lg:px-8",
        icon: "h-12 w-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
