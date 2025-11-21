import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost" | "google";
}

export function GlassButton({
  children,
  className,
  variant = "primary",
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(
        "liquid-glass-button font-medium text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variant === "danger" && "liquid-glass-danger",
        variant === "ghost" && "liquid-glass-ghost",
        variant === "primary" && "liquid-glass-primary",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
