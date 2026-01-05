import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[14px] px-4 py-3 text-base text-white/90 placeholder:text-white/48 transition-all duration-150",
        "bg-white/[0.10] backdrop-blur-[14px] border border-white/[0.10]",
        "focus:outline-none focus:ring-[3px] focus:ring-[#A6E85B]/20 focus:border-white/[0.14]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
