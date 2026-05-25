import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<"span"> & {
  size?: "sm" | "md" | "lg";
};

const sizeClassName: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin text-current", sizeClassName[size])} />
    </span>
  );
}

export { Spinner };

