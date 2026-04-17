import { google } from "@ai-sdk/google";
import { generateText, type ModelMessage } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const modeSchema = z.enum(["chatbot", "inventory", "reviews", "menu", "personality"]);

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const businessProfileSchema = z.object({
  businessName: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  cuisineType: z.string().max(120).optional(),
  customerType: z.string().max(180).optional(),
  pricePoint: z.string().max(20).optional(),
});

const requestSchema = z.object({
  mode: modeSchema.default("chatbot"),
  messages: z.array(messageSchema).min(1).max(40),
  businessProfile: businessProfileSchema.optional(),
});

type AssistantMode = z.infer<typeof modeSchema>;
type BusinessProfile = z.infer<typeof businessProfileSchema> | undefined;
type GoogleModelId = Parameters<typeof google>[0];

const FALLBACK_MODELS: GoogleModelId[] = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

function isModelAvailabilityError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("is not found") ||
    normalized.includes("not supported for generatecontent") ||
    normalized.includes("model not found")
  );
}

function getModelCandidates(): GoogleModelId[] {
  const envModel = process.env.GOOGLE_MODEL as GoogleModelId | undefined;

  if (!envModel) {
    return FALLBACK_MODELS;
  }

  return [envModel, ...FALLBACK_MODELS.filter((modelId) => modelId !== envModel)];
}

function buildSystemPrompt(mode: AssistantMode, businessProfile: BusinessProfile): string {
  const businessContext = [
    `Business Name: ${businessProfile?.businessName || "Not provided"}`,
    `City/Area: ${businessProfile?.city || "Dallas-Fort Worth"}`,
    `Cuisine: ${businessProfile?.cuisineType || "Not provided"}`,
    `Core Customers: ${businessProfile?.customerType || "Not provided"}`,
    `Price Point: ${businessProfile?.pricePoint || "Not provided"}`,
  ].join("\n");

  const corePolicy = `
You are Aryma ISM AI, an operations-focused assistant for small and medium food enterprises in the Dallas-Fort Worth area.
Be practical, concise, and supportive.
When information is missing, state assumptions clearly and give an action plan that can start today.
Default output format:
1) Quick recommendation
2) Why it works
3) Step-by-step actions
4) Optional risks to watch
  `.trim();

  const modeInstructions: Record<AssistantMode, string> = {
    chatbot: `
Act as a general business chatbot for local food operators.
Help with staffing, daily operations, messaging, promotions, and customer communication.
Prefer actionable checklists and scripts they can copy.
    `.trim(),
    inventory: `
Act as an inventory manager assistant.
Prioritize stockout prevention, waste reduction, and margin protection.
If quantities are provided, produce a reorder plan and practical par levels.
If data is partial, still provide a best-effort plan with assumptions.
    `.trim(),
    reviews: `
Act as a customer review issue solver.
Always provide:
- a ready-to-post customer response (empathetic, non-defensive, short)
- an internal corrective action plan for team operations
- one follow-up metric to track improvement
    `.trim(),
    menu: `
Act as a menu suggester for first-time customers.
Recommend approachable, high-satisfaction combos with alternatives for dietary needs.
Include a short upsell suggestion that feels helpful, not pushy.
    `.trim(),
    personality: `
Act as a personality-based order recommendation engine.
Infer customer style from the conversation (adventurous, comfort-seeking, health-focused, budget-minded, etc.).
Then propose personalized menu orders and a matching add-on strategy.
Explain the reasoning in plain language.
    `.trim(),
  };

  return `${corePolicy}

Business Context:
${businessContext}

Current Mode:
${modeInstructions[mode]}`;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error:
          "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it in your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request payload.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const modelMessages: ModelMessage[] = parsed.data.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const modelCandidates = getModelCandidates();

  try {
    let lastError: unknown;

    for (const modelId of modelCandidates) {
      try {
        const result = await generateText({
          model: google(modelId),
          system: buildSystemPrompt(parsed.data.mode, parsed.data.businessProfile),
          messages: modelMessages,
          temperature: 0.3,
        });

        return Response.json({
          answer: result.text.trim(),
          model: modelId,
        });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : "";

        if (isModelAvailabilityError(message)) {
          continue;
        }

        throw error;
      }
    }

    const terminalMessage =
      lastError instanceof Error
        ? lastError.message
        : "No available Gemini model could be used with the current API key.";

    return Response.json(
      {
        error: `Unable to generate assistant response: ${terminalMessage}. Tried models: ${modelCandidates.join(", ")}`,
      },
      { status: 500 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The model request failed unexpectedly.";

    return Response.json(
      {
        error: `Unable to generate assistant response: ${message}`,
      },
      { status: 500 },
    );
  }
}
