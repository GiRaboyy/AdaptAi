import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-all duration-150",
        "bg-white border border-border",
        "focus:outline-none focus:ring-[3px] focus:ring-[#A6E85B]/25 focus:border-[#A6E85B]",
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
