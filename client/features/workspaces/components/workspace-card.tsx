"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ManthanMark } from "@/shared/components/brand/manthan-mark";
import { getWorkspaceAccent } from "../lib/workspace-accents";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";

type WorkspaceCardProps = {
    workspace: Workspace;
    onEdit: (workspace: Workspace) => void;
    onDelete: (workspace: Workspace) => void;
    className?: string;
};

export function WorkspaceCard({
    workspace,
    onEdit,
    onDelete,
    className,
}: WorkspaceCardProps) {
    const href = workspaceRoutes.detail(workspace.id);
    const accent = getWorkspaceAccent(workspace.id);

    return (
        <article
            style={{ "--accent": accent } as React.CSSProperties}
            className={cn(
                "group/card relative isolate flex min-h-[184px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-plate transition-all duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--accent)_40%,var(--border))] hover:shadow-lift",
                className,
            )}
        >
            {/* the accent reads as a bound edge, not a wash over the whole plate */}
            <span
                aria-hidden
                className="absolute inset-x-0 top-0 z-10 h-[2px]"
                style={{
                    background:
                        "linear-gradient(90deg, var(--accent), color-mix(in oklch, var(--accent) 15%, transparent))",
                }}
            />
            <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-16 -z-10 size-52 rounded-full opacity-[0.10] transition-opacity duration-300 group-hover/card:opacity-[0.18]"
                style={{
                    background:
                        "radial-gradient(closest-side, var(--accent), transparent 70%)",
                }}
            />
            <ManthanMark
                className="pointer-events-none absolute -right-7 -bottom-9 -z-10 size-32 text-foreground opacity-[0.045]"
            />

            <Link
                href={href}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label={`Open ${workspace.title}`}
            />

            <div className="pointer-events-none relative flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                    <span
                        className="flex size-11 items-center justify-center rounded-xl border text-2xl"
                        style={{
                            borderColor:
                                "color-mix(in oklch, var(--accent) 28%, transparent)",
                            background:
                                "color-mix(in oklch, var(--accent) 10%, transparent)",
                        }}
                    >
                        {workspace.icon ?? "📚"}
                    </span>

                    <div
                        className="pointer-events-auto relative z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="size-8 text-muted-foreground"
                                    />
                                }
                            >
                                <MoreHorizontalIcon />
                                <span className="sr-only">Open menu</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => onEdit(workspace)}
                                >
                                    <PencilIcon />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => onDelete(workspace)}
                                >
                                    <Trash2Icon />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="mt-auto space-y-1.5 pt-8">
                    <h3 className="font-heading line-clamp-2 text-lg leading-snug font-semibold tracking-tight">
                        {workspace.title}
                    </h3>
                    {workspace.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            {workspace.description}
                        </p>
                    ) : null}
                    <p className="eyebrow pt-1">
                        Updated{" "}
                        {formatDistanceToNow(new Date(workspace.updatedAt), {
                            addSuffix: true,
                        })}
                    </p>
                </div>
            </div>
        </article>
    );
}
