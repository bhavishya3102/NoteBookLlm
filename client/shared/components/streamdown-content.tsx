"use client";

import { useMemo } from "react";
import { Streamdown, type Components, type ExtraProps } from "streamdown";
import { code } from "@streamdown/code";

type StreamdownContentProps = {
    content: string;
    mode?: "static" | "streaming";
    isAnimating?: boolean;
    className?: string;
};

type HastChildren = NonNullable<ExtraProps["node"]>["children"];

function containsImage(children: HastChildren | undefined): boolean {
    return (children ?? []).some(
        (child) =>
            child.type === "element" &&
            (child.tagName === "img" || containsImage(child.children)),
    );
}

// Streamdown renders images inside a <div> wrapper, which is invalid (and a
// hydration error) inside the <p> a markdown paragraph produces. Render such
// paragraphs as a <div> instead.
function Paragraph({
    node,
    ...props
}: React.ComponentProps<"p"> & ExtraProps) {
    return containsImage(node?.children) ? <div {...props} /> : <p {...props} />;
}

export function StreamdownContent({
    content,
    mode = "static",
    isAnimating = false,
    className,
}: StreamdownContentProps) {
    const plugins = useMemo(() => ({ code }), []);
    const components = useMemo<Components>(() => ({ p: Paragraph }), []);

    return (
        <Streamdown
            mode={mode}
            isAnimating={isAnimating}
            plugins={plugins}
            components={components}
            className={className}
        >
            {content}
        </Streamdown>
    );
}
