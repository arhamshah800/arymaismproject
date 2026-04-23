import { NextResponse } from "next/server";
import { z } from "zod";
import { initializeManagedSchema, loginUser } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(1).max(120),
});

function buildCookieSecureFlag() {
  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload." }, { status: 400 });
  }

  try {
    await initializeManagedSchema();
    const { user, sessionToken } = await loginUser(parsed.data.email, parsed.data.password);
    const response = NextResponse.json({ user });

    response.cookies.set({
      name: "aryma_session",
      value: sessionToken,
      httpOnly: true,
      secure: buildCookieSecureFlag(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
}
