import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[14px] px-4 py-2.5 text-base text-white/90 placeholder:text-white/48 transition-all duration-150",
          "bg-white/[0.10] backdrop-blur-[14px] border border-white/[0.10]",
          "focus:outline-none focus:ring-[3px] focus:ring-[#A6E85B]/20 focus:border-white/[0.14]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-[#FB7185]/60 aria-[invalid=true]:bg-[#FB7185]/[0.08]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
