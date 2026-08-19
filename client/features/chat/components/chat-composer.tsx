"use client";

import { useEffect, useRef, useState } from "react";
import { GlobeIcon, SendIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
    onSubmit: (text: string) => void;
    onStop?: () => void;
    disabled?: boolean;
    isStreaming?: boolean;
    webSearchEnabled?: boolean;
    onWebSearchChange?: (enabled: boolean) => void;
};

export function ChatComposer({
    onSubmit,
    onStop,
    disabled = false,
    isStreaming = false,
    webSearchEnabled = false,
    onWebSearchChange,
}: ChatComposerProps) {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /* Grow with the text instead of jumping to a scrollbar at one row. */
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }, [input]);

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        const text = input.trim();
        if (!text || disabled || isStreaming) {
            return;
        }

        onSubmit(text);
        setInput("");
    }

    return (
        <form onSubmit={handleSubmit} className="shrink-0 border-t bg-background p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
                {onWebSearchChange ? (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={webSearchEnabled ? "secondary" : "outline"}
                            aria-pressed={webSearchEnabled}
                            className={cn(
                                "rounded-full transition-colors",
                                webSearchEnabled &&
                                    "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20",
                            )}
                            onClick={() => onWebSearchChange(!webSearchEnabled)}
                            disabled={disabled}
                        >
                            <GlobeIcon />
                            Web search
                            <span
                                className={cn(
                                    "ml-1 size-1.5 rounded-full transition-colors",
                                    webSearchEnabled
                                        ? "bg-primary"
                                        : "bg-muted-foreground/40",
                                )}
                                aria-hidden="true"
                            />
                        </Button>
                        {webSearchEnabled ? (
                            <span className="text-xs text-muted-foreground">
                                Tavily will search the web when needed
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex items-end gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask about your sources…"
                        rows={1}
                        className="min-h-[44px] max-h-40 resize-none"
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                handleSubmit(event);
                            }
                        }}
                        disabled={disabled}
                    />
                    {isStreaming && onStop ? (
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={onStop}
                            aria-label="Stop generating"
                        >
                            <SquareIcon className="fill-current" />
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            size="icon"
                            disabled={disabled || isStreaming || !input.trim()}
                            aria-label="Send message"
                        >
                            <SendIcon />
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
}
