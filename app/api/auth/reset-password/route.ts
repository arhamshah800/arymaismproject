import { NextResponse } from "next/server";
import { z } from "zod";
import { initializeManagedSchema, resetPasswordWithToken } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

const requestSchema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(6).max(120),
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
    return NextResponse.json({ error: "Invalid password reset payload." }, { status: 400 });
  }

  try {
    await initializeManagedSchema();
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully. Please log in with your new password.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
