"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type AssistantMode,
  DEFAULT_PROFILE,
  type AppUserRole,
  type CalendarEntry,
  type CostMarginRecord,
  type DashboardKPI,
  type EmployeeAccountSummary,
  type InventoryItem,
  INTAKE_FIELDS,
  type MenuUploadRecord,
  type QuickAskMessage,
  type RecipeGenerationRecord,
  type RestaurantData,
  type RestaurantProfile,
  type ReviewTrackerRecord,
  SHARED_INTAKE_FIELDS,
  type WorkflowBranch,
  WORKFLOW_MODULES,
  getDefaultRestaurantData,
} from "../lib/models";

type WorkspaceView =
  | "overview"
  | "concierge"
  | "inventory"
  | "menuUpload"
  | "recipeGenerator"
  | "reviewTracker"
  | "costMargin"
  | "teamCalendar"
  | "profile";

type IconName =
  | "home"
  | "spark"
  | "inventory"
  | "upload"
  | "recipe"
  | "reviews"
  | "cost"
  | "calendar"
  | "profile"
  | "switch"
  | "logout";

type QuickAskPayload = {
  answer?: string;
  error?: string;
};

type MessagePayload = {
  role: "user" | "assistant";
  content: string;
};

type NavItem = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  view?: WorkspaceView;
  action?: "switch-branch" | "logout";
};

type SessionUser = {
  email: string;
  role: AppUserRole;
  ownerEmail: string | null;
  displayName: string | null;
  position: string | null;
  profile: RestaurantProfile;
  restaurantData: RestaurantData;
  employees: EmployeeAccountSummary[];
};

type ToolSummary = {
  moduleId: string;
  label: string;
  description: string;
  view: WorkspaceView;
  ready: boolean;
  detail: string;
};

const toneStyles: Record<DashboardKPI["tone"], string> = {
  neutral: "border-black/10 bg-white text-black",
  good: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
};

const sectionCopy: Record<
  WorkspaceView,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  overview: {
    eyebrow: "Overview",
    title: "Run the business side from one cleaner control center.",
    description: "The overview now points you into the right tool instead of making you decode a pile of unrelated panels.",
  },
  concierge: {
    eyebrow: "Concierge",
    title: "Get operational guidance without hunting for setup fields.",
    description: "Use this when you need fast recommendations for staffing, service, or daily operating friction.",
  },
  inventory: {
    eyebrow: "Inventory",
    title: "Track stock, risk, and reorder thinking in one workspace.",
    description: "Inventory entry and assistant help stay together so you can act on the data more quickly.",
  },
  menuUpload: {
    eyebrow: "Menu Upload + Recs",
    title: "Upload your current menu and ask what should improve.",
    description: "Use text-based uploads or paste the menu directly, then get clarity, upsell, and category recommendations.",
  },
  recipeGenerator: {
    eyebrow: "Recipe Generator",
    title: "Create workable dishes that actually fit your concept and kitchen.",
    description: "Keep recipe ideas, constraints, and AI-generated support in one consistent place.",
  },
  reviewTracker: {
    eyebrow: "Review Tracker",
    title: "Turn customer feedback into a response draft and an internal fix plan.",
    description: "This is built for operational follow-through, not just writing replies.",
  },
  costMargin: {
    eyebrow: "Cost & Margin",
    title: "Check where pricing pressure and margin leaks are showing up.",
    description: "Use this to compare cost structure and selling price before small problems turn into recurring losses.",
  },
  teamCalendar: {
    eyebrow: "Team Calendar",
    title: "Manage shifts, events, and employee visibility from one shared schedule.",
    description: "Owners manage the calendar here and employees log in to see only the schedule view.",
  },
  profile: {
    eyebrow: "Profile",
    title: "Keep the core business context accurate.",
    description: "These details improve recommendations across every tool in the workspace.",
  },
};

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toSafeNumber(value: string, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function computeKpis(data: RestaurantData): DashboardKPI[] {
  const lowInventoryCount = data.inventory.filter((item) => item.quantity <= item.reorderPoint).length;
  const reviewCount = data.reviewTrackers.filter((item) => item.status !== "resolved").length;
  const menuCount = data.menuUploads.length + data.recipeGenerations.length;
  const queueItems = data.todayQueue.length;

  return [
    {
      id: "low-inventory",
      label: "Low Inventory",
      value: String(lowInventoryCount),
      tone: lowInventoryCount > 0 ? "warning" : "good",
    },
    {
      id: "open-reviews",
      label: "Open Feedback Items",
      value: String(reviewCount),
      tone: reviewCount > 0 ? "warning" : "good",
    },
    {
      id: "menu-work",
      label: "Menu Work",
      value: String(menuCount),
      tone: "neutral",
    },
    {
      id: "today-queue",
      label: "Today Queue",
      value: String(queueItems),
      tone: queueItems > 0 ? "neutral" : "warning",
    },
  ];
}

function getModeFromModule(moduleId: string | null): AssistantMode {
  const workflowModule = WORKFLOW_MODULES.find((item) => item.id === moduleId);
  return workflowModule?.mode ?? "chatbot";
}

function getWorkspaceForModule(moduleId: string | null): WorkspaceView {
  switch (moduleId) {
    case "chatbot-concierge":
      return "concierge";
    case "inventory-manager":
      return "inventory";
    case "menu-upload":
      return "menuUpload";
    case "recipe-generator":
      return "recipeGenerator";
    case "issue-solver":
      return "reviewTracker";
    case "review-fix-tracker":
      return "reviewTracker";
    case "cost-margin-checker":
      return "costMargin";
    case "team-calendar":
      return "teamCalendar";
    default:
      return "overview";
  }
}

function getModuleForWorkspace(view: WorkspaceView): string | null {
  switch (view) {
    case "concierge":
      return "chatbot-concierge";
    case "inventory":
      return "inventory-manager";
    case "menuUpload":
      return "menu-upload";
    case "recipeGenerator":
      return "recipe-generator";
    case "reviewTracker":
      return "review-fix-tracker";
    case "costMargin":
      return "cost-margin-checker";
    case "teamCalendar":
      return "team-calendar";
    default:
      return null;
  }
}

function getVisibleViews(branch: WorkflowBranch): WorkspaceView[] {
  return branch === "yes"
    ? [
        "overview",
        "concierge",
        "inventory",
        "menuUpload",
        "recipeGenerator",
        "reviewTracker",
        "costMargin",
        "teamCalendar",
        "profile",
      ]
    : ["overview", "profile"];
}

function getNavItems(branch: WorkflowBranch): NavItem[] {
  if (branch === "yes") {
    return [
      { id: "overview", label: "Overview", description: "Snapshot and next steps", icon: "home", view: "overview" },
      { id: "concierge", label: "Concierge", description: "Operational guidance", icon: "spark", view: "concierge" },
      { id: "inventory", label: "Inventory", description: "Stock and reorder view", icon: "inventory", view: "inventory" },
      { id: "menuUpload", label: "Menu Upload", description: "Menu review tool", icon: "upload", view: "menuUpload" },
      { id: "recipeGenerator", label: "Recipes", description: "Generate dishes", icon: "recipe", view: "recipeGenerator" },
      { id: "reviewTracker", label: "Reviews", description: "Responses and fixes", icon: "reviews", view: "reviewTracker" },
      { id: "costMargin", label: "Margin", description: "Pricing pressure", icon: "cost", view: "costMargin" },
      { id: "teamCalendar", label: "Calendar", description: "Shifts and events", icon: "calendar", view: "teamCalendar" },
      { id: "profile", label: "Profile", description: "Business context", icon: "profile", view: "profile" },
      { id: "switch", label: "Switch Path", description: "Restart selection", icon: "switch", action: "switch-branch" },
      { id: "logout", label: "Log Out", description: "Exit securely", icon: "logout", action: "logout" },
    ];
  }

  return [
    { id: "overview", label: "Overview", description: "Snapshot and next steps", icon: "home", view: "overview" },
    { id: "profile", label: "Profile", description: "Business context", icon: "profile", view: "profile" },
    { id: "switch", label: "Switch Path", description: "Restart selection", icon: "switch", action: "switch-branch" },
    { id: "logout", label: "Log Out", description: "Exit securely", icon: "logout", action: "logout" },
  ];
}

function getWorkflowPromptContext(
  moduleId: string,
  branch: WorkflowBranch,
  answers: Record<string, string>,
  question: string,
) {
  const workflowModule = WORKFLOW_MODULES.find((item) => item.id === moduleId);
  const mappedAnswers = Object.entries(answers)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join("\n");

  return [
    `Workflow branch: ${branch === "yes" ? "Has restaurant" : "No restaurant yet"}`,
    `Workflow module: ${workflowModule?.label ?? "Unknown module"}`,
    "Workflow intake answers:",
    mappedAnswers || "No captured intake answers",
    "User question:",
    question,
  ].join("\n");
}

function getModuleFields(moduleId: string) {
  return [...(INTAKE_FIELDS[moduleId] ?? []), ...SHARED_INTAKE_FIELDS];
}

function getModuleCompletion(moduleId: string, data: RestaurantData) {
  const fields = getModuleFields(moduleId);
  const requiredFields = fields.filter((field) => "required" in field && Boolean(field.required));
  const answers = data.workflowIntake[moduleId] ?? {};
  const completedRequired = requiredFields.filter((field) => answers[field.id]?.trim()).length;
  const missingField = requiredFields.find((field) => !answers[field.id]?.trim()) ?? null;

  return {
    ready: !missingField,
    missingField,
    completedRequired,
    totalRequired: requiredFields.length,
  };
}

function defaultInventoryForm() {
  return { name: "", quantity: "", unit: "units", reorderPoint: "", menuDependency: "" };
}

function defaultMenuUploadForm() {
  return { fileName: "", content: "", notes: "" };
}

function defaultRecipeForm() {
  return {
    title: "",
    cuisineType: "",
    dishType: "",
    difficulty: "medium" as RecipeGenerationRecord["difficulty"],
    ingredients: "",
    method: "",
    platingNotes: "",
    foodCostGoal: "",
  };
}

function defaultReviewForm() {
  return {
    channel: "Google",
    reviewText: "",
    starRating: "3",
    status: "new" as ReviewTrackerRecord["status"],
    publicResponse: "",
    internalFixPlan: "",
    owner: "",
  };
}

function defaultCostForm() {
  return {
    itemName: "",
    sellingPrice: "",
    ingredientCost: "",
    laborCost: "",
    packagingCost: "",
    targetMargin: "",
    notes: "",
  };
}

function defaultCalendarForm() {
  return {
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    type: "shift" as CalendarEntry["type"],
    employeeEmail: "",
    notes: "",
  };
}

function defaultEmployeeForm() {
  return {
    displayName: "",
    position: "",
    email: "",
    password: "",
  };
}

async function fetchCurrentUser(): Promise<SessionUser> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }

  const payload = (await response.json()) as { user?: SessionUser };
  if (!payload.user) {
    throw new Error("Unauthorized");
  }

  return payload.user;
}

async function persistPatch(patch: { profile?: RestaurantProfile; restaurantData?: RestaurantData }) {
  const response = await fetch("/api/data", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error("Unable to save changes.");
  }
}

async function performLogout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

function IconGlyph({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M6.5 10.5V20h11V10.5" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" /></svg>;
    case "inventory":
      return <svg {...common}><path d="M4 7.5 12 4l8 3.5L12 11 4 7.5Z" /><path d="M4 12.5 12 16l8-3.5" /><path d="M4 17.5 12 21l8-3.5" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 16V5" /><path d="m7.5 9.5 4.5-4.5 4.5 4.5" /><path d="M5 19h14" /></svg>;
    case "recipe":
      return <svg {...common}><path d="M7 5.5c0 2.2 1.8 4 4 4s4-1.8 4-4" /><path d="M6 12.5h12" /><path d="M8.5 12.5v6" /><path d="M15.5 12.5v6" /></svg>;
    case "reviews":
      return <svg {...common}><path d="M5 6h14v9H9l-4 4V6Z" /><path d="M9 10h6" /></svg>;
    case "cost":
      return <svg {...common}><path d="M12 3v18" /><path d="M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" /></svg>;
    case "profile":
      return <svg {...common}><path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "switch":
      return <svg {...common}><path d="M7 7h10" /><path d="m13 3 4 4-4 4" /><path d="M17 17H7" /><path d="m11 13-4 4 4 4" /></svg>;
    case "logout":
      return <svg {...common}><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="M14 16l4-4-4-4" /><path d="M8 12h10" /></svg>;
    default:
      return null;
  }
}

function FloatingDock({
  items,
  navOpen,
  onToggle,
  onClose,
  onSelect,
  activeView,
}: {
  items: NavItem[];
  navOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (item: NavItem) => void;
  activeView: WorkspaceView;
}) {
  return (
    <>
      {navOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-transparent" />}
      <nav className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
        {navOpen && (
          <div className="mb-1 flex flex-col items-end gap-2">
            {items.map((item) => {
              const active = item.view ? item.view === activeView : false;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`group flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-lg transition ${
                    active ? "border-teal-700 bg-teal-700 text-white" : "border-black/10 bg-[var(--card)] text-black hover:border-teal-400 hover:bg-white"
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border ${active ? "border-white/25 bg-white/15" : "border-black/10 bg-white text-teal-800"}`}>
                    <IconGlyph name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-[10rem] text-left">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`block text-xs ${active ? "text-white/75" : "text-black/55"}`}>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" onClick={onToggle} aria-expanded={navOpen} aria-label="Toggle workspace navigation" className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-xl transition hover:bg-teal-600">
          {navOpen ? "X" : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" /></svg>}
        </button>
      </nav>
    </>
  );
}

function EmployeeDashboard({
  userEmail,
  displayName,
  position,
  profile,
  calendarEntries,
  onLogout,
}: {
  userEmail: string;
  displayName: string | null;
  position: string | null;
  profile: RestaurantProfile;
  calendarEntries: CalendarEntry[];
  onLogout: () => void;
}) {
  const personalEntries = calendarEntries.filter((item) => !item.employeeEmail || item.employeeEmail === userEmail);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-7 sm:py-8">
      <header className="rounded-[2rem] border border-black/10 bg-[var(--card)] px-6 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800/75">Employee Dashboard</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-black">{displayName || userEmail.split("@")[0]}</h1>
            <p className="mt-2 text-sm text-black/60">{position || "Team Member"} • {profile.businessName || "Restaurant Team"}</p>
          </div>
          <button type="button" onClick={onLogout} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600">
            Log Out
          </button>
        </div>
      </header>

      <section className="mt-5 rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-black">Your calendar</h2>
        <p className="mt-2 text-sm leading-6 text-black/65">This view only shows the schedule side of the product: your assigned shifts plus any shared team events.</p>
        <div className="mt-5 space-y-3">
          {personalEntries.length === 0 && (
            <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">
              No upcoming shifts or events yet.
            </p>
          )}
          {personalEntries
            .slice()
            .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
            .map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-black">{entry.title}</p>
                    <p className="mt-1 text-xs text-black/60">
                      {entry.date} • {entry.startTime || "TBD"} to {entry.endTime || "TBD"} • {entry.type === "shift" ? "Shift" : "Event"}
                    </p>
                    {entry.notes && <p className="mt-2 text-sm text-black/65">{entry.notes}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.type === "shift" ? "bg-teal-100 text-teal-900" : "bg-amber-100 text-amber-900"}`}>
                    {entry.type === "shift" ? "Assigned" : "Shared"}
                  </span>
                </div>
              </article>
            ))}
        </div>
      </section>
    </main>
  );
}

function DashboardApp() {
  const router = useRouter();

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [role, setRole] = useState<AppUserRole>("owner");
  const [accountEmail, setAccountEmail] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeAccountSummary[]>([]);
  const [data, setData] = useState(getDefaultRestaurantData());
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE);
  const [workspace, setWorkspace] = useState<WorkspaceView>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [quickAskInput, setQuickAskInput] = useState("");
  const [quickAskError, setQuickAskError] = useState<string | null>(null);
  const [quickAskLoading, setQuickAskLoading] = useState(false);

  const [inventoryForm, setInventoryForm] = useState(defaultInventoryForm());
  const [menuUploadForm, setMenuUploadForm] = useState(defaultMenuUploadForm());
  const [recipeForm, setRecipeForm] = useState(defaultRecipeForm());
  const [reviewForm, setReviewForm] = useState(defaultReviewForm());
  const [costForm, setCostForm] = useState(defaultCostForm());
  const [calendarForm, setCalendarForm] = useState(defaultCalendarForm());
  const [employeeForm, setEmployeeForm] = useState(defaultEmployeeForm());
  const [queueInput, setQueueInput] = useState("");
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const user = await fetchCurrentUser();
        if (!mounted) {
          return;
        }

        const mergedData = {
          ...getDefaultRestaurantData(),
          ...user.restaurantData,
        };
        const savedModuleId = mergedData.selectedWorkflowModuleId === "issue-solver"
          ? "review-fix-tracker"
          : mergedData.selectedWorkflowModuleId;
        const initialModuleId =
          savedModuleId ??
          WORKFLOW_MODULES.find(
            (item) => item.branch === mergedData.workflowBranch && item.id !== "issue-solver",
          )?.id ??
          null;

        setRole(user.role);
        setAccountEmail(user.email);
        setDisplayName(user.displayName);
        setPosition(user.position);
        setEmployees(user.employees ?? []);
        setProfileDraft(user.profile);
        setData(mergedData);
        setActiveModuleId(initialModuleId);
        setWorkspace(mergedData.workflowBranch && initialModuleId ? getWorkspaceForModule(initialModuleId) : "overview");
      } catch {
        router.replace("/");
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  const kpis = useMemo(() => computeKpis(data), [data]);
  const branchModules = useMemo(() => {
    if (!data.workflowBranch) {
      return [];
    }
      return WORKFLOW_MODULES.filter(
        (item) => item.branch === data.workflowBranch && item.id !== "issue-solver",
      );
  }, [data.workflowBranch]);

  const selectedModule = branchModules.find((item) => item.id === activeModuleId) ?? branchModules[0] ?? null;
  const visibleViews = data.workflowBranch ? getVisibleViews(data.workflowBranch) : [];
  const navItems = data.workflowBranch ? getNavItems(data.workflowBranch) : [];
  const toolSummaries: ToolSummary[] = useMemo(
    () =>
      branchModules.map((workflowModule) => {
        const completion = getModuleCompletion(workflowModule.id, data);
        return {
          moduleId: workflowModule.id,
          label: workflowModule.label,
          description: workflowModule.description,
          view: getWorkspaceForModule(workflowModule.id),
          ready: completion.ready,
          detail: completion.ready ? "Ready to use" : completion.missingField ? `Needs: ${completion.missingField.label}` : "Needs setup",
        };
      }),
    [branchModules, data],
  );
  const focusedModuleId = getModuleForWorkspace(workspace) ?? selectedModule?.id ?? null;
  const focusedModule = branchModules.find((item) => item.id === focusedModuleId) ?? selectedModule ?? null;
  const focusedMessages = focusedModule ? data.quickAsk.filter((item) => item.mode === getModeFromModule(focusedModule.id)).slice(-8) : [];

  function mutateData(updater: (prev: RestaurantData) => RestaurantData) {
    setData((prev) => {
      const next = updater(prev);
      void persistPatch({ restaurantData: next }).catch(() => {});
      return next;
    });
  }

  function syncSelectedModule(moduleId: string | null) {
    setActiveModuleId(moduleId);
    if (!moduleId) {
      return;
    }
    mutateData((prev) => ({ ...prev, selectedWorkflowModuleId: moduleId }));
  }

  function openWorkspace(nextView: WorkspaceView, nextModuleId?: string | null) {
    const moduleId = nextModuleId ?? getModuleForWorkspace(nextView) ?? activeModuleId;
    setWorkspace(nextView);
    setNavOpen(false);
    setQuickAskError(null);
    if (moduleId) {
      syncSelectedModule(moduleId);
    }
  }

  async function logout() {
    await performLogout();
    router.replace("/");
  }

  function handleBranchSelect(branch: WorkflowBranch) {
    const firstModule = WORKFLOW_MODULES.find((item) => item.branch === branch)?.id ?? null;
    mutateData((prev) => ({ ...prev, workflowBranch: branch, selectedWorkflowModuleId: firstModule }));
    setActiveModuleId(firstModule);
    setWorkspace(firstModule ? getWorkspaceForModule(firstModule) : "overview");
  }

  function resetBranchSelection() {
    mutateData((prev) => ({ ...prev, workflowBranch: null, selectedWorkflowModuleId: null, workflowIntake: {}, quickAsk: [] }));
    setActiveModuleId(null);
    setWorkspace("overview");
    setNavOpen(false);
    setQuickAskInput("");
    setQuickAskError(null);
  }

  function updateIntakeAnswer(moduleId: string, key: string, value: string) {
    mutateData((prev) => ({
      ...prev,
      selectedWorkflowModuleId: moduleId,
      workflowIntake: {
        ...prev.workflowIntake,
        [moduleId]: {
          ...(prev.workflowIntake[moduleId] ?? {}),
          [key]: value,
        },
      },
    }));
    setActiveModuleId(moduleId);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistPatch({ profile: profileDraft });
    setProfileNotice("Saved");
    window.setTimeout(() => setProfileNotice(null), 1800);
  }

  async function handleQuickAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.workflowBranch || !focusedModule) return;
    const moduleId = focusedModule.id;
    const question = quickAskInput.trim();
    if (!question) return;
    const intakeAnswers = data.workflowIntake[moduleId] ?? {};
    const requiredFields = getModuleFields(moduleId).filter((field) => "required" in field && Boolean(field.required));
    const missingField = requiredFields.find((field) => !intakeAnswers[field.id]?.trim());
    if (missingField) {
      setQuickAskError(`Before asking, complete: ${missingField.label}`);
      return;
    }
    setQuickAskError(null);
    setQuickAskLoading(true);

    const mode = getModeFromModule(moduleId);
    const prompt = getWorkflowPromptContext(moduleId, data.workflowBranch, intakeAnswers, question);
    const baseHistory: MessagePayload[] = data.quickAsk
      .filter((item) => item.mode === mode)
      .slice(-6)
      .map((item) => ({ role: item.role, content: item.content }));

    const userMessage: QuickAskMessage = {
      role: "user",
      content: question,
      mode,
      createdAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, quickAsk: [...prev.quickAsk, userMessage].slice(-60) }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: [...baseHistory, { role: "user", content: prompt }],
          businessProfile: profileDraft,
        }),
      });
      const payload = (await response.json()) as QuickAskPayload;
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "Could not generate assistant response.");
      }
      const assistantMessage: QuickAskMessage = {
        role: "assistant",
        content: payload.answer,
        mode,
        createdAt: new Date().toISOString(),
      };
      mutateData((prev) => ({ ...prev, quickAsk: [...prev.quickAsk, assistantMessage].slice(-60) }));
      setQuickAskInput("");
    } catch (error) {
      setQuickAskError(error instanceof Error ? error.message : "Quick ask failed unexpectedly.");
    } finally {
      setQuickAskLoading(false);
    }
  }

  function addQueueItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = queueInput.trim();
    if (!value) return;
    mutateData((prev) => ({ ...prev, todayQueue: [value, ...prev.todayQueue].slice(0, 12) }));
    setQueueInput("");
  }

  function removeQueueItem(index: number) {
    mutateData((prev) => ({ ...prev, todayQueue: prev.todayQueue.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryForm.name.trim()) return;
    const payload: InventoryItem = {
      id: createId("inv"),
      name: inventoryForm.name.trim(),
      quantity: toSafeNumber(inventoryForm.quantity),
      unit: inventoryForm.unit.trim() || "units",
      reorderPoint: toSafeNumber(inventoryForm.reorderPoint),
      menuDependency: inventoryForm.menuDependency.trim(),
      updatedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, inventory: [payload, ...prev.inventory] }));
    setInventoryForm(defaultInventoryForm());
  }

  async function handleMenuFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setMenuUploadForm((prev) => ({ ...prev, fileName: file.name, content }));
  }

  function submitMenuUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menuUploadForm.content.trim()) return;
    const payload: MenuUploadRecord = {
      id: createId("menu_upload"),
      fileName: menuUploadForm.fileName.trim() || `Menu ${new Date().toLocaleDateString()}`,
      content: menuUploadForm.content.trim(),
      notes: menuUploadForm.notes.trim(),
      uploadedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, menuUploads: [payload, ...prev.menuUploads] }));
    setMenuUploadForm(defaultMenuUploadForm());
  }

  function submitRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipeForm.title.trim()) return;
    const payload: RecipeGenerationRecord = {
      id: createId("recipe"),
      title: recipeForm.title.trim(),
      cuisineType: recipeForm.cuisineType.trim(),
      dishType: recipeForm.dishType.trim(),
      difficulty: recipeForm.difficulty,
      ingredients: recipeForm.ingredients.trim(),
      method: recipeForm.method.trim(),
      platingNotes: recipeForm.platingNotes.trim(),
      foodCostGoal: recipeForm.foodCostGoal.trim(),
      updatedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, recipeGenerations: [payload, ...prev.recipeGenerations] }));
    setRecipeForm(defaultRecipeForm());
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewForm.reviewText.trim()) return;
    const payload: ReviewTrackerRecord = {
      id: createId("review"),
      channel: reviewForm.channel.trim(),
      reviewText: reviewForm.reviewText.trim(),
      starRating: reviewForm.starRating,
      status: reviewForm.status,
      publicResponse: reviewForm.publicResponse.trim(),
      internalFixPlan: reviewForm.internalFixPlan.trim(),
      owner: reviewForm.owner.trim(),
      updatedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, reviewTrackers: [payload, ...prev.reviewTrackers] }));
    setReviewForm(defaultReviewForm());
  }

  function submitCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!costForm.itemName.trim()) return;
    const payload: CostMarginRecord = {
      id: createId("cost"),
      itemName: costForm.itemName.trim(),
      sellingPrice: toSafeNumber(costForm.sellingPrice),
      ingredientCost: toSafeNumber(costForm.ingredientCost),
      laborCost: toSafeNumber(costForm.laborCost),
      packagingCost: toSafeNumber(costForm.packagingCost),
      targetMargin: toSafeNumber(costForm.targetMargin),
      notes: costForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, costMargins: [payload, ...prev.costMargins] }));
    setCostForm(defaultCostForm());
  }

  function submitCalendarEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!calendarForm.title.trim() || !calendarForm.date.trim()) return;
    const employee = employees.find((item) => item.email === calendarForm.employeeEmail);
    const payload: CalendarEntry = {
      id: createId("cal"),
      title: calendarForm.title.trim(),
      date: calendarForm.date,
      startTime: calendarForm.startTime,
      endTime: calendarForm.endTime,
      type: calendarForm.type,
      employeeEmail: calendarForm.employeeEmail,
      employeeName: employee?.displayName ?? "",
      notes: calendarForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    mutateData((prev) => ({ ...prev, calendarEntries: [payload, ...prev.calendarEntries] }));
    setCalendarForm(defaultCalendarForm());
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmployeeNotice(null);
    setEmployeeError(null);
    setEmployeeLoading(true);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm),
      });
      const payload = (await response.json()) as { employees?: EmployeeAccountSummary[]; error?: string };
      if (!response.ok || !payload.employees) {
        throw new Error(payload.error ?? "Unable to create employee.");
      }
      setEmployees(payload.employees);
      setEmployeeForm(defaultEmployeeForm());
      setEmployeeNotice("Employee account created");
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Unable to create employee.");
    } finally {
      setEmployeeLoading(false);
    }
  }

  function removeItem<Key extends keyof RestaurantData>(key: Key, id: string) {
    mutateData((prev) => ({
      ...prev,
      [key]: Array.isArray(prev[key]) ? (prev[key] as Array<{ id: string }>).filter((item) => item.id !== id) : prev[key],
    }));
  }

  function handleNavItem(item: NavItem) {
    if (item.action === "logout") {
      void logout();
      return;
    }
    if (item.action === "switch-branch") {
      resetBranchSelection();
      return;
    }
    if (item.view) {
      openWorkspace(item.view);
    }
  }

  function renderAssistantPanel(moduleId: string) {
    const workflowModule = branchModules.find((item) => item.id === moduleId);
    if (!workflowModule) return null;
    const completion = getModuleCompletion(workflowModule.id, data);
    const answers = data.workflowIntake[workflowModule.id] ?? {};

    return (
      <aside className="space-y-5 rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/70">Guided Assistant</p>
          <h3 className="mt-2 text-xl font-semibold text-black">{workflowModule.label}</h3>
          <p className="mt-1 text-sm leading-6 text-black/65">{workflowModule.description}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-black">Setup Progress</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completion.ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
              {completion.ready ? "Ready to ask" : `${completion.completedRequired}/${completion.totalRequired} required`}
            </span>
          </div>
          {!completion.ready && completion.missingField && (
            <p className="mt-2 text-sm text-black/60">Missing field: <span className="font-medium text-black">{completion.missingField.label}</span></p>
          )}
          <div className="mt-4 grid gap-3">
            {getModuleFields(workflowModule.id).map((field) => {
              const value = answers[field.id] ?? "";
              const isTextarea = "rows" in field && field.rows && field.rows > 1;
              return (
                <div key={field.id}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                    {field.label}
                    {"required" in field && field.required ? " *" : ""}
                  </label>
                  {isTextarea ? (
                    <textarea value={value} onChange={(event) => updateIntakeAnswer(workflowModule.id, field.id, event.target.value)} rows={field.rows} placeholder={field.placeholder} className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  ) : (
                    <input value={value} onChange={(event) => updateIntakeAnswer(workflowModule.id, field.id, event.target.value)} placeholder={field.placeholder} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <h4 className="text-sm font-semibold text-black">Ask for help</h4>
          <p className="mt-1 text-sm text-black/60">Ask a focused question here and the assistant will use the setup fields above automatically.</p>
          <form onSubmit={handleQuickAsk} className="mt-4 space-y-3">
            <textarea value={quickAskInput} onChange={(event) => setQuickAskInput(event.target.value)} rows={4} placeholder="Ask for a recommendation, action plan, or next best move" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
            <button type="submit" disabled={quickAskLoading || !quickAskInput.trim()} className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60">
              {quickAskLoading ? "Generating..." : "Ask assistant"}
            </button>
          </form>
          {quickAskError && <p className="mt-3 text-sm text-red-700">{quickAskError}</p>}
          <div className="mt-4 space-y-2">
            {focusedMessages.length === 0 && <p className="rounded-xl border border-black/10 bg-[var(--card)] px-3 py-3 text-sm text-black/60">No messages yet. Complete setup and ask for a clear next step.</p>}
            {focusedMessages.slice().reverse().map((message, index) => {
              const isUser = message.role === "user";
              return (
                <article key={`${message.createdAt}-${index}`} className={`rounded-2xl px-4 py-3 text-sm ${isUser ? "ml-8 border border-teal-700 bg-teal-700 text-white" : "mr-8 border border-black/10 bg-[var(--card)] text-black"}`}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{isUser ? "You" : "Assistant"}</p>
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                </article>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  if (isBootstrapping) {
    return <main className="flex min-h-screen items-center justify-center px-4"><div className="rounded-2xl border border-black/10 bg-[var(--card)] px-6 py-4 text-sm text-black/70 shadow-sm">Loading secure session...</div></main>;
  }

  if (!accountEmail) {
    return <main className="flex min-h-screen items-center justify-center px-4"><div className="rounded-2xl border border-black/10 bg-[var(--card)] px-6 py-4 text-sm text-black/70 shadow-sm">Redirecting...</div></main>;
  }

  if (role === "employee") {
    return <EmployeeDashboard userEmail={accountEmail} displayName={displayName} position={position} profile={profileDraft} calendarEntries={data.calendarEntries} onLogout={() => void logout()} />;
  }

  if (!data.workflowBranch) {
    return (
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-7">
        <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-[var(--card)] shadow-xl">
          <div className="grid gap-0 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="px-6 py-8 sm:px-10 sm:py-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800/70">Workspace Setup</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black sm:text-6xl">Which path fits you right now?</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-black/65">Pick the route that matches your situation. The business path now includes menu upload, recipe generation, review tracking, margin checking, and a full team calendar.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => handleBranchSelect("yes")} className="rounded-[1.7rem] border border-teal-700 bg-teal-50 px-5 py-6 text-left transition hover:bg-teal-700 hover:text-white">
                  <p className="text-lg font-semibold">I already have a business</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">Use operational tools, menu analysis, pricing checks, review fixes, and employee scheduling.</p>
                </button>
                <button type="button" onClick={() => handleBranchSelect("no")} className="rounded-[1.7rem] border border-amber-700 bg-amber-50 px-5 py-6 text-left transition hover:bg-amber-700 hover:text-white">
                  <p className="text-lg font-semibold">I am still building the concept</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">Keep using a lighter planning path while the concept is still forming.</p>
                </button>
              </div>
            </div>
            <div className="border-t border-black/10 bg-white/60 px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
              <p className="text-sm font-semibold text-black">What changed</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-black/65">
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">Owners now get five extra business tools on top of the existing dashboard flow.</div>
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">Employees can log in separately and see only the shared calendar and assigned shifts.</div>
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">Each tool keeps its setup fields and assistant support in the same workspace.</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const selectedModuleCompletion = selectedModule ? getModuleCompletion(selectedModule.id, data) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-5 pb-28 sm:px-7 sm:py-7 sm:pb-32">
      <header className="overflow-hidden rounded-[2rem] border border-black/10 bg-[var(--card)] shadow-sm">
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800/75">{sectionCopy[workspace].eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl">{profileDraft.businessName || "Aryma Workspace"}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-black/65 sm:text-base">{sectionCopy[workspace].title} {sectionCopy[workspace].description}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-right text-sm text-black/60">
              <p className="font-semibold text-black">{accountEmail}</p>
              <p>{data.workflowBranch === "yes" ? "Business path" : "Startup path"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleViews.map((view) => (
              <button key={view} type="button" onClick={() => openWorkspace(view)} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${workspace === view ? "border-teal-700 bg-teal-700 text-white" : "border-black/10 bg-white text-black/75 hover:border-teal-500 hover:bg-teal-50"}`}>
                {sectionCopy[view].eyebrow}
              </button>
            ))}
          </div>
        </div>
      </header>

      {workspace === "overview" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black">Current focus</p>
                  <h2 className="mt-2 text-2xl font-semibold text-black">{selectedModule?.label ?? "Choose a workspace to begin"}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-black/65">{selectedModule?.description ?? "Once you pick a path, Aryma keeps the owner tools grouped in clearer workspaces."}</p>
                </div>
                {selectedModule && <button type="button" onClick={() => openWorkspace(getWorkspaceForModule(selectedModule.id), selectedModule.id)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Open workspace</button>}
              </div>
              {selectedModuleCompletion && (
                <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/55">Recommended next move</p>
                  <p className="mt-2 text-sm leading-6 text-black/70">
                    {selectedModuleCompletion.ready ? "Your setup is complete. Ask the assistant for a next-step plan or keep building out the workspace." : selectedModuleCompletion.missingField ? `Finish ${selectedModuleCompletion.missingField.label} so the assistant can give stronger recommendations.` : "Complete the required setup fields for your current tool."}
                  </p>
                </div>
              )}
            </article>

            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Workspace health</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {kpis.map((item) => (
                  <div key={item.id} className={`rounded-2xl border px-4 py-4 ${toneStyles[item.tone]}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-80">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-black">Today queue</h2>
                <p className="text-sm text-black/55">Keep this light and actionable.</p>
              </div>
              <form onSubmit={addQueueItem} className="mt-4 flex gap-2">
                <input value={queueInput} onChange={(event) => setQueueInput(event.target.value)} placeholder="Add a task" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-600">Add</button>
              </form>
              <div className="mt-4 space-y-2">
                {data.todayQueue.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeQueueItem(index)} className="rounded-lg border border-black/10 px-2 py-1 text-xs font-semibold text-black/55 transition hover:border-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-black">Owner tools</h2>
                <p className="text-sm text-black/55">Each card opens the actual workspace.</p>
              </div>
              <div className="mt-4 grid gap-3">
                {toolSummaries.map((tool) => (
                  <button key={tool.moduleId} type="button" onClick={() => openWorkspace(tool.view, tool.moduleId)} className="rounded-[1.6rem] border border-black/10 bg-white px-4 py-4 text-left transition hover:border-teal-500 hover:bg-teal-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-black">{tool.label}</p>
                        <p className="mt-1 text-sm leading-6 text-black/60">{tool.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tool.ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{tool.detail}</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}

      {workspace === "concierge" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr,1.1fr]">
          <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-black">Operational focus</h2>
            <p className="mt-2 text-sm leading-6 text-black/65">Use this workspace for daily operations, service friction, staffing pressure, or customer communication decisions.</p>
          </article>
          {renderAssistantPanel("chatbot-concierge")}
        </section>
      )}

      {workspace === "inventory" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.95fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Inventory editor</h2>
              <form onSubmit={submitInventory} className="mt-4 grid gap-3">
                <input value={inventoryForm.name} onChange={(event) => setInventoryForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Item" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={inventoryForm.quantity} onChange={(event) => setInventoryForm((prev) => ({ ...prev, quantity: event.target.value }))} placeholder="Quantity" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={inventoryForm.unit} onChange={(event) => setInventoryForm((prev) => ({ ...prev, unit: event.target.value }))} placeholder="Unit" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={inventoryForm.reorderPoint} onChange={(event) => setInventoryForm((prev) => ({ ...prev, reorderPoint: event.target.value }))} placeholder="Reorder point" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={inventoryForm.menuDependency} onChange={(event) => setInventoryForm((prev) => ({ ...prev, menuDependency: event.target.value }))} placeholder="Menu dependency" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Add inventory item</button>
              </form>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Tracked inventory</h2>
              <div className="mt-4 space-y-3">
                {data.inventory.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No entries yet.</p>}
                {data.inventory.map((item) => (
                  <article key={item.id} className={`rounded-2xl border px-4 py-4 ${item.quantity <= item.reorderPoint ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"}`}>
                    <p className="text-sm font-semibold text-black">{item.name}</p>
                    <p className="mt-1 text-xs text-black/65">{item.quantity} {item.unit} • reorder at {item.reorderPoint}</p>
                    {item.menuDependency && <p className="mt-1 text-xs text-black/65">Dependency: {item.menuDependency}</p>}
                  </article>
                ))}
              </div>
            </article>
          </div>
          {renderAssistantPanel("inventory-manager")}
        </section>
      )}

      {workspace === "menuUpload" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.95fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Upload menu text</h2>
              <form onSubmit={submitMenuUpload} className="mt-4 space-y-3">
                <input type="file" accept=".txt,.md,.csv,.json" onChange={handleMenuFileChange} className="block w-full text-sm text-black/70" />
                <input value={menuUploadForm.fileName} onChange={(event) => setMenuUploadForm((prev) => ({ ...prev, fileName: event.target.value }))} placeholder="Menu name" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={menuUploadForm.content} onChange={(event) => setMenuUploadForm((prev) => ({ ...prev, content: event.target.value }))} rows={10} placeholder="Paste your full menu here if you are not uploading a text file" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={menuUploadForm.notes} onChange={(event) => setMenuUploadForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Optional notes about what you want reviewed" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Save menu upload</button>
              </form>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Uploaded menus</h2>
              <div className="mt-4 space-y-3">
                {data.menuUploads.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No menu uploads yet.</p>}
                {data.menuUploads.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{item.fileName}</p>
                        <p className="mt-1 text-xs text-black/60">{new Date(item.uploadedAt).toLocaleString()}</p>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-black/65">{item.content}</p>
                      </div>
                      <button type="button" onClick={() => removeItem("menuUploads", item.id)} className="rounded-lg border border-black/15 px-2 py-1 text-xs font-semibold text-black/70 transition hover:border-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
          {renderAssistantPanel("menu-upload")}
        </section>
      )}

      {workspace === "recipeGenerator" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.95fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Recipe builder</h2>
              <form onSubmit={submitRecipe} className="mt-4 space-y-3">
                <input value={recipeForm.title} onChange={(event) => setRecipeForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Recipe title" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={recipeForm.cuisineType} onChange={(event) => setRecipeForm((prev) => ({ ...prev, cuisineType: event.target.value }))} placeholder="Cuisine type" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={recipeForm.dishType} onChange={(event) => setRecipeForm((prev) => ({ ...prev, dishType: event.target.value }))} placeholder="Dish type" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={recipeForm.difficulty} onChange={(event) => setRecipeForm((prev) => ({ ...prev, difficulty: event.target.value as RecipeGenerationRecord["difficulty"] }))} className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <input value={recipeForm.foodCostGoal} onChange={(event) => setRecipeForm((prev) => ({ ...prev, foodCostGoal: event.target.value }))} placeholder="Food cost goal" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <textarea value={recipeForm.ingredients} onChange={(event) => setRecipeForm((prev) => ({ ...prev, ingredients: event.target.value }))} rows={4} placeholder="Ingredients" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={recipeForm.method} onChange={(event) => setRecipeForm((prev) => ({ ...prev, method: event.target.value }))} rows={5} placeholder="Method" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={recipeForm.platingNotes} onChange={(event) => setRecipeForm((prev) => ({ ...prev, platingNotes: event.target.value }))} rows={3} placeholder="Plating or service notes" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Save recipe concept</button>
              </form>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Recipe concepts</h2>
              <div className="mt-4 space-y-3">
                {data.recipeGenerations.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No recipes yet.</p>}
                {data.recipeGenerations.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{item.title}</p>
                        <p className="mt-1 text-xs text-black/60">{item.cuisineType || "No cuisine"} • {item.dishType || "No dish"} • {item.difficulty}</p>
                        {item.ingredients && <p className="mt-2 whitespace-pre-wrap text-sm text-black/65">{item.ingredients}</p>}
                      </div>
                      <button type="button" onClick={() => removeItem("recipeGenerations", item.id)} className="rounded-lg border border-black/15 px-2 py-1 text-xs font-semibold text-black/70 transition hover:border-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
          {renderAssistantPanel("recipe-generator")}
        </section>
      )}

      {workspace === "reviewTracker" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.95fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Review response + fix tracker</h2>
              <form onSubmit={submitReview} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <input value={reviewForm.channel} onChange={(event) => setReviewForm((prev) => ({ ...prev, channel: event.target.value }))} placeholder="Channel" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={reviewForm.starRating} onChange={(event) => setReviewForm((prev) => ({ ...prev, starRating: event.target.value }))} placeholder="Rating" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <select value={reviewForm.status} onChange={(event) => setReviewForm((prev) => ({ ...prev, status: event.target.value as ReviewTrackerRecord["status"] }))} className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600">
                    <option value="new">New</option>
                    <option value="in-progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <textarea value={reviewForm.reviewText} onChange={(event) => setReviewForm((prev) => ({ ...prev, reviewText: event.target.value }))} rows={5} placeholder="Paste the customer review" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={reviewForm.publicResponse} onChange={(event) => setReviewForm((prev) => ({ ...prev, publicResponse: event.target.value }))} rows={3} placeholder="Public response draft" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <textarea value={reviewForm.internalFixPlan} onChange={(event) => setReviewForm((prev) => ({ ...prev, internalFixPlan: event.target.value }))} rows={4} placeholder="Internal fix plan" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <input value={reviewForm.owner} onChange={(event) => setReviewForm((prev) => ({ ...prev, owner: event.target.value }))} placeholder="Owner or accountable person" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Save review case</button>
              </form>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Tracked review cases</h2>
              <div className="mt-4 space-y-3">
                {data.reviewTrackers.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No review cases yet.</p>}
                {data.reviewTrackers.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{item.channel} • {item.starRating} stars</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-black/65">{item.reviewText}</p>
                        {item.publicResponse && <p className="mt-2 text-sm text-black/65"><span className="font-semibold text-black">Response:</span> {item.publicResponse}</p>}
                        {item.internalFixPlan && <p className="mt-2 text-sm text-black/65"><span className="font-semibold text-black">Fix:</span> {item.internalFixPlan}</p>}
                      </div>
                      <button type="button" onClick={() => removeItem("reviewTrackers", item.id)} className="rounded-lg border border-black/15 px-2 py-1 text-xs font-semibold text-black/70 transition hover:border-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
          {renderAssistantPanel("review-fix-tracker")}
        </section>
      )}

      {workspace === "costMargin" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.95fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Cost and margin checker</h2>
              <form onSubmit={submitCost} className="mt-4 space-y-3">
                <input value={costForm.itemName} onChange={(event) => setCostForm((prev) => ({ ...prev, itemName: event.target.value }))} placeholder="Item name" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={costForm.sellingPrice} onChange={(event) => setCostForm((prev) => ({ ...prev, sellingPrice: event.target.value }))} placeholder="Selling price" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={costForm.targetMargin} onChange={(event) => setCostForm((prev) => ({ ...prev, targetMargin: event.target.value }))} placeholder="Target margin %" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input value={costForm.ingredientCost} onChange={(event) => setCostForm((prev) => ({ ...prev, ingredientCost: event.target.value }))} placeholder="Ingredient cost" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={costForm.laborCost} onChange={(event) => setCostForm((prev) => ({ ...prev, laborCost: event.target.value }))} placeholder="Labor cost" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={costForm.packagingCost} onChange={(event) => setCostForm((prev) => ({ ...prev, packagingCost: event.target.value }))} placeholder="Packaging cost" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <textarea value={costForm.notes} onChange={(event) => setCostForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Notes" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Save costing record</button>
              </form>
            </article>
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Saved margin checks</h2>
              <div className="mt-4 space-y-3">
                {data.costMargins.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No cost checks yet.</p>}
                {data.costMargins.map((item) => {
                  const totalCost = item.ingredientCost + item.laborCost + item.packagingCost;
                  const profit = item.sellingPrice - totalCost;
                  const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0;
                  return (
                    <article key={item.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-black">{item.itemName}</p>
                          <p className="mt-1 text-xs text-black/60">Price ${item.sellingPrice.toFixed(2)} • Total cost ${totalCost.toFixed(2)}</p>
                          <p className={`mt-2 text-sm font-semibold ${margin >= item.targetMargin ? "text-emerald-800" : "text-amber-800"}`}>Estimated margin {margin.toFixed(1)}% • Profit ${profit.toFixed(2)}</p>
                          {item.notes && <p className="mt-2 text-sm text-black/65">{item.notes}</p>}
                        </div>
                        <button type="button" onClick={() => removeItem("costMargins", item.id)} className="rounded-lg border border-black/15 px-2 py-1 text-xs font-semibold text-black/70 transition hover:border-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          </div>
          {renderAssistantPanel("cost-margin-checker")}
        </section>
      )}

      {workspace === "teamCalendar" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,1fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Schedule an event or shift</h2>
              <form onSubmit={submitCalendarEntry} className="mt-4 space-y-3">
                <input value={calendarForm.title} onChange={(event) => setCalendarForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={calendarForm.date} onChange={(event) => setCalendarForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <select value={calendarForm.type} onChange={(event) => setCalendarForm((prev) => ({ ...prev, type: event.target.value as CalendarEntry["type"] }))} className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600">
                    <option value="shift">Shift</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="time" value={calendarForm.startTime} onChange={(event) => setCalendarForm((prev) => ({ ...prev, startTime: event.target.value }))} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input type="time" value={calendarForm.endTime} onChange={(event) => setCalendarForm((prev) => ({ ...prev, endTime: event.target.value }))} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <select value={calendarForm.employeeEmail} onChange={(event) => setCalendarForm((prev) => ({ ...prev, employeeEmail: event.target.value }))} className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600">
                  <option value="">Shared team event / unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.email} value={employee.email}>
                      {employee.displayName} {employee.position ? `• ${employee.position}` : ""}
                    </option>
                  ))}
                </select>
                <textarea value={calendarForm.notes} onChange={(event) => setCalendarForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Notes" className="w-full resize-none rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Add calendar entry</button>
              </form>
            </article>

            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Calendar entries</h2>
              <div className="mt-4 space-y-3">
                {data.calendarEntries.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No shifts or events yet.</p>}
                {data.calendarEntries
                  .slice()
                  .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
                  .map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-black">{entry.title}</p>
                          <p className="mt-1 text-xs text-black/60">{entry.date} • {entry.startTime || "TBD"} to {entry.endTime || "TBD"} • {entry.type === "shift" ? "Shift" : "Event"}</p>
                          {(entry.employeeName || entry.employeeEmail) && <p className="mt-1 text-xs text-black/60">Assigned to: {entry.employeeName || entry.employeeEmail}</p>}
                          {entry.notes && <p className="mt-2 text-sm text-black/65">{entry.notes}</p>}
                        </div>
                        <button type="button" onClick={() => removeItem("calendarEntries", entry.id)} className="rounded-lg border border-black/15 px-2 py-1 text-xs font-semibold text-black/70 transition hover:border-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </article>
                  ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Employee accounts</h2>
              <p className="mt-2 text-sm leading-6 text-black/65">Employees log in with their own email and password, but they only see the calendar and the shifts assigned to them.</p>
              <form onSubmit={submitEmployee} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={employeeForm.displayName} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Employee name" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                  <input value={employeeForm.position} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, position: event.target.value }))} placeholder="Position" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                </div>
                <input value={employeeForm.email} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Employee email" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <input type="password" value={employeeForm.password} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Temporary password" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
                <button type="submit" disabled={employeeLoading} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60">
                  {employeeLoading ? "Creating..." : "Create employee account"}
                </button>
              </form>
              {employeeNotice && <p className="mt-3 text-sm text-teal-800">{employeeNotice}</p>}
              {employeeError && <p className="mt-3 text-sm text-red-700">{employeeError}</p>}
            </article>

            <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-black">Team roster</h2>
              <div className="mt-4 space-y-3">
                {employees.length === 0 && <p className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">No employee accounts yet.</p>}
                {employees.map((employee) => (
                  <article key={employee.email} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-black">{employee.displayName}</p>
                    <p className="mt-1 text-xs text-black/60">{employee.position || "Team member"} • {employee.email}</p>
                  </article>
                ))}
              </div>
            </article>

            {renderAssistantPanel("team-calendar")}
          </div>
        </section>
      )}

      {workspace === "profile" && (
        <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr,1.15fr]">
          <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-black">Why this matters</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-black/65">
              <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">Business context improves every assistant response across the app.</div>
              <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">Your city, cuisine, customer type, and price point all help tune menu and pricing suggestions.</div>
              <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">This page stays intentionally light so it is easier to keep up to date.</div>
            </div>
          </article>
          <article className="rounded-[2rem] border border-black/10 bg-[var(--card)] p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-black">Business profile</h2>
            <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={profileDraft.businessName} onChange={(event) => setProfileDraft((prev) => ({ ...prev, businessName: event.target.value }))} placeholder="Business name" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
              <input value={profileDraft.city} onChange={(event) => setProfileDraft((prev) => ({ ...prev, city: event.target.value }))} placeholder="City" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
              <input value={profileDraft.cuisineType} onChange={(event) => setProfileDraft((prev) => ({ ...prev, cuisineType: event.target.value }))} placeholder="Cuisine" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
              <input value={profileDraft.customerType} onChange={(event) => setProfileDraft((prev) => ({ ...prev, customerType: event.target.value }))} placeholder="Customer segment" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
              <input value={profileDraft.pricePoint} onChange={(event) => setProfileDraft((prev) => ({ ...prev, pricePoint: event.target.value }))} placeholder="Price point" className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-teal-600" />
              <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600">Save profile</button>
            </form>
            {profileNotice && <p className="mt-3 text-sm text-teal-800">{profileNotice}</p>}
          </article>
        </section>
      )}

      <FloatingDock items={navItems} navOpen={navOpen} onToggle={() => setNavOpen((prev) => !prev)} onClose={() => setNavOpen(false)} onSelect={handleNavItem} activeView={workspace} />
    </main>
  );
}

export { DashboardApp };
