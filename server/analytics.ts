import { createHash } from 'node:crypto';
import type {
  FoodSensitivityRecord,
  HydrationEntry,
  MealEntry,
  Recipe,
  RecipeIngredient,
  ReportCategory,
  ReportRecord,
  SymptomEntry,
  UserProfile,
} from './types.ts';

const INGREDIENT_SYNONYMS: Record<string, string> = {
  'fresh ginger': 'ginger',
  'grated ginger': 'ginger',
  'ginger root': 'ginger',
  'rolled oats': 'oats',
  'old fashioned oats': 'oats',
  'oatmeal': 'oats',
  'silken tofu': 'tofu',
  'firm tofu': 'tofu',
  'wild salmon': 'salmon',
  'salmon fillet': 'salmon',
  'greek yogurt': 'yogurt',
  'plain greek yogurt': 'yogurt',
  'low-fat yogurt': 'yogurt',
  'white miso paste': 'miso',
  'miso paste': 'miso',
  'sweet potato puree': 'sweet potato',
  'mashed sweet potato': 'sweet potato',
  'steamed white rice': 'white rice',
  'jasmine rice': 'white rice',
  'ripe banana': 'banana',
  'frozen blueberries': 'blueberries',
  'fresh blueberries': 'blueberries',
  'poached pear': 'pear',
  'bartlett pear': 'pear',
  'smooth almond butter': 'almond butter',
  'unsweetened almond milk': 'almond milk',
  'low-sodium vegetable broth': 'vegetable broth',
  'chicken bone broth': 'chicken broth',
  'extra virgin olive oil': 'olive oil',
};

const MEASUREMENT_UNITS = [
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'cup',
  'cups',
  'oz',
  'ounce',
  'ounces',
  'g',
  'gram',
  'grams',
  'ml',
  'l',
  'liter',
  'clove',
  'cloves',
  'slice',
  'slices',
  'fillet',
  'medium',
  'large',
  'small',
  'pinch',
];

export function normalizeIngredientName(rawInput: string): string {
  let cleaned = rawInput
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9./\-–]+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token && !MEASUREMENT_UNITS.includes(token));

  cleaned = tokens
    .join(' ')
    .replace(/\b(fresh|organic|chopped|diced|minced|peeled|steamed|cooked|warm|cold|raw|finely|soft|ripe|plain|unsweetened|low-sodium)\b/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (INGREDIENT_SYNONYMS[cleaned]) {
    return INGREDIENT_SYNONYMS[cleaned];
  }

  for (const [key, canonical] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (cleaned.includes(key)) {
      return canonical;
    }
  }

  return cleaned || rawInput.trim().toLowerCase();
}

export function parseAndCleanIngredient(rawLine: string): RecipeIngredient {
  const trimmed = rawLine.trim();
  const match = trimmed.match(/^([0-9./\-\s]+)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (match) {
    const qty = match[1].trim();
    const maybeUnit = (match[2] || '').toLowerCase();
    const isUnit = MEASUREMENT_UNITS.includes(maybeUnit);
    const namePart = isUnit ? match[3] : `${match[2] || ''} ${match[3]}`.trim();
    return {
      raw: trimmed,
      quantity: qty,
      unit: isUnit ? maybeUnit : 'unit',
      normalized: normalizeIngredientName(namePart),
    };
  }
  return {
    raw: trimmed,
    quantity: 'to taste',
    unit: 'serving',
    normalized: normalizeIngredientName(trimmed),
  };
}

export function detectSafetyAndAllergenWarnings(
  ingredients: RecipeIngredient[],
  instructions: string[]
): { safetyWarnings: string[]; allergens: string[] } {
  const text = `${ingredients.map((i) => i.raw).join(' ')} ${instructions.join(' ')}`.toLowerCase();
  const safetyWarnings: string[] = [];
  const allergens: string[] = [];

  if (/\b(raw|unpasteurized|sushi|tartare|soft-boiled|runny egg|sprouts)\b/.test(text)) {
    safetyWarnings.push(
      'Contains potentially undercooked or raw ingredients; ensure full pasteurization or thorough cooking if neutropenic precautions apply.'
    );
  }
  if (/\b(chili|cayenne|jalapeno|hot sauce|acidic|vinegar|lemon juice|tomato)\b/.test(text)) {
    safetyWarnings.push(
      'Contains acidic or mildly spiced components; may require adjustment during oral mucositis or active nausea.'
    );
  }
  if (/\b(grapefruit|seville orange|pomelo)\b/.test(text)) {
    safetyWarnings.push(
      'Contains grapefruit/citrus that may interact with certain oral oncology medications; verify with your oncology pharmacist.'
    );
  }

  if (/\b(salmon|cod|fish|tuna)\b/.test(text)) allergens.push('Fish');
  if (/\b(almond|walnut|cashew|pecan|peanut|nut)\b/.test(text)) allergens.push('Tree Nuts / Peanuts');
  if (/\b(milk|yogurt|cheese|butter|whey|cream)\b/.test(text)) allergens.push('Dairy');
  if (/\b(tofu|miso|soy|edamame|tamari)\b/.test(text)) allergens.push('Soy');
  if (/\b(wheat|flour|bread|pasta|barley)\b/.test(text)) allergens.push('Gluten / Wheat');
  if (/\b(sesame|tahini)\b/.test(text)) allergens.push('Sesame');

  return { safetyWarnings, allergens };
}

export interface TolerancePattern {
  ingredient: string;
  occurrences: number;
  avgRating: number;
  lowToleranceCount: number;
  classification: 'well-tolerated' | 'mixed' | 'watch';
  observationalNote: string;
}

export function analyzeTolerancePatterns(
  meals: MealEntry[],
  sensitivities: FoodSensitivityRecord[]
): TolerancePattern[] {
  const stats = new Map<string, { ratings: number[]; lowCount: number }>();

  for (const meal of meals) {
    const items =
      meal.normalizedIngredients.length > 0
        ? meal.normalizedIngredients
        : [normalizeIngredientName(meal.foodName)];
    for (const ing of items) {
      if (!ing) continue;
      const cur = stats.get(ing) || { ratings: [], lowCount: 0 };
      cur.ratings.push(meal.toleranceRating);
      if (meal.toleranceRating <= 2) cur.lowCount += 1;
      stats.set(ing, cur);
    }
  }

  const sensitivitySet = new Set(sensitivities.map((s) => s.normalizedIngredient));
  const patterns: TolerancePattern[] = [];

  for (const [ingredient, data] of stats.entries()) {
    const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    const isSensitive = sensitivitySet.has(ingredient);
    let classification: TolerancePattern['classification'] = 'mixed';
    if (isSensitive || avg <= 2.7) {
      classification = 'watch';
    } else if (avg >= 4.0 && data.lowCount === 0) {
      classification = 'well-tolerated';
    }

    const observationalNote =
      classification === 'well-tolerated'
        ? `Logged ${data.ratings.length} time(s) with an average comfort score of ${avg.toFixed(1)}/5.`
        : classification === 'watch'
          ? `Observed lower comfort ratings (${avg.toFixed(1)}/5) or sensitivity note. Non-causal observation—discuss patterns with your care team.`
          : `Varied tolerance across ${data.ratings.length} entry/entries (${avg.toFixed(1)}/5 average).`;

    patterns.push({
      ingredient,
      occurrences: data.ratings.length,
      avgRating: Number(avg.toFixed(2)),
      lowToleranceCount: data.lowCount,
      classification,
      observationalNote,
    });
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences || b.avgRating - a.avgRating);
}

export interface RecipeRecommendation {
  recipe: Recipe;
  matchScore: number;
  wellToleratedMatches: string[];
  attentionIngredients: string[];
  explanation: string;
}

export function recommendRecipesForUser(
  recipes: Recipe[],
  profile: UserProfile,
  meals: MealEntry[],
  sensitivities: FoodSensitivityRecord[],
  recentSymptoms: SymptomEntry[]
): RecipeRecommendation[] {
  const patterns = analyzeTolerancePatterns(meals, sensitivities);
  const patternMap = new Map(patterns.map((p) => [p.ingredient, p]));
  const allergyTerms = profile.allergies.map((a) => a.toLowerCase());
  const sensitivityTerms = sensitivities.map((s) => s.normalizedIngredient.toLowerCase());
  const hasActiveNausea = recentSymptoms.some(
    (s) => s.symptomName.toLowerCase().includes('nausea') && s.severity >= 3
  );
  const hasSwallowingDifficulty = recentSymptoms.some(
    (s) => s.category === 'swallowing' && s.severity >= 2
  );

  const scored = recipes.map((recipe) => {
    let score = 72;
    const wellToleratedMatches: string[] = [];
    const attentionIngredients: string[] = [];

    for (const ing of recipe.ingredients) {
      const norm = ing.normalized.toLowerCase();
      const pat = patternMap.get(norm);
      if (pat?.classification === 'well-tolerated') {
        score += 8;
        if (!wellToleratedMatches.includes(norm)) wellToleratedMatches.push(norm);
      } else if (pat?.classification === 'watch') {
        score -= 18;
        if (!attentionIngredients.includes(norm)) attentionIngredients.push(norm);
      }

      if (sensitivityTerms.some((s) => norm.includes(s) || s.includes(norm))) {
        score -= 22;
        if (!attentionIngredients.includes(norm)) attentionIngredients.push(norm);
      }
    }

    for (const allergen of recipe.allergens) {
      if (allergyTerms.some((a) => allergen.toLowerCase().includes(a))) {
        score -= 45;
        attentionIngredients.push(`Allergen: ${allergen}`);
      }
    }

    if (hasActiveNausea && recipe.dietaryTags.some((t) => /bland|ginger|gentle|broth/i.test(t))) {
      score += 12;
    }
    if (
      hasSwallowingDifficulty &&
      recipe.dietaryTags.some((t) => /soft|smooth|puree|liquid|broth/i.test(t))
    ) {
      score += 12;
    }

    for (const restriction of profile.dietaryRestrictions) {
      const rLower = restriction.toLowerCase();
      if (recipe.dietaryTags.some((t) => t.toLowerCase().includes(rLower))) {
        score += 6;
      }
    }

    const clampedScore = Math.max(15, Math.min(99, Math.round(score)));
    const reasons: string[] = [];
    if (wellToleratedMatches.length > 0) {
      reasons.push(`Includes ingredients you tolerated well (${wellToleratedMatches.slice(0, 3).join(', ')}).`);
    }
    if (hasActiveNausea && recipe.dietaryTags.some((t) => /bland|ginger|gentle/i.test(t))) {
      reasons.push('Selected for gentle flavor profile aligned with recent nausea entries.');
    }
    if (hasSwallowingDifficulty && recipe.dietaryTags.some((t) => /soft|smooth|broth/i.test(t))) {
      reasons.push('Soft or liquid texture aligns with reported swallowing comfort needs.');
    }
    if (attentionIngredients.length > 0) {
      reasons.push(
        `Warrants attention: check ${attentionIngredients.slice(0, 3).join(', ')} against your sensitivity profile.`
      );
    }
    if (reasons.length === 0) {
      reasons.push('Balanced, gentle preparation aligned with your general dietary preferences.');
    }

    return {
      recipe,
      matchScore: clampedScore,
      wellToleratedMatches,
      attentionIngredients,
      explanation: reasons.join(' '),
    };
  });

  return scored.sort((a, b) => b.matchScore - a.matchScore);
}

export function buildDashboardAnalytics(
  meals: MealEntry[],
  hydration: HydrationEntry[],
  symptoms: SymptomEntry[],
  sensitivities: FoodSensitivityRecord[],
  profile: UserProfile,
  days: number,
  startIso?: string,
  endIso?: string
) {
  const now = new Date();
  const endDate = endIso ? new Date(endIso) : now;
  const startDate = startIso
    ? new Date(startIso)
    : new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const inRange = (ts: string) => {
    const d = new Date(ts);
    return d >= startDate && d <= endDate;
  };

  const rangeMeals = meals.filter((m) => inRange(m.timestamp));
  const rangeHydration = hydration.filter((h) => inRange(h.timestamp));
  const rangeSymptoms = symptoms.filter((s) => inRange(s.timestamp));

  // Build day-by-day timeline
  const dayBuckets = new Map<
    string,
    {
      date: string;
      mealCount: number;
      fluidMl: number;
      symptomCount: number;
      avgSeverity: number | null;
      avgAppetite: number | null;
      severities: number[];
      appetites: number[];
    }
  >();

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    dayBuckets.set(key, {
      date: key,
      mealCount: 0,
      fluidMl: 0,
      symptomCount: 0,
      avgSeverity: null,
      avgAppetite: null,
      severities: [],
      appetites: [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const m of rangeMeals) {
    const key = new Date(m.timestamp).toISOString().slice(0, 10);
    const b = dayBuckets.get(key);
    if (b) b.mealCount += 1;
  }

  for (const h of rangeHydration) {
    const key = new Date(h.timestamp).toISOString().slice(0, 10);
    const b = dayBuckets.get(key);
    if (b) b.fluidMl += h.amountMl;
  }

  for (const s of rangeSymptoms) {
    const key = new Date(s.timestamp).toISOString().slice(0, 10);
    const b = dayBuckets.get(key);
    if (b) {
      b.symptomCount += 1;
      b.severities.push(s.severity);
      if (typeof s.appetiteScore === 'number') {
        b.appetites.push(s.appetiteScore);
      }
    }
  }

  const timeline = Array.from(dayBuckets.values()).map((b) => ({
    date: b.date,
    mealCount: b.mealCount,
    fluidMl: b.fluidMl,
    symptomCount: b.symptomCount,
    avgSeverity:
      b.severities.length > 0
        ? Number((b.severities.reduce((x, y) => x + y, 0) / b.severities.length).toFixed(2))
        : null,
    avgAppetite:
      b.appetites.length > 0
        ? Number((b.appetites.reduce((x, y) => x + y, 0) / b.appetites.length).toFixed(2))
        : null,
  }));

  const symptomAgg = new Map<string, { count: number; severities: number[] }>();
  for (const s of rangeSymptoms) {
    const cur = symptomAgg.get(s.symptomName) || { count: 0, severities: [] };
    cur.count += 1;
    cur.severities.push(s.severity);
    symptomAgg.set(s.symptomName, cur);
  }

  const symptomTrends = Array.from(symptomAgg.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgSeverity: Number(
        (data.severities.reduce((a, b) => a + b, 0) / data.severities.length).toFixed(2)
      ),
    }))
    .sort((a, b) => b.count - a.count);

  const appetiteEntries = rangeSymptoms.filter((s) => typeof s.appetiteScore === 'number');
  const avgAppetite =
    appetiteEntries.length > 0
      ? Number(
          (
            appetiteEntries.reduce((sum, s) => sum + (s.appetiteScore || 0), 0) /
            appetiteEntries.length
          ).toFixed(2)
        )
      : null;

  const avgTolerance =
    rangeMeals.length > 0
      ? Number(
          (rangeMeals.reduce((sum, m) => sum + m.toleranceRating, 0) / rangeMeals.length).toFixed(2)
        )
      : null;

  const activeDaysCount = Math.max(1, timeline.length);
  const totalFluidMl = rangeHydration.reduce((sum, h) => sum + h.amountMl, 0);
  const avgDailyFluidMl = Math.round(totalFluidMl / activeDaysCount);

  const todayKey = now.toISOString().slice(0, 10);
  const todayFluidMl = hydration
    .filter((h) => new Date(h.timestamp).toISOString().slice(0, 10) === todayKey)
    .reduce((sum, h) => sum + h.amountMl, 0);

  const tolerancePatterns = analyzeTolerancePatterns(rangeMeals, sensitivities);

  return {
    rangeStart: startDate.toISOString(),
    rangeEnd: endDate.toISOString(),
    kpis: {
      totalMeals: rangeMeals.length,
      todayFluidMl,
      fluidGoalMl: profile.dailyFluidGoalMl,
      avgDailyFluidMl,
      avgAppetite,
      avgTolerance,
      totalSymptoms: rangeSymptoms.length,
    },
    timeline,
    symptomTrends,
    tolerancePatterns,
  };
}

export function buildValidatedReport(
  reportId: string,
  userId: string,
  title: string,
  dateRangeStart: string,
  dateRangeEnd: string,
  includedCategories: ReportCategory[],
  meals: MealEntry[],
  hydration: HydrationEntry[],
  symptoms: SymptomEntry[],
  sensitivities: FoodSensitivityRecord[],
  profile: UserProfile
): ReportRecord {
  const start = new Date(dateRangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateRangeEnd);
  end.setHours(23, 59, 59, 999);

  const inRange = (ts: string) => {
    const d = new Date(ts);
    return d >= start && d <= end;
  };

  const rMeals = includedCategories.includes('meals') || includedCategories.includes('tolerances')
    ? meals.filter((m) => inRange(m.timestamp))
    : [];
  const rHydration = includedCategories.includes('hydration')
    ? hydration.filter((h) => inRange(h.timestamp))
    : [];
  const rSymptoms = includedCategories.includes('symptoms') || includedCategories.includes('appetite')
    ? symptoms.filter((s) => inRange(s.timestamp))
    : [];
  const rSensitivities = includedCategories.includes('sensitivities') ? sensitivities : [];

  const analytics = buildDashboardAnalytics(
    meals,
    hydration,
    symptoms,
    sensitivities,
    profile,
    14,
    start.toISOString(),
    end.toISOString()
  );

  const wellToleratedFoods = analytics.tolerancePatterns
    .filter((p) => p.classification === 'well-tolerated')
    .slice(0, 5)
    .map((p) => ({ ingredient: p.ingredient, avgRating: p.avgRating, count: p.occurrences }));

  const cautionFoods = analytics.tolerancePatterns
    .filter((p) => p.classification === 'watch')
    .slice(0, 5)
    .map((p) => ({ ingredient: p.ingredient, avgRating: p.avgRating, count: p.occurrences }));

  const checksumPayload = JSON.stringify({
    mealIds: rMeals.map((m) => m.id).sort(),
    hydrationIds: rHydration.map((h) => h.id).sort(),
    symptomIds: rSymptoms.map((s) => s.id).sort(),
    sensitivityIds: rSensitivities.map((s) => s.id).sort(),
    dateRangeStart,
    dateRangeEnd,
  });

  const validationChecksum = createHash('sha256').update(checksumPayload).digest('hex').slice(0, 16);

  return {
    id: reportId,
    userId,
    title,
    dateRangeStart: start.toISOString(),
    dateRangeEnd: end.toISOString(),
    includedCategories,
    generatedAt: new Date().toISOString(),
    validationChecksum,
    recordCounts: {
      meals: rMeals.length,
      hydration: rHydration.length,
      symptoms: rSymptoms.length,
      sensitivities: rSensitivities.length,
    },
    summary: {
      totalMeals: rMeals.length,
      avgDailyFluidMl: analytics.kpis.avgDailyFluidMl,
      fluidGoalMl: profile.dailyFluidGoalMl,
      avgAppetiteScore: analytics.kpis.avgAppetite,
      avgToleranceRating: analytics.kpis.avgTolerance,
      topSymptoms: analytics.symptomTrends.slice(0, 5),
      wellToleratedFoods,
      cautionFoods,
    },
  };
}
