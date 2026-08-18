"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceTypeIcon, useSources } from "@/features/sources";
import {
    ARTIFACT_TYPE_DESCRIPTIONS,
    ARTIFACT_TYPE_LABELS,
    ARTIFACT_TYPES,
} from "../lib/constants";
import { useCreateArtifact } from "../hooks/use-artifacts";
import type { ArtifactType } from "../lib/types";

type GenerateArtifactDialogProps = {
    workspaceId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GenerateArtifactDialog({
    workspaceId,
    open,
    onOpenChange,
}: GenerateArtifactDialogProps) {
    const [type, setType] = useState<ArtifactType>("SUMMARY");
    const [title, setTitle] = useState("");
    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const createArtifact = useCreateArtifact(workspaceId);
    const sourcesQuery = useSources(workspaceId, { status: "READY" });

    const readySources = sourcesQuery.data ?? [];
    const selectedSources = readySources.filter(
        (source) => !excludedIds.includes(source.id),
    );
    const allSelected =
        readySources.length > 0 && selectedSources.length === readySources.length;

    function toggleSource(sourceId: string) {
        setExcludedIds((current) =>
            current.includes(sourceId)
                ? current.filter((id) => id !== sourceId)
                : [...current, sourceId],
        );
    }

    function toggleAll() {
        setExcludedIds(
            allSelected ? readySources.map((source) => source.id) : [],
        );
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        await createArtifact.mutateAsync({
            type,
            title: title.trim() || undefined,
            sourceIds: allSelected
                ? undefined
                : selectedSources.map((source) => source.id),
        });

        setTitle("");
        setExcludedIds([]);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <form onSubmit={(event) => void handleSubmit(event)}>
                    <DialogHeader>
                        <DialogTitle>Generate learning tool</DialogTitle>
                        <DialogDescription>
                            Pick the sources to learn from. Generation runs in
                            the background via Inngest.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="artifact-type">Type</Label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {ARTIFACT_TYPES.map((artifactType) => (
                                    <button
                                        key={artifactType}
                                        type="button"
                                        onClick={() => setType(artifactType)}
                                        className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                                            type === artifactType
                                                ? "border-primary bg-primary/10"
                                                : "hover:bg-muted/50"
                                        }`}
                                    >
                                        <p className="text-sm font-medium">
                                            {
                                                ARTIFACT_TYPE_LABELS[
                                                    artifactType
                                                ]
                                            }
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {
                                                ARTIFACT_TYPE_DESCRIPTIONS[
                                                    artifactType
                                                ]
                                            }
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>
                                    Sources
                                    {readySources.length > 0 ? (
                                        <span className="ml-1 font-normal text-muted-foreground">
                                            ({selectedSources.length} of{" "}
                                            {readySources.length} selected)
                                        </span>
                                    ) : null}
                                </Label>
                                {readySources.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={toggleAll}
                                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                    >
                                        {allSelected
                                            ? "Clear all"
                                            : "Select all"}
                                    </button>
                                ) : null}
                            </div>

                            {sourcesQuery.isPending ? (
                                <p className="text-xs text-muted-foreground">
                                    Loading sources...
                                </p>
                            ) : readySources.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    No ready sources yet. Add and process a
                                    source first.
                                </p>
                            ) : (
                                <div className="max-h-40 overflow-y-auto rounded-2xl border p-1">
                                    {readySources.map((source) => (
                                        <label
                                            key={source.id}
                                            className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                checked={
                                                    !excludedIds.includes(
                                                        source.id,
                                                    )
                                                }
                                                onCheckedChange={() =>
                                                    toggleSource(source.id)
                                                }
                                            />
                                            <SourceTypeIcon
                                                type={source.type}
                                                className="size-4 shrink-0 text-muted-foreground"
                                            />
                                            <span className="truncate text-sm">
                                                {source.title}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="artifact-title">
                                Title (optional)
                            </Label>
                            <Input
                                id="artifact-title"
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder="Custom title"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                createArtifact.isPending ||
                                selectedSources.length === 0
                            }
                        >
                            Generate
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
