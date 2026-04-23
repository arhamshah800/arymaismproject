import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken, initializeManagedSchema } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("aryma_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initializeManagedSchema();
  const user = await getUserBySessionToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
