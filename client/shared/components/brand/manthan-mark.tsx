import { cn } from "@/lib/utils";

type ManthanMarkProps = {
    className?: string;
    /** Spin the outer coils — use in the hero, not in app chrome. */
    animated?: boolean;
};

/**
 * The churn: coils of rope around a fixed axis. Two arcs at different radii
 * turning against each other, with the pivot at the centre.
 */
export function ManthanMark({ className, animated = false }: ManthanMarkProps) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            className={cn("size-6", className)}
        >
            <g
                className={cn(animated && "animate-churn-mid")}
                style={{ transformOrigin: "16px 16px" }}
            >
                <circle
                    cx="16"
                    cy="16"
                    r="12.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeDasharray="58 100"
                    opacity="0.42"
                />
            </g>
            <g
                className={cn(animated && "animate-churn-fast")}
                style={{ transformOrigin: "16px 16px" }}
            >
                <circle
                    cx="16"
                    cy="16"
                    r="8.5"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeDasharray="40 100"
                    transform="rotate(140 16 16)"
                />
            </g>
            <circle
                cx="16"
                cy="16"
                r="4.25"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeDasharray="20 100"
                transform="rotate(-40 16 16)"
                opacity="0.85"
            />
            <circle cx="16" cy="16" r="1.85" fill="currentColor" />
        </svg>
    );
}

type WordmarkProps = {
    className?: string;
    size?: "sm" | "md" | "lg";
    animated?: boolean;
};

const SIZES = {
    sm: { mark: "size-5", text: "text-base", gap: "gap-2" },
    md: { mark: "size-6", text: "text-lg", gap: "gap-2.5" },
    lg: { mark: "size-8", text: "text-2xl", gap: "gap-3" },
} as const;

export function ManthanWordmark({
    className,
    size = "md",
    animated = false,
}: WordmarkProps) {
    const s = SIZES[size];

    return (
        <span className={cn("inline-flex items-center", s.gap, className)}>
            <ManthanMark className={cn(s.mark, "text-primary")} animated={animated} />
            <span
                className={cn(
                    "font-display font-semibold tracking-tight",
                    s.text,
                )}
            >
                Manthan
            </span>
        </span>
    );
}
