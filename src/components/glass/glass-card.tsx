import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "subtle";
}

export function GlassCard({
  className,
  variant = "default",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variant === "default" && "glass",
        variant === "strong" && "glass-strong",
        variant === "subtle" && "glass-subtle",
        "p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
