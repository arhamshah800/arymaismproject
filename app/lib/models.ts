export type WorkflowBranch = "yes" | "no";

export type AssistantMode =
  | "chatbot"
  | "inventory"
  | "reviews"
  | "menu"
  | "personality"
  | "menuUpload"
  | "recipe"
  | "costing";

export type AppUserRole = "owner" | "employee";

export type RestaurantProfile = {
  businessName: string;
  city: string;
  cuisineType: string;
  customerType: string;
  pricePoint: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reorderPoint: number;
  menuDependency: string;
  updatedAt: string;
};

export type IssueSeverity = "low" | "medium" | "high";

export type IssueStatus = "open" | "in-progress" | "resolved";

export type IssueRecord = {
  id: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  owner: string;
  outcome: string;
  updatedAt: string;
};

export type MenuExperiment = {
  id: string;
  conceptName: string;
  dishType: string;
  specials: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  updatedAt: string;
};

export type PersonalityRecipe = {
  id: string;
  title: string;
  cuisineType: string;
  dishType: string;
  difficulty: "easy" | "medium" | "hard";
  notes: string;
  updatedAt: string;
};

export type MenuUploadRecord = {
  id: string;
  fileName: string;
  content: string;
  notes: string;
  uploadedAt: string;
};

export type RecipeGenerationRecord = {
  id: string;
  title: string;
  cuisineType: string;
  dishType: string;
  difficulty: "easy" | "medium" | "hard";
  ingredients: string;
  method: string;
  platingNotes: string;
  foodCostGoal: string;
  updatedAt: string;
};

export type ReviewTrackerRecord = {
  id: string;
  channel: string;
  reviewText: string;
  starRating: string;
  status: "new" | "in-progress" | "resolved";
  publicResponse: string;
  internalFixPlan: string;
  owner: string;
  updatedAt: string;
};

export type CostMarginRecord = {
  id: string;
  itemName: string;
  sellingPrice: number;
  ingredientCost: number;
  laborCost: number;
  packagingCost: number;
  targetMargin: number;
  notes: string;
  updatedAt: string;
};

export type CalendarEntryType = "event" | "shift";

export type CalendarEntry = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: CalendarEntryType;
  employeeEmail: string;
  employeeName: string;
  notes: string;
  updatedAt: string;
};

export type EmployeeAccountSummary = {
  email: string;
  displayName: string;
  position: string;
  createdAt: string;
};

export type QuickAskMessage = {
  role: "user" | "assistant";
  content: string;
  mode: AssistantMode;
  createdAt: string;
};

export type WorkflowIntakeAnswers = Record<string, string>;

export type WorkflowModule = {
  id: string;
  label: string;
  mode: AssistantMode;
  branch: WorkflowBranch;
  description: string;
};

export type RestaurantData = {
  workflowBranch: WorkflowBranch | null;
  selectedWorkflowModuleId: string | null;
  workflowIntake: Record<string, WorkflowIntakeAnswers>;
  inventory: InventoryItem[];
  issues: IssueRecord[];
  menuExperiments: MenuExperiment[];
  personalityRecipes: PersonalityRecipe[];
  menuUploads: MenuUploadRecord[];
  recipeGenerations: RecipeGenerationRecord[];
  reviewTrackers: ReviewTrackerRecord[];
  costMargins: CostMarginRecord[];
  calendarEntries: CalendarEntry[];
  quickAsk: QuickAskMessage[];
  todayQueue: string[];
};

export type DashboardKPI = {
  id: string;
  label: string;
  value: string;
  tone: "neutral" | "good" | "warning";
};

export const DEFAULT_PROFILE: RestaurantProfile = {
  businessName: "",
  city: "Dallas-Fort Worth",
  cuisineType: "",
  customerType: "Local families and office workers",
  pricePoint: "$$",
};

export const WORKFLOW_MODULES: WorkflowModule[] = [
  {
    id: "menu-creation",
    label: "Menu Creation",
    mode: "menu",
    branch: "no",
    description: "Build menu ideas, item counts, and specials for a new concept.",
  },
  {
    id: "personality-recipe",
    label: "Personality Recipe",
    mode: "personality",
    branch: "no",
    description: "Generate recipe concepts by dish style and difficulty.",
  },
  {
    id: "chatbot-concierge",
    label: "Chatbot Concierge",
    mode: "chatbot",
    branch: "yes",
    description: "Quick operational guidance for day-to-day restaurant situations.",
  },
  {
    id: "inventory-manager",
    label: "Inventory Manager",
    mode: "inventory",
    branch: "yes",
    description: "Track current stock and map inventory usage to menu demand.",
  },
  {
    id: "issue-solver",
    label: "Issue Solver",
    mode: "reviews",
    branch: "yes",
    description: "Turn customer issues into response plans and internal fixes.",
  },
  {
    id: "menu-upload",
    label: "Menu Upload + Recs",
    mode: "menuUpload",
    branch: "yes",
    description: "Upload your current menu text and get recommendations for gaps, clarity, and upsells.",
  },
  {
    id: "recipe-generator",
    label: "Recipe Generator",
    mode: "recipe",
    branch: "yes",
    description: "Generate practical recipes for your current concept, kitchen flow, and customer base.",
  },
  {
    id: "review-fix-tracker",
    label: "Review Response + Fix Tracker",
    mode: "reviews",
    branch: "yes",
    description: "Turn customer reviews into response drafts, fix plans, and accountability.",
  },
  {
    id: "cost-margin-checker",
    label: "Cost & Margin Checker",
    mode: "costing",
    branch: "yes",
    description: "Check menu pricing, margin pressure, and where small changes could help most.",
  },
  {
    id: "team-calendar",
    label: "Team Calendar",
    mode: "chatbot",
    branch: "yes",
    description: "Manage events, employee shifts, and what staff should see in their own dashboard.",
  },
];

export const INTAKE_FIELDS: Record<
  string,
  Array<{ id: string; label: string; placeholder: string; required?: boolean; rows?: number }>
> = {
  "menu-creation": [
    {
      id: "typeOfCuisine",
      label: "Type of Cuisine",
      placeholder: "Example: Modern Mexican, vegan cafe",
      required: true,
    },
    {
      id: "numberOfMenuItems",
      label: "Number of Menu Items",
      placeholder: "Example: 20",
      required: true,
    },
    {
      id: "anySpecials",
      label: "Any Specials",
      placeholder: "Example: Weekend tasting menu",
    },
    {
      id: "specialIdeas",
      label: "Any Special Ideas for Menu",
      placeholder: "Share seasonal, regional, or signature ideas",
      rows: 3,
    },
  ],
  "personality-recipe": [
    {
      id: "typeOfCuisine",
      label: "Type of Cuisine",
      placeholder: "Example: Korean fusion",
      required: true,
    },
    {
      id: "typeOfDish",
      label: "Type of Dish",
      placeholder: "Example: Entree",
      required: true,
    },
    {
      id: "difficultyOfRecipe",
      label: "Difficulty of Recipe",
      placeholder: "Easy, medium, or hard",
      required: true,
    },
  ],
  "chatbot-concierge": [
    {
      id: "issueName",
      label: "Name Your Issue",
      placeholder: "Example: Late prep times during lunch rush",
      required: true,
      rows: 3,
    },
  ],
  "inventory-manager": [
    {
      id: "enterInventory",
      label: "Enter Inventory",
      placeholder: "List current inventory and quantities, one per line",
      required: true,
      rows: 4,
    },
    {
      id: "menuItemsNeeded",
      label: "Enter Menu and Items Needed Per Order",
      placeholder: "Example: Burger -> 1 patty, 1 bun, 1 cheese slice",
      required: true,
      rows: 4,
    },
  ],
  "issue-solver": [
    {
      id: "whatIsIssue",
      label: "What Is Your Issue",
      placeholder: "Describe the customer issue and context",
      required: true,
      rows: 3,
    },
  ],
  "menu-upload": [
    {
      id: "menuGoals",
      label: "What Feedback Do You Want",
      placeholder: "Example: stronger upsells, clearer descriptions, better balance",
      required: true,
      rows: 3,
    },
  ],
  "recipe-generator": [
    {
      id: "recipeGoal",
      label: "Recipe Goal",
      placeholder: "Example: quick high-margin lunch entree",
      required: true,
    },
    {
      id: "kitchenConstraints",
      label: "Kitchen Constraints",
      placeholder: "Example: one flat-top, limited fryer space, quick prep",
      rows: 3,
    },
  ],
  "review-fix-tracker": [
    {
      id: "reviewPattern",
      label: "What Review Pattern Are You Seeing",
      placeholder: "Example: slow service complaints on weekends",
      required: true,
      rows: 3,
    },
  ],
  "cost-margin-checker": [
    {
      id: "costGoal",
      label: "Main Cost Question",
      placeholder: "Example: which dishes are underpriced?",
      required: true,
      rows: 3,
    },
  ],
  "team-calendar": [
    {
      id: "teamPlanningFocus",
      label: "What Are You Planning Around",
      placeholder: "Example: graduation weekend, staffing shortages, private events",
      required: true,
      rows: 3,
    },
  ],
};

export const SHARED_INTAKE_FIELDS = [
  {
    id: "restaurantLocation",
    label: "Where Is the Restaurant",
    placeholder: "Example: Dallas, TX",
    required: true,
  },
  {
    id: "clarifyingQuestions",
    label: "Any Clarifying Questions (Optional)",
    placeholder: "Any extra details for better recommendations",
    rows: 2,
  },
] as const;

export function getDefaultRestaurantData(): RestaurantData {
  return {
    workflowBranch: null,
    selectedWorkflowModuleId: null,
    workflowIntake: {},
    inventory: [],
    issues: [],
    menuExperiments: [],
    personalityRecipes: [],
    menuUploads: [],
    recipeGenerations: [],
    reviewTrackers: [],
    costMargins: [],
    calendarEntries: [],
    quickAsk: [],
    todayQueue: [
      "Review low-stock alerts",
      "Review recent customer feedback",
      "Check a margin-sensitive menu item",
      "Finalize one team shift plan",
    ],
  };
}
