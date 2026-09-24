import Link from "next/link";
import { BrainCircuit } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-display text-xl font-bold", className)}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow-primary">
        <BrainCircuit className="size-5" />
      </span>
      <span>
        Exa<span className="text-primary">Mente</span>
      </span>
    </Link>
  );
}
