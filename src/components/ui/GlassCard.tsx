import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function GlassCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass rounded-3xl p-8 border-t border-l border-white/20 shadow-2xl", className)}
      {...props}
    >
      {children}
    </div>
  );
}
