"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldSeparator,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn("size-4", className)}
        >
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callbackUrl =
        searchParams.get("callbackUrl") ?? authRoutes.dashboard;

    async function handleGoogleSignIn() {
        setIsLoading(true);
        setError(null);

        const { data, error } = await signIn.social({
            provider: "google",
            // Absolute URL: the OAuth callback is served by the API origin
            // (8080), so a relative path would resolve there and 404.
            callbackURL: new URL(callbackUrl, window.location.origin).toString(),
        });

        if (error) {
            setError(error.message ?? "Something went wrong. Please try again.");
            setIsLoading(false);
            return;
        }

        if (data?.url && data.redirect) {
            window.location.href = data.url;
            return;
        }

        setIsLoading(false);
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="animate-rise border-border/70 shadow-plate">
                <CardHeader className="text-center">
                    <p className="eyebrow flex items-center justify-center gap-3">
                        <span aria-hidden className="h-px w-6 bg-border" />
                        समुद्र मंथन
                        <span aria-hidden className="h-px w-6 bg-border" />
                    </p>
                    <CardTitle className="font-display mt-3 text-2xl font-semibold tracking-tight">
                        Welcome back
                    </CardTitle>
                    <CardDescription className="reading-surface">
                        Sign in with Google to continue to Manthan
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handleGoogleSignIn();
                        }}
                    >
                        <FieldGroup>
                            <Field>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="h-11 w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Spinner />
                                    ) : (
                                        <GoogleIcon />
                                    )}
                                    Continue with Google
                                </Button>
                                <FieldDescription className="text-center">
                                    By continuing, you agree to our terms of
                                    service and privacy policy.
                                </FieldDescription>
                            </Field>
                            <FieldSeparator className="eyebrow [&_[data-slot=field-separator-content]]:bg-card">
                                Secure sign-in
                            </FieldSeparator>
                            {error ? (
                                <p className="text-center text-sm text-destructive">
                                    {error}
                                </p>
                            ) : null}
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
