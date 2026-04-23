import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initializeManagedSchema, updateUserDataBySessionToken } from "@/app/lib/server/secure-store";

export const runtime = "nodejs";

const profileSchema = z.object({
  businessName: z.string().max(120),
  city: z.string().max(120),
  cuisineType: z.string().max(120),
  customerType: z.string().max(180),
  pricePoint: z.string().max(20),
});

const requestSchema = z.object({
  profile: profileSchema.optional(),
  restaurantData: z.record(z.string(), z.any()).optional(),
});

export async function PUT(request: NextRequest) {
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
    return NextResponse.json({ error: "Invalid data payload." }, { status: 400 });
  }

  try {
    await initializeManagedSchema();
    const user = await updateUserDataBySessionToken(token, {
      profile: parsed.data.profile,
      restaurantData: parsed.data.restaurantData as never,
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
