"use client";

import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CreateWorkspaceCardProps = {
    onClick: () => void;
    className?: string;
};

export function CreateWorkspaceCard({
    onClick,
    className,
}: CreateWorkspaceCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group flex min-h-[184px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-6 text-center transition-all hover:border-primary/45 hover:bg-primary/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                className,
            )}
        >
            <span className="flex size-11 items-center justify-center rounded-xl border border-border/80 bg-background transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                <PlusIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </span>
            <div className="space-y-1.5">
                <p className="font-heading font-medium">Create notebook</p>
                <p className="eyebrow">Pour in your sources</p>
            </div>
        </button>
    );
}
