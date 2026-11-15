export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type SymptomCategory =
  | 'gastrointestinal'
  | 'sensory'
  | 'energy'
  | 'swallowing'
  | 'appetite';

export interface LoggingPreferences {
  meals: boolean;
  hydration: boolean;
  symptoms: boolean;
  appetite: boolean;
  tolerances: boolean;
}

export interface ReminderSettings {
  mealRemindersEnabled: boolean;
  mealTimes: string[];
  hydrationRemindersEnabled: boolean;
  hydrationIntervalMinutes: number;
}

export interface UserProfile {
  dietaryRestrictions: string[];
  allergies: string[];
  treatmentPhase: string;
  dailyFluidGoalMl: number;
  preferredTemp: 'room' | 'cool' | 'warm' | 'any';
  loggingPreferences: LoggingPreferences;
  reminders: ReminderSettings;
  clinicianName?: string;
  dietitianName?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'caregiver';
  createdAt: string;
  profile: UserProfile;
}

export interface NutritionSnapshot {
  proteinG?: number;
  fiberG?: number;
  potassiumMg?: number;
  sodiumMg?: number;
  ironMg?: number;
  vitaminCMg?: number;
  energyKcal?: number;
  source?: string;
}

export interface MealEntry {
  id: string;
  userId: string;
  mealType: MealType;
  foodName: string;
  ingredients: string[];
  normalizedIngredients: string[];
  portion: string;
  timestamp: string;
  toleranceRating: number;
  toleranceNotes: string;
  isCustomFood: boolean;
  nutritionSummary?: NutritionSnapshot;
}

export interface HydrationEntry {
  id: string;
  userId: string;
  fluidType: string;
  amountMl: number;
  temperature: 'cool' | 'room' | 'warm';
  timestamp: string;
  notes: string;
}

export interface SymptomCatalogItem {
  id: string;
  name: string;
  category: SymptomCategory;
  description: string;
  quickEntry: boolean;
}

export interface SymptomEntry {
  id: string;
  userId: string;
  symptomId: string;
  symptomName: string;
  category: SymptomCategory;
  severity: number;
  appetiteScore?: number;
  eatingDifficulty?: string;
  triggerFood?: string;
  timestamp: string;
  notes: string;
}

export interface FoodSensitivityRecord {
  id: string;
  userId: string;
  foodName: string;
  normalizedIngredient: string;
  reactionType: string;
  severity: number;
  notes: string;
  lastReportedAt: string;
}

export interface TolerancePattern {
  ingredient: string;
  occurrences: number;
  avgRating: number;
  lowToleranceCount: number;
  classification: 'well-tolerated' | 'mixed' | 'watch';
  observationalNote: string;
}

export interface DashboardAnalytics {
  rangeStart: string;
  rangeEnd: string;
  disclaimer: string;
  kpis: {
    totalMeals: number;
    todayFluidMl: number;
    fluidGoalMl: number;
    avgDailyFluidMl: number;
    avgAppetite: number | null;
    avgTolerance: number | null;
    totalSymptoms: number;
  };
  timeline: Array<{
    date: string;
    mealCount: number;
    fluidMl: number;
    symptomCount: number;
    avgSeverity: number | null;
    avgAppetite: number | null;
  }>;
  symptomTrends: Array<{ name: string; count: number; avgSeverity: number }>;
  tolerancePatterns: TolerancePattern[];
}

export interface RecipeIngredient {
  raw: string;
  normalized: string;
  quantity: string;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  category: 'Breakfast' | 'Soup & Broth' | 'Main Dish' | 'Smoothie & Snack';
  prepTimeMinutes: number;
  servings: number;
  imageUrl: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  dietaryTags: string[];
  safetyWarnings: string[];
  allergens: string[];
  sourceName: string;
  sourceUrl: string;
  sourceVerified: boolean;
  nutritionPerServing: NutritionSnapshot;
  isCustom: boolean;
  isSaved?: boolean;
}

export interface RecipeRecommendation {
  recipe: Recipe;
  matchScore: number;
  wellToleratedMatches: string[];
  attentionIngredients: string[];
  explanation: string;
}

export interface RecipeCollection {
  id: string;
  userId: string;
  name: string;
  description: string;
  recipeIds: string[];
}

export interface UsdaFoodItem {
  fdcId: number;
  description: string;
  category: string;
  servingSizeLabel: string;
  nutrientsPer100g: {
    proteinG: number;
    fiberG: number;
    potassiumMg: number;
    sodiumMg: number;
    ironMg: number;
    vitaminCMg: number;
    calciumMg: number;
    energyKcal: number;
  };
}

export interface FoodSafetyGuide {
  id: string;
  topic: string;
  audience: string;
  summary: string;
  actionableSteps: string[];
  avoidList: string[];
  sourceOrganization: string;
  sourceUrl: string;
}

export interface HealthcareResource {
  id: string;
  title: string;
  organization: string;
  description: string;
  url: string;
  category: string;
}

export type ReportCategory =
  | 'meals'
  | 'hydration'
  | 'symptoms'
  | 'appetite'
  | 'tolerances'
  | 'sensitivities';

export interface ReportRecord {
  id: string;
  userId: string;
  title: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  includedCategories: ReportCategory[];
  generatedAt: string;
  validationChecksum: string;
  recordCounts: {
    meals: number;
    hydration: number;
    symptoms: number;
    sensitivities: number;
  };
  summary: {
    totalMeals: number;
    avgDailyFluidMl: number;
    fluidGoalMl: number;
    avgAppetiteScore: number | null;
    avgToleranceRating: number | null;
    topSymptoms: Array<{ name: string; count: number; avgSeverity: number }>;
    wellToleratedFoods: Array<{ ingredient: string; avgRating: number; count: number }>;
    cautionFoods: Array<{ ingredient: string; avgRating: number; count: number }>;
  };
}

export interface CaregiverGrant {
  id: string;
  patientUserId: string;
  caregiverName: string;
  caregiverEmail: string;
  relationship: string;
  permissions: Array<'read_journal' | 'log_entries' | 'export_reports'>;
  active: boolean;
  grantedAt: string;
}

export interface ApiEndpointDoc {
  method: string;
  path: string;
  auth: boolean;
  summary: string;
  sampleBody?: Record<string, unknown>;
}
