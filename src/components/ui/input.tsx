import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input placeholder:text-muted-foreground flex h-11 w-full min-w-0 rounded-md border bg-background/60 px-3 py-1 text-base text-foreground transition-[color,box-shadow] outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
