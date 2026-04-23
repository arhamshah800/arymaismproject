"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "signup" | "forgot";

type AuthPayload = {
  error?: string;
  resetUrl?: string | null;
  message?: string;
};

async function checkAuthenticated(): Promise<boolean> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return response.ok;
}

export function AuthGate() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const authenticated = await checkAuthenticated();
        if (authenticated) {
          router.replace("/dashboard");
          return;
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError(null);
    setNotice(null);
    setResetUrl(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setResetUrl(null);

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (authMode !== "forgot" && !password) {
      setError("Email and password are required.");
      return;
    }

    if (authMode === "signup") {
      if (password.length < 6) {
        setError("Use at least 6 characters for your password.");
        return;
      }

      if (password !== form.confirmPassword.trim()) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const endpoint =
        authMode === "signup"
          ? "/api/auth/register"
          : authMode === "forgot"
            ? "/api/auth/request-password-reset"
            : "/api/auth/login";

      const body =
        authMode === "forgot"
          ? { email }
          : {
              email,
              password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as AuthPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Authentication failed.");
      }

      if (authMode === "forgot") {
        setNotice(
          payload.message ??
            "If that account exists, you can continue using the reset link below.",
        );
        setResetUrl(payload.resetUrl ?? null);
        return;
      }

      router.replace("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Authentication failed unexpectedly.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-black/10 bg-[var(--card)] px-6 py-4 text-sm text-black/70 shadow-sm">
          Checking session...
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[1.65rem] border border-black/10 bg-[var(--card)] p-5 shadow-lg sm:p-6">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/[0.04] p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              authMode === "login"
                ? "bg-teal-700 text-white"
                : "text-black/65 hover:bg-white hover:text-black"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              authMode === "signup"
                ? "bg-teal-700 text-white"
                : "text-black/65 hover:bg-white hover:text-black"
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              authMode === "forgot"
                ? "bg-teal-700 text-white"
                : "text-black/65 hover:bg-white hover:text-black"
            }`}
          >
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
            placeholder="Email"
          />

          {authMode !== "forgot" && (
            <input
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              placeholder="Password"
            />
          )}

          {authMode === "signup" && (
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              placeholder="Confirm Password"
            />
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : authMode === "login"
                ? "Enter Dashboard"
                : authMode === "signup"
                  ? "Create and Continue"
                  : "Create Reset Link"}
          </button>
        </form>

        {notice && <p className="mt-3 text-sm text-teal-800">{notice}</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        {resetUrl && (
          <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm">
            <p className="font-semibold text-black">Reset link</p>
            <Link href={resetUrl} className="mt-2 block break-all text-teal-800 underline">
              {resetUrl}
            </Link>
          </div>
        )}
      </section>

      <Link
        href="/about"
        aria-label="About this app"
        className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-[var(--card)] text-sm font-semibold text-black/70 shadow-sm transition hover:border-teal-600 hover:bg-teal-700 hover:text-white"
      >
        i
      </Link>
    </main>
  );
}
