"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type AssistantMode =
  | "chatbot"
  | "inventory"
  | "reviews"
  | "menu"
  | "personality";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type BusinessProfile = {
  businessName: string;
  city: string;
  cuisineType: string;
  customerType: string;
  pricePoint: string;
};

type ModeConfig = {
  id: AssistantMode;
  label: string;
  description: string;
  focus: string;
  starterPrompt: string;
};

const MODES: ModeConfig[] = [
  {
    id: "chatbot",
    label: "Chatbot Concierge",
    description: "General assistant for daily restaurant operations.",
    focus: "Answer operational questions and draft customer-ready messaging.",
    starterPrompt:
      "Give me a simple operating checklist for opening my cafe tomorrow morning.",
  },
  {
    id: "inventory",
    label: "Inventory Manager",
    description: "Track stock risk and recommend reorder priorities.",
    focus: "Reduce waste, prevent stockouts, and improve purchasing timing.",
    starterPrompt:
      "I have 9 lbs chicken, 2 lbs salmon, and 1 case fries. Build a 3-day reorder plan.",
  },
  {
    id: "reviews",
    label: "Review Issue Solver",
    description: "Handle negative reviews with calm, brand-safe responses.",
    focus: "Repair trust, de-escalate issues, and suggest internal fixes.",
    starterPrompt:
      "A guest said service was slow and food was cold. Draft a response and an internal action plan.",
  },
  {
    id: "menu",
    label: "Menu Suggester",
    description: "Suggest first-time-customer friendly menu combinations.",
    focus: "Recommend approachable items that match preferences and budget.",
    starterPrompt:
      "Suggest a first-time order for a family of four with one vegetarian and one kid.",
  },
  {
    id: "personality",
    label: "Personality Orders",
    description: "Map chat style to personalized order recommendations.",
    focus: "Use conversation cues to suggest food pairings and upsells.",
    starterPrompt:
      "The customer sounds adventurous, likes spice, and wants a late-night comfort meal. What should we recommend?",
  },
];

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "",
  city: "Dallas-Fort Worth",
  cuisineType: "",
  customerType: "Local families and office workers",
  pricePoint: "$$",
};

function getModeConfig(mode: AssistantMode): ModeConfig {
  return MODES.find((item) => item.id === mode) ?? MODES[0];
}

function getInitialAssistantMessage(mode: AssistantMode, businessName?: string): string {
  const config = getModeConfig(mode);
  const name = businessName?.trim() ? businessName.trim() : "your DFW food business";

  return `You are in ${config.label} mode for ${name}. Tell me your situation and I will give a practical, step-by-step recommendation.`;
}

export function ArymaAssistant() {
  const [mode, setMode] = useState<AssistantMode>("chatbot");
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: getInitialAssistantMessage("chatbot"),
    },
  ]);
  const [input, setInput] = useState<string>(getModeConfig("chatbot").starterPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const activeMode = getModeConfig(mode);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function resetConversation() {
    setMessages([
      {
        role: "assistant",
        content: getInitialAssistantMessage(mode, businessProfile.businessName),
      },
    ]);
    setError(null);
  }

  function updateBusinessProfile<K extends keyof BusinessProfile>(
    key: K,
    value: BusinessProfile[K],
  ) {
    setBusinessProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          messages: nextMessages,
          businessProfile,
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      const answer = payload.answer;

      if (!response.ok || !answer) {
        throw new Error(payload.error ?? "The assistant response could not be generated.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while contacting the assistant.";

      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I ran into an error generating that response. Check your API key and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-6 sm:px-8 sm:py-8">
      <header className="rounded-3xl border border-black/10 bg-[var(--card)] px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-800/80">
          Aryma ISM AI Platform
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
          AI Tools For DFW Food Businesses
        </h1>
        <p className="mt-3 max-w-4xl text-sm text-black/70 sm:text-base">
          Use one workspace for chatbot support, inventory planning, customer review recovery,
          first-time menu suggestions, and personality-based order recommendations.
        </p>
      </header>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[330px,1fr]">
        <aside className="rounded-3xl border border-black/10 bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-black">AI Modules</h2>
          <p className="mt-1 text-sm text-black/65">
            Select the mode that matches your current business task.
          </p>

          <div className="mt-4 space-y-2">
            {MODES.map((item) => {
              const isActive = item.id === mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setInput(item.starterPrompt);
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-teal-600 bg-teal-50 shadow-sm"
                      : "border-black/10 bg-white hover:border-teal-400/60"
                  }`}
                >
                  <p className="text-sm font-semibold text-black">{item.label}</p>
                  <p className="mt-1 text-xs text-black/65">{item.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/80">
              Business Profile
            </h3>
            <div className="mt-3 space-y-3">
              <input
                value={businessProfile.businessName}
                onChange={(event) => updateBusinessProfile("businessName", event.target.value)}
                placeholder="Business name"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              />
              <input
                value={businessProfile.city}
                onChange={(event) => updateBusinessProfile("city", event.target.value)}
                placeholder="City / service area"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              />
              <input
                value={businessProfile.cuisineType}
                onChange={(event) => updateBusinessProfile("cuisineType", event.target.value)}
                placeholder="Cuisine type"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              />
              <input
                value={businessProfile.customerType}
                onChange={(event) => updateBusinessProfile("customerType", event.target.value)}
                placeholder="Core customer segment"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              />
              <input
                value={businessProfile.pricePoint}
                onChange={(event) => updateBusinessProfile("pricePoint", event.target.value)}
                placeholder="Price point ($, $$, $$$)"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              />
            </div>
          </div>
        </aside>

        <section className="flex min-h-[540px] flex-col rounded-3xl border border-black/10 bg-[var(--card)] shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="text-xl font-semibold text-black">{activeMode.label}</h2>
              <p className="mt-1 text-sm text-black/65">{activeMode.focus}</p>
            </div>
            <button
              type="button"
              onClick={resetConversation}
              className="rounded-xl border border-black/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black/70 transition hover:border-teal-500 hover:text-teal-700"
            >
              Reset Chat
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <article
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    isUser
                      ? "ml-auto bg-teal-700 text-white"
                      : "mr-auto border border-black/10 bg-white text-black"
                  }`}
                >
                  {message.content}
                </article>
              );
            })}

            {isLoading && (
              <article className="mr-auto max-w-[90%] rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/65 shadow-sm">
                Working on your request...
              </article>
            )}

            <div ref={endRef} />
          </div>

          <div className="border-t border-black/10 px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/80">
              Suggested Prompt
            </p>
            <button
              type="button"
              onClick={() => setInput(activeMode.starterPrompt)}
              className="mt-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-left text-sm text-teal-900 transition hover:border-teal-400"
            >
              {activeMode.starterPrompt}
            </button>

            <form className="mt-3" onSubmit={handleSubmit}>
              <label htmlFor="chat-input" className="sr-only">
                Ask Aryma Assistant
              </label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder="Describe the scenario, include quantities or customer details, and ask for a plan."
                className="w-full resize-none rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-black/60">
                  Context includes your selected mode and business profile.
                </p>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </form>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
