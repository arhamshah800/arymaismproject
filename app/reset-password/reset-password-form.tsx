"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ResetPayload = {
  error?: string;
  message?: string;
};

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!token) {
      setError("Missing reset token.");
      return;
    }

    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const payload = (await response.json()) as ResetPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset password.");
      }

      setNotice(payload.message ?? "Password updated successfully.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        router.replace("/");
      }, 1200);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to reset password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[1.65rem] border border-black/10 bg-[var(--card)] p-5 shadow-lg sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800/75">
          Reset Password
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-black">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-black/65">
          This link is single-use and expires after a short time.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
            placeholder="New password"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
            placeholder="Confirm new password"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Updating..." : "Save new password"}
          </button>
        </form>

        {notice && <p className="mt-3 text-sm text-teal-800">{notice}</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <Link href="/" className="mt-4 inline-block text-sm text-teal-800 underline">
          Back to login
        </Link>
      </section>
    </main>
  );
}
