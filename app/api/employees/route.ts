import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createEmployeeAccountByOwnerSessionToken,
  getUserBySessionToken,
  initializeManagedSchema,
} from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(6).max(120),
  displayName: z.string().trim().min(1).max(120),
  position: z.string().trim().max(120).optional(),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get("aryma_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initializeManagedSchema();
  const user = await getUserBySessionToken(token);

  if (!user || user.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ employees: user.employees });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("aryma_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid employee payload." }, { status: 400 });
  }

  try {
    await initializeManagedSchema();
    const employees = await createEmployeeAccountByOwnerSessionToken(token, parsed.data);
    return NextResponse.json({ employees });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create employee account.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
