import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-55 hover:-translate-y-0.5 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-[#1ED760] to-[#14B854] text-[#071024] shadow-[0_10px_24px_rgba(7,16,36,0.14)] hover:shadow-[0_24px_60px_rgba(7,16,36,0.16)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(7,16,36,0.14)]",
        outline: "glass border border-foreground/10 text-foreground shadow-[0_4px_12px_rgba(7,16,36,0.08)]",
        secondary: "glass border border-foreground/10 text-foreground shadow-[0_4px_12px_rgba(7,16,36,0.08)]",
        ghost: "hover:bg-accent/50 text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 px-4 text-sm rounded-xl",
        lg: "h-14 px-8 text-base rounded-2xl",
        icon: "h-11 w-11 rounded-xl",
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
