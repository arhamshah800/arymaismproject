import { NextResponse } from "next/server";
import { z } from "zod";
import { initializeManagedSchema, issuePasswordResetToken } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email().max(180),
});

export async function POST(request: Request) {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  }

  await initializeManagedSchema();
  const token = await issuePasswordResetToken(parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: token
      ? "Password reset link created."
      : "If an account exists for that email, a reset link can be generated.",
    resetUrl: token ? `/reset-password?token=${encodeURIComponent(token)}` : null,
  });
}
