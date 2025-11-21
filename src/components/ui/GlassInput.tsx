import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> { }

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "glass w-full rounded-xl px-4 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 bg-white/5",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
GlassInput.displayName = "GlassInput";

export { GlassInput };
