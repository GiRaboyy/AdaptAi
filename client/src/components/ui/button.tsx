import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A6E85B]/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#A6E85B] hover:bg-[#93D94B] text-[#0B1220] shadow-md rounded-xl",
        destructive: "bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90",
        outline: "bg-white border border-border text-foreground rounded-xl hover:border-border-strong shadow-sm",
        secondary: "bg-muted text-foreground border border-border rounded-xl hover:border-border-strong shadow-sm",
        ghost: "text-foreground rounded-xl hover:bg-muted",
        link: "text-[#A6E85B] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[14px] py-[10px] text-sm lg:h-12 lg:px-4 lg:py-3",
        sm: "h-9 px-3 text-sm rounded-lg",
        lg: "h-12 px-5 text-base lg:h-[52px] lg:px-6",
        icon: "h-11 w-11 rounded-lg",
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
