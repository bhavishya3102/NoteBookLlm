import Link from "next/link";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
    ManthanMark,
    ManthanWordmark,
} from "@/shared/components/brand/manthan-mark";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative isolate flex min-h-svh flex-col overflow-hidden">
            {/* atmosphere: the same warm bloom the landing page opens with */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-20"
                style={{
                    background:
                        "radial-gradient(115% 85% at 78% -12%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 58%), radial-gradient(80% 60% at 8% 105%, color-mix(in oklch, var(--citation) 12%, transparent), transparent 62%)",
                }}
            />

            {/* the churn, turning behind the card */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-[20rem] -right-[15rem] -z-10 opacity-[0.09]"
                style={{
                    maskImage:
                        "radial-gradient(closest-side, black 28%, transparent 68%)",
                    WebkitMaskImage:
                        "radial-gradient(closest-side, black 28%, transparent 68%)",
                }}
            >
                <ManthanMark className="size-[46rem] text-primary" animated />
            </div>

            <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
                <Link href="/" className="animate-rise inline-flex">
                    <ManthanWordmark size="md" />
                </Link>
                <div
                    className="animate-rise"
                    style={{ animationDelay: "80ms" }}
                >
                    <ModeToggle />
                </div>
            </header>

            <main className="flex flex-1 items-center justify-center px-6 pb-24">
                <div className="w-full max-w-sm">{children}</div>
            </main>
        </div>
    );
}
