import { NextRequest, NextResponse } from "next/server";
import { initializeManagedSchema, logoutUserByToken } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("aryma_session")?.value;
  if (token) {
    await initializeManagedSchema();
    await logoutUserByToken(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "aryma_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
