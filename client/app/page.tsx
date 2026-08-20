import Link from "next/link";
import { ArrowRightIcon, QuoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { authRoutes, getSession } from "@/features/auth";
import {
    ManthanMark,
    ManthanWordmark,
} from "@/shared/components/brand/manthan-mark";

const SOURCE_TYPES = ["PDF", "WEBSITE", "YOUTUBE", "NOTES"] as const;

const STEPS = [
    {
        n: "01",
        title: "Pour in the sources",
        body: "Drop a syllabus PDF, a research site, a three-hour lecture, your own scribbled notes. Manthan extracts the text and keeps the original within reach.",
    },
    {
        n: "02",
        title: "Let the rope turn",
        body: "Every source is split, embedded and indexed, so retrieval happens over passages instead of whole documents — and each passage keeps its address.",
    },
    {
        n: "03",
        title: "Draw the nectar",
        body: "Ask, and the answer arrives with citations you can open. Or turn the same material into a summary, flashcards, a quiz, or a mind map.",
    },
] as const;

export default async function HomePage() {
    const session = await getSession();

    return (
        <main className="relative isolate min-h-svh overflow-hidden">
            {/* atmosphere: warm bloom in the top-right, where the churn sits */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-20"
                style={{
                    background:
                        "radial-gradient(115% 85% at 78% -12%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 58%), radial-gradient(80% 60% at 8% 105%, color-mix(in oklch, var(--citation) 12%, transparent), transparent 62%)",
                }}
            />

            {/* the churn: coils turning against each other */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-[26rem] -right-[22rem] -z-10 size-[62rem] text-primary/70 md:-top-[20rem] md:-right-[16rem]"
                style={{
                    maskImage:
                        "radial-gradient(closest-side, black 26%, transparent 62%)",
                    WebkitMaskImage:
                        "radial-gradient(closest-side, black 26%, transparent 62%)",
                }}
            >
                <svg viewBox="0 0 400 400" fill="none" className="size-full">
                    <g
                        className="animate-churn-slow"
                        style={{ transformOrigin: "200px 200px" }}
                    >
                        <circle
                            cx="200"
                            cy="200"
                            r="188"
                            stroke="currentColor"
                            strokeWidth="0.75"
                            strokeDasharray="2 9"
                            opacity="0.5"
                        />
                        <circle
                            cx="200"
                            cy="200"
                            r="152"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeDasharray="620 380"
                            strokeLinecap="round"
                            opacity="0.4"
                        />
                    </g>
                    <g
                        className="animate-churn-mid"
                        style={{ transformOrigin: "200px 200px" }}
                    >
                        <circle
                            cx="200"
                            cy="200"
                            r="118"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeDasharray="430 310"
                            strokeLinecap="round"
                            opacity="0.55"
                        />
                        <circle
                            cx="200"
                            cy="200"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="0.75"
                            strokeDasharray="3 10"
                            opacity="0.7"
                        />
                    </g>
                    <g
                        className="animate-churn-fast"
                        style={{ transformOrigin: "200px 200px" }}
                    >
                        <circle
                            cx="200"
                            cy="200"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeDasharray="190 160"
                            strokeLinecap="round"
                        />
                    </g>
                    <circle
                        cx="200"
                        cy="200"
                        r="6"
                        fill="currentColor"
                        className="animate-bloom"
                    />
                </svg>
            </div>

            {/* editorial grid: three hairlines holding the page together */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-full lg:block"
            >
                <div className="mx-auto grid h-full max-w-6xl grid-cols-4 px-6">
                    <div className="border-r border-border/45" />
                    <div className="border-r border-border/45" />
                    <div className="border-r border-border/45" />
                </div>
            </div>

            <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
                <ManthanWordmark
                    size="md"
                    animated
                    className="animate-rise"
                />
                <div
                    className="flex animate-rise items-center gap-2"
                    style={{ animationDelay: "80ms" }}
                >
                    <ModeToggle />
                    {session ? (
                        <Button
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                            render={<Link href={authRoutes.dashboard} />}
                        >
                            Dashboard
                        </Button>
                    ) : (
                        <Button
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                            render={<Link href={authRoutes.login} />}
                        >
                            Sign in
                        </Button>
                    )}
                </div>
            </header>

            <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 pt-10 pb-24 lg:grid-cols-12 lg:gap-10 lg:pt-20">
                <div className="lg:col-span-7">
                    <p
                        className="eyebrow animate-rise flex items-center gap-3"
                        style={{ animationDelay: "120ms" }}
                    >
                        <span
                            aria-hidden
                            className="h-px w-8 bg-border"
                        />
                        समुद्र मंथन — the churn
                    </p>

                    <h1
                        className="animate-rise mt-6 font-display text-5xl leading-[0.95] font-semibold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl"
                        style={{ animationDelay: "180ms" }}
                    >
                        Everything you have read,{" "}
                        <em className="font-normal italic text-primary">
                            answering back
                        </em>
                        .
                    </h1>

                    <p
                        className="reading-surface animate-rise mt-7 max-w-xl text-muted-foreground"
                        style={{ animationDelay: "260ms" }}
                    >
                        Manthan is a notebook that reads with you. Pour in PDFs,
                        websites, lectures and notes; ask questions in plain
                        language; get answers that carry the exact passage they
                        came from. Nothing invented, nothing unsourced.
                    </p>

                    <div
                        className="animate-rise mt-9 flex flex-wrap items-center gap-3"
                        style={{ animationDelay: "340ms" }}
                    >
                        <Link
                            href={
                                session
                                    ? authRoutes.dashboard
                                    : authRoutes.login
                            }
                            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-plate transition-all hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none active:translate-y-px"
                        >
                            Start a notebook
                            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="#how"
                            className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                        >
                            How the churn works
                        </Link>
                    </div>

                    <div
                        className="animate-rise mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 pt-6"
                        style={{ animationDelay: "420ms" }}
                    >
                        {SOURCE_TYPES.map((type) => (
                            <span
                                key={type}
                                className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.14em] text-secondary-foreground/80"
                            >
                                {type}
                            </span>
                        ))}
                        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
                            → one cited workspace
                        </span>
                    </div>
                </div>

                {/* specimen: what a grounded answer looks like */}
                <div
                    className="animate-rise lg:col-span-5"
                    style={{ animationDelay: "300ms" }}
                >
                    <div className="relative rotate-[-0.75deg] rounded-xl border border-border bg-card/90 p-6 shadow-lift backdrop-blur-sm transition-transform duration-500 hover:rotate-0">
                        <div className="flex items-center justify-between">
                            <span className="eyebrow">Answer · 3 sources</span>
                            <ManthanMark className="size-4 text-muted-foreground/60" />
                        </div>

                        <p className="mt-5 font-display text-lg leading-snug font-medium tracking-[-0.01em]">
                            Why did the devas and asuras cooperate at all?
                        </p>

                        <p className="reading-surface mt-4 text-card-foreground/85">
                            Neither side could turn the mountain alone — the rope
                            needed opposing pull to spin it
                            <sup>
                                <span className="ml-0.5 rounded-sm bg-citation/15 px-1 py-0.5 font-mono text-[0.625rem] font-medium text-citation">
                                    1
                                </span>
                            </sup>
                            . The alliance lasted exactly as long as the churning
                            did
                            <sup>
                                <span className="ml-0.5 rounded-sm bg-citation/15 px-1 py-0.5 font-mono text-[0.625rem] font-medium text-citation">
                                    2
                                </span>
                            </sup>
                            .
                        </p>

                        <div className="mt-6 space-y-2 border-t border-border/70 pt-4">
                            {[
                                { i: "1", label: "mythology-primer.pdf", loc: "p. 41" },
                                { i: "2", label: "lecture-10-transcript", loc: "18:24" },
                            ].map((source) => (
                                <div
                                    key={source.i}
                                    className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60"
                                >
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-citation/15 font-mono text-[0.625rem] font-medium text-citation">
                                        {source.i}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/75">
                                        {source.label}
                                    </span>
                                    <span className="font-mono text-[0.625rem] tracking-wider text-muted-foreground">
                                        {source.loc}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <QuoteIcon
                            aria-hidden
                            className="absolute -top-3 -left-3 size-7 rotate-180 rounded-md border border-border bg-background p-1.5 text-primary"
                        />
                    </div>
                </div>
            </section>

            <section
                id="how"
                className="mx-auto max-w-6xl scroll-mt-16 border-t border-border px-6 py-20"
            >
                <div className="grid gap-12 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <p className="eyebrow">The method</p>
                        <h2 className="mt-4 font-display text-3xl leading-tight font-semibold tracking-[-0.02em]">
                            Three turns of the rope.
                        </h2>
                        <p className="reading-surface mt-4 text-muted-foreground">
                            Retrieval is not magic; it is bookkeeping done well.
                            Manthan keeps the address of every passage so an
                            answer can always be traced home.
                        </p>
                    </div>

                    <ol className="lg:col-span-8 lg:col-start-6">
                        {STEPS.map((step, index) => (
                            <li
                                key={step.n}
                                className="group grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-border/70 py-7 first:pt-0 last:border-b-0 last:pb-0"
                            >
                                <span
                                    className="numerals text-2xl leading-none text-primary/70 transition-colors group-hover:text-primary"
                                    style={{
                                        animationDelay: `${index * 60}ms`,
                                    }}
                                >
                                    {step.n}
                                </span>
                                <div>
                                    <h3 className="text-base font-medium tracking-tight">
                                        {step.title}
                                    </h3>
                                    <p className="reading-surface mt-1.5 max-w-lg text-muted-foreground">
                                        {step.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <footer className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-border px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
                <ManthanWordmark size="sm" className="text-foreground/80" />
                <p className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase">
                    pgvector · inngest · mem0 · ai sdk
                </p>
            </footer>
        </main>
    );
}
