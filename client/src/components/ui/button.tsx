import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A6E85B]/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "gradient-primary text-[#062014] shadow-glass rounded-[14px]",
        destructive: "bg-destructive text-destructive-foreground rounded-[14px]",
        outline: "glass-strong text-white/90 rounded-[14px] hover:bg-white/[0.12] hover:border-white/[0.14]",
        secondary: "glass-strong text-white/90 rounded-[14px] hover:bg-white/[0.12] hover:border-white/[0.14]",
        ghost: "text-white/90 rounded-[14px] hover:bg-white/[0.10]",
        link: "text-[#A6E85B] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[14px] py-[10px] text-sm lg:h-12 lg:px-4 lg:py-3 xl:h-[52px] xl:px-[18px] xl:py-[14px]",
        sm: "h-9 px-3 text-sm rounded-[12px]",
        lg: "h-12 px-5 text-base lg:h-[52px] lg:px-6 xl:h-14 xl:px-7",
        icon: "h-11 w-11 rounded-[12px]",
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
