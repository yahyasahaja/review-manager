import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost" | "google";
  isLoading?: boolean;
}

export function GlassButton({
  children,
  className,
  variant = "primary",
  isLoading = false,
  disabled,
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(
        "liquid-glass-button font-medium text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden flex items-center justify-center gap-2",
        variant === "danger" && "liquid-glass-danger",
        variant === "ghost" && "liquid-glass-ghost",
        variant === "primary" && "liquid-glass-primary",
        isLoading && "cursor-wait",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {children}
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4 text-white shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
    </button>
  );
}
