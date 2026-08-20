"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
    BotIcon,
    DownloadIcon,
    GlobeIcon,
    MessageSquarePlusIcon,
    Trash2Icon,
} from "lucide-react";
import {
    Message,
    MessageAvatar,
    MessageContent,
    MessageFooter,
} from "@/components/ui/message";
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    chatKeys,
    useConversationMessages,
    useConversations,
    useCreateConversation,
    useDeleteConversation,
} from "../hooks/use-conversations";
import { parseCitations } from "../lib/api";
import { ChatMessageBody } from "./chat-message-body";
import { CitationSources } from "./citation-sources";
import { ManthanMark } from "@/shared/components/brand/manthan-mark";
import { ChatComposer } from "./chat-composer";
import type { ChatCitation } from "../lib/types";
import { workspaceRoutes } from "@/features/workspaces/lib/routes";
import {
    defaultChatPrefs,
    useChatPreferences,
} from "../stores/chat-preferences";
import {
    downloadMarkdown,
    exportConversationMarkdown,
} from "../lib/export-chat";

type WorkspaceChatProps = {
    workspaceId: string;
    defaultModel?: string;
};

function getMessageText(message: UIMessage) {
    return message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
}

export function WorkspaceChat({
    workspaceId,
    defaultModel,
}: WorkspaceChatProps) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const askPrompt = searchParams.get("ask");
    const handledAskPrompt = useRef<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    /* Conversation whose history is already in `messages` — prevents a
       server refetch from replacing (and remounting) the live thread. */
    const hydratedConversationRef = useRef<string | null>(null);

    const storedPrefs = useChatPreferences(
        (state) => state.byWorkspace[workspaceId],
    );
    const setWebSearch = useChatPreferences((state) => state.setWebSearch);
    const chatPrefs = useMemo(
        () => storedPrefs ?? defaultChatPrefs(defaultModel),
        [storedPrefs, defaultModel],
    );

    const { data: conversations = [], isLoading: conversationsLoading } =
        useConversations(workspaceId);
    const { data: storedMessages, isLoading: messagesLoading } =
        useConversationMessages(workspaceId, conversationId);
    const createConversation = useCreateConversation(workspaceId);
    const deleteConversation = useDeleteConversation(workspaceId);

    const activeConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
    );

    const handleConversationId = useCallback(
        (id: string) => {
            setConversationId(id);
            void queryClient.invalidateQueries({
                queryKey: chatKeys(workspaceId).conversations(),
            });
        },
        [queryClient, workspaceId],
    );

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `/api/workspaces/${workspaceId}/chat`,
                credentials: "include",
                body: {
                    ...(conversationId ? { conversationId } : {}),
                    model: chatPrefs.model,
                    webSearch: chatPrefs.webSearch,
                },
                fetch: async (url, init) => {
                    const response = await fetch(url, {
                        ...init,
                        credentials: "include",
                    });

                    const newConversationId =
                        response.headers.get("X-Conversation-Id");
                    if (newConversationId) {
                        handleConversationId(newConversationId);
                    }

                    return response;
                },
            }),
        [
            workspaceId,
            conversationId,
            handleConversationId,
            chatPrefs.model,
            chatPrefs.webSearch,
        ],
    );

    const { messages, sendMessage, setMessages, status, stop, error } = useChat(
        {
            transport,
            // Batch stream deltas into ~20fps paints instead of one render per token.
            throttle: 50,
        },
    );

    const isStreaming = status === "streaming" || status === "submitted";

    /* A conversation id that arrives mid-stream belongs to the thread already
       on screen, so it counts as hydrated — nothing to load from the server. */
    useEffect(() => {
        if (conversationId && isStreaming) {
            hydratedConversationRef.current = conversationId;
        }
    }, [conversationId, isStreaming]);

    /* Loads history when a different conversation is selected. It must never
       clear `messages` — a fresh chat has no id yet while its first question
       is already on screen, and wiping it there loses the question. */
    useEffect(() => {
        if (
            !conversationId ||
            !storedMessages ||
            isStreaming ||
            hydratedConversationRef.current === conversationId
        ) {
            return;
        }

        hydratedConversationRef.current = conversationId;
        setMessages(
            storedMessages.map((message) => ({
                id: message.id,
                role: message.role === "USER" ? "user" : "assistant",
                parts: [{ type: "text" as const, text: message.content }],
            })),
        );
    }, [conversationId, storedMessages, setMessages, isStreaming]);

    useEffect(() => {
        if (status !== "ready" || !conversationId) {
            return;
        }

        void queryClient.invalidateQueries({
            queryKey: chatKeys(workspaceId).messages(conversationId),
        });
    }, [status, conversationId, queryClient, workspaceId]);

    /* Persisted citations are keyed by the server's message id, while a
       streamed reply still carries its client id. Align the two by their
       position in the assistant sequence so citations attach without
       swapping message ids (which would remount the whole thread). */
    const citationsByMessageId = useMemo(() => {
        const map: Record<string, ChatCitation[]> = {};

        if (!storedMessages) {
            return map;
        }

        const localAssistantIds = messages
            .filter((message) => message.role === "assistant")
            .map((message) => message.id);
        let assistantIndex = 0;

        for (const stored of storedMessages) {
            if (stored.role !== "ASSISTANT") {
                continue;
            }

            const localId = localAssistantIds[assistantIndex];
            assistantIndex += 1;

            const citations = parseCitations(stored.citations);
            if (localId && citations?.length) {
                map[localId] = citations;
            }
        }

        return map;
    }, [storedMessages, messages]);

    useEffect(() => {
        if (
            !askPrompt ||
            status !== "ready" ||
            conversationId ||
            messages.length > 0 ||
            handledAskPrompt.current === askPrompt
        ) {
            return;
        }

        handledAskPrompt.current = askPrompt;
        void sendMessage({ text: askPrompt });
        router.replace(workspaceRoutes.detail(workspaceId));
    }, [
        askPrompt,
        status,
        conversationId,
        messages.length,
        sendMessage,
        router,
        workspaceId,
    ]);

    async function handleNewChat() {
        hydratedConversationRef.current = null;
        setConversationId(null);
        setMessages([]);
    }

    function handleSelectConversation(id: string) {
        hydratedConversationRef.current = null;
        setMessages([]);
        setConversationId(id);
    }

    async function handleDeleteConversation() {
        if (!conversationId) {
            return;
        }

        await deleteConversation.mutateAsync(conversationId);
        await handleNewChat();
    }

    /* Only a cold history load may replace the thread. Once messages are on
       screen the refetch that follows a stream must not flash skeletons. */
    const showHistorySkeleton =
        messages.length === 0 && (conversationsLoading || messagesLoading);

    function handleExportChat() {
        if (messages.length === 0) {
            return;
        }

        const markdown = exportConversationMarkdown({
            conversation: activeConversation ?? null,
            messages,
            citationsByMessageId,
        });
        const slug =
            activeConversation?.title?.replace(/[^\w-]+/g, "-").toLowerCase() ??
            "chat";
        downloadMarkdown(markdown, `${slug}-${Date.now()}.md`);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                <Select
                    value={conversationId ?? "new"}
                    onValueChange={(value) => {
                        if (!value || value === "new") {
                            void handleNewChat();
                            return;
                        }
                        handleSelectConversation(value);
                    }}
                >
                    <SelectTrigger className="max-w-sm flex-1">
                        <SelectValue placeholder="Select conversation" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="new">New chat</SelectItem>
                        {conversations.map((conversation) => (
                            <SelectItem
                                key={conversation.id}
                                value={conversation.id}
                            >
                                {conversation.title ?? "Untitled chat"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleNewChat()}
                >
                    <MessageSquarePlusIcon />
                    New
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={messages.length === 0}
                    onClick={handleExportChat}
                >
                    <DownloadIcon />
                    Export
                </Button>

                {conversationId ? (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDeleteConversation()}
                        disabled={deleteConversation.isPending}
                    >
                        <Trash2Icon />
                    </Button>
                ) : null}
            </div>

            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                <MessageScroller className="min-h-0 flex-1">
                    <MessageScrollerViewport>
                        <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
                            {showHistorySkeleton ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-16 w-2/3 rounded-3xl" />
                                    <Skeleton className="ml-auto h-16 w-1/2 rounded-3xl" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="animate-rise flex flex-col items-center justify-center gap-4 py-20 text-center">
                                    <ManthanMark
                                        className="size-14 text-primary/70"
                                        animated
                                    />
                                    <p className="eyebrow flex items-center gap-3">
                                        <span
                                            aria-hidden
                                            className="h-px w-6 bg-border"
                                        />
                                        the churn
                                        <span
                                            aria-hidden
                                            className="h-px w-6 bg-border"
                                        />
                                    </p>
                                    <div className="space-y-2">
                                        <p className="font-display text-2xl font-semibold tracking-tight">
                                            Chat with your sources
                                        </p>
                                        <p className="reading-surface max-w-sm text-muted-foreground">
                                            Ask questions about the materials
                                            in this workspace. Answers include
                                            citations when relevant context is
                                            found.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message, messageIndex) => {
                                        const isUser = message.role === "user";
                                        const citations =
                                            citationsByMessageId[message.id];
                                        const isLastMessage =
                                            messageIndex === messages.length - 1;
                                        const isAnimatingMessage =
                                            !isUser &&
                                            isStreaming &&
                                            isLastMessage;

                                        return (
                                            <MessageScrollerItem
                                                key={message.id}
                                                messageId={message.id}
                                                scrollAnchor={isUser}
                                            >
                                                <Message
                                                    align={
                                                        isUser ? "end" : "start"
                                                    }
                                                >
                                                    {!isUser ? (
                                                        <MessageAvatar className="size-8">
                                                            <BotIcon className="size-4" />
                                                        </MessageAvatar>
                                                    ) : null}
                                                    <MessageContent>
                                                        <Bubble
                                                            align={
                                                                isUser
                                                                    ? "end"
                                                                    : "start"
                                                            }
                                                            variant={
                                                                isUser
                                                                    ? "default"
                                                                    : "ghost"
                                                            }
                                                        >
                                                            <BubbleContent className="leading-relaxed">
                                                                {isUser ? (
                                                                    getMessageText(
                                                                        message,
                                                                    )
                                                                ) : (
                                                                    <ChatMessageBody
                                                                        text={getMessageText(
                                                                            message,
                                                                        )}
                                                                        citations={
                                                                            citations
                                                                        }
                                                                        workspaceId={
                                                                            workspaceId
                                                                        }
                                                                        isAnimating={
                                                                            isAnimatingMessage
                                                                        }
                                                                    />
                                                                )}
                                                            </BubbleContent>
                                                        </Bubble>
                                                        {!isUser &&
                                                        citations?.length ? (
                                                            <MessageFooter className="mt-1 w-full max-w-full flex-col items-start gap-0 px-0">
                                                                <CitationSources
                                                                    workspaceId={
                                                                        workspaceId
                                                                    }
                                                                    citations={
                                                                        citations
                                                                    }
                                                                />
                                                            </MessageFooter>
                                                        ) : null}
                                                    </MessageContent>
                                                </Message>
                                            </MessageScrollerItem>
                                        );
                                    })}
                                </>
                            )}
                        </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton direction="end" />
                </MessageScroller>
            </MessageScrollerProvider>

            {error ? (
                <div className="shrink-0 border-t bg-destructive/5 px-4 py-2 text-sm text-destructive">
                    {error.message}
                </div>
            ) : null}

            <ChatComposer
                disabled={createConversation.isPending}
                isStreaming={isStreaming}
                onStop={stop}
                webSearchEnabled={chatPrefs.webSearch}
                onWebSearchChange={(enabled) =>
                    setWebSearch(workspaceId, enabled)
                }
                onSubmit={(text) => {
                    void sendMessage({ text });
                }}
            />
        </div>
    );
}
