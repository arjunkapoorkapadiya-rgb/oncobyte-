import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  buildDashboardAnalytics,
  buildValidatedReport,
  detectSafetyAndAllergenWarnings,
  normalizeIngredientName,
  parseAndCleanIngredient,
  recommendRecipesForUser,
} from './analytics.ts';
import {
  type AuthenticatedRequest,
  hashPassword,
  issueSessionToken,
  requireAuth,
  sanitizeUser,
  verifyPassword,
} from './auth.ts';
import { getDb, saveDb } from './db.ts';
import { generateClinicalReportPdf } from './pdf.ts';
import type { MealType, ReportCategory, SymptomCategory } from './types.ts';

export const apiRouter = Router();

const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const VALID_SYMPTOM_CATS: SymptomCategory[] = [
  'gastrointestinal',
  'sensory',
  'energy',
  'swallowing',
  'appetite',
];

// Health check
apiRouter.get('/health', (_req, res) => {
  const db = getDb();
  res.json({
    status: 'ok',
    service: 'OncoByte Independent API',
    timestamp: new Date().toISOString(),
    records: {
      recipes: db.recipes.length,
      usdaFoods: db.usdaFoods.length,
      safetyGuides: db.foodSafetyGuides.length,
    },
  });
});

// Authentication
apiRouter.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Name must be at least 2 characters.' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const newUser = {
    id: `usr_${randomUUID().slice(0, 8)}`,
    email: normalizedEmail,
    name: name.trim(),
    passwordHash: hashPassword(password),
    role: 'patient' as const,
    createdAt: new Date().toISOString(),
    profile: {
      dietaryRestrictions: [],
      allergies: [],
      treatmentPhase: 'Active Care',
      dailyFluidGoalMl: 1800,
      preferredTemp: 'room' as const,
      loggingPreferences: {
        meals: true,
        hydration: true,
        symptoms: true,
        appetite: true,
        tolerances: true,
      },
      reminders: {
        mealRemindersEnabled: false,
        mealTimes: ['08:30', '12:30', '18:00'],
        hydrationRemindersEnabled: false,
        hydrationIntervalMinutes: 120,
      },
    },
  };

  db.users.push(newUser);
  saveDb();

  const token = issueSessionToken(newUser.id, newUser.email);
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  const token = issueSessionToken(user.id, user.email);
  res.json({ token, user: sanitizeUser(user) });
});

apiRouter.post('/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

// User Profile & Logging Preferences
apiRouter.get('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ profile: req.user!.profile, name: req.user!.name, email: req.user!.email });
});

apiRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const body = req.body || {};
  if (typeof body.name === 'string' && body.name.trim().length >= 2) {
    user.name = body.name.trim();
  }
  if (body.profile && typeof body.profile === 'object') {
    const p = body.profile;
    user.profile = {
      ...user.profile,
      dietaryRestrictions: Array.isArray(p.dietaryRestrictions)
        ? p.dietaryRestrictions.map(String)
        : user.profile.dietaryRestrictions,
      allergies: Array.isArray(p.allergies) ? p.allergies.map(String) : user.profile.allergies,
      treatmentPhase:
        typeof p.treatmentPhase === 'string' ? p.treatmentPhase : user.profile.treatmentPhase,
      dailyFluidGoalMl:
        typeof p.dailyFluidGoalMl === 'number' && p.dailyFluidGoalMl >= 400
          ? Math.min(5000, Math.round(p.dailyFluidGoalMl))
          : user.profile.dailyFluidGoalMl,
      preferredTemp: p.preferredTemp || user.profile.preferredTemp,
      loggingPreferences: p.loggingPreferences
        ? { ...user.profile.loggingPreferences, ...p.loggingPreferences }
        : user.profile.loggingPreferences,
      reminders: p.reminders ? { ...user.profile.reminders, ...p.reminders } : user.profile.reminders,
      clinicianName:
        typeof p.clinicianName === 'string' ? p.clinicianName : user.profile.clinicianName,
      dietitianName:
        typeof p.dietitianName === 'string' ? p.dietitianName : user.profile.dietitianName,
    };
  }
  saveDb();
  res.json({ user: sanitizeUser(user) });
});

// Meal Logging CRUD
apiRouter.get('/meals', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { start, end, mealType } = req.query;
  let items = db.meals.filter((m) => m.userId === req.user!.id);
  if (typeof mealType === 'string' && VALID_MEAL_TYPES.includes(mealType as MealType)) {
    items = items.filter((m) => m.mealType === mealType);
  }
  if (typeof start === 'string') {
    const s = new Date(start);
    if (!Number.isNaN(s.getTime())) items = items.filter((m) => new Date(m.timestamp) >= s);
  }
  if (typeof end === 'string') {
    const e = new Date(end);
    if (!Number.isNaN(e.getTime())) items = items.filter((m) => new Date(m.timestamp) <= e);
  }
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ meals: items });
});

apiRouter.post('/meals', requireAuth, (req: AuthenticatedRequest, res) => {
  const {
    mealType,
    foodName,
    ingredients,
    portion,
    timestamp,
    toleranceRating,
    toleranceNotes,
    isCustomFood,
    nutritionSummary,
  } = req.body || {};

  if (!VALID_MEAL_TYPES.includes(mealType)) {
    res.status(400).json({ error: 'mealType must be breakfast, lunch, dinner, or snack.' });
    return;
  }
  if (!foodName || typeof foodName !== 'string' || !foodName.trim()) {
    res.status(400).json({ error: 'foodName is required.' });
    return;
  }
  const rating = Number(toleranceRating);
  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'toleranceRating must be between 1 and 5.' });
    return;
  }

  const rawIngredients = Array.isArray(ingredients)
    ? ingredients.map((i) => String(i).trim()).filter(Boolean)
    : typeof ingredients === 'string'
      ? ingredients
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean)
      : [foodName.trim()];

  const normalizedIngredients = Array.from(
    new Set(rawIngredients.map((i) => normalizeIngredientName(i)).filter(Boolean))
  );

  const now = new Date().toISOString();
  const meal = {
    id: `meal_${randomUUID().slice(0, 8)}`,
    userId: req.user!.id,
    mealType: mealType as MealType,
    foodName: foodName.trim(),
    ingredients: rawIngredients,
    normalizedIngredients,
    portion: typeof portion === 'string' && portion.trim() ? portion.trim() : '1 serving',
    timestamp: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).toISOString() : now,
    toleranceRating: Math.round(rating),
    toleranceNotes: typeof toleranceNotes === 'string' ? toleranceNotes.trim() : '',
    isCustomFood: Boolean(isCustomFood),
    nutritionSummary: nutritionSummary && typeof nutritionSummary === 'object' ? nutritionSummary : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const db = getDb();
  db.meals.push(meal);
  saveDb();
  res.status(201).json({ meal });
});

apiRouter.put('/meals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const meal = db.meals.find((m) => m.id === req.params.id && m.userId === req.user!.id);
  if (!meal) {
    res.status(404).json({ error: 'Meal entry not found.' });
    return;
  }
  const { mealType, foodName, ingredients, portion, timestamp, toleranceRating, toleranceNotes } =
    req.body || {};

  if (mealType && VALID_MEAL_TYPES.includes(mealType)) meal.mealType = mealType;
  if (typeof foodName === 'string' && foodName.trim()) meal.foodName = foodName.trim();
  if (ingredients !== undefined) {
    const raw = Array.isArray(ingredients)
      ? ingredients.map((i) => String(i).trim()).filter(Boolean)
      : String(ingredients)
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean);
    meal.ingredients = raw;
    meal.normalizedIngredients = Array.from(new Set(raw.map(normalizeIngredientName).filter(Boolean)));
  }
  if (typeof portion === 'string' && portion.trim()) meal.portion = portion.trim();
  if (timestamp && !Number.isNaN(new Date(timestamp).getTime())) {
    meal.timestamp = new Date(timestamp).toISOString();
  }
  if (toleranceRating !== undefined) {
    const r = Number(toleranceRating);
    if (r >= 1 && r <= 5) meal.toleranceRating = Math.round(r);
  }
  if (typeof toleranceNotes === 'string') meal.toleranceNotes = toleranceNotes.trim();
  meal.updatedAt = new Date().toISOString();
  saveDb();
  res.json({ meal });
});

apiRouter.delete('/meals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.meals.findIndex((m) => m.id === req.params.id && m.userId === req.user!.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Meal entry not found.' });
    return;
  }
  db.meals.splice(idx, 1);
  saveDb();
  res.json({ deletedId: req.params.id });
});

// Hydration CRUD
apiRouter.get('/hydration', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const entries = db.hydration
    .filter((h) => h.userId === req.user!.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTotalMl = entries
    .filter((h) => new Date(h.timestamp).toISOString().slice(0, 10) === todayKey)
    .reduce((sum, h) => sum + h.amountMl, 0);

  res.json({
    entries,
    todayTotalMl,
    dailyGoalMl: req.user!.profile.dailyFluidGoalMl,
  });
});

apiRouter.post('/hydration', requireAuth, (req: AuthenticatedRequest, res) => {
  const { fluidType, amountMl, temperature, timestamp, notes } = req.body || {};
  const ml = Number(amountMl);
  if (Number.isNaN(ml) || ml <= 0 || ml > 3000) {
    res.status(400).json({ error: 'amountMl must be between 1 and 3000.' });
    return;
  }
  const now = new Date().toISOString();
  const entry = {
    id: `hyd_${randomUUID().slice(0, 8)}`,
    userId: req.user!.id,
    fluidType: typeof fluidType === 'string' && fluidType.trim() ? fluidType.trim() : 'Water',
    amountMl: Math.round(ml),
    temperature: (['cool', 'room', 'warm'].includes(temperature) ? temperature : 'room') as
      | 'cool'
      | 'room'
      | 'warm',
    timestamp: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).toISOString() : now,
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdAt: now,
  };
  const db = getDb();
  db.hydration.push(entry);
  saveDb();
  res.status(201).json({ entry });
});

apiRouter.delete('/hydration/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.hydration.findIndex((h) => h.id === req.params.id && h.userId === req.user!.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Hydration entry not found.' });
    return;
  }
  db.hydration.splice(idx, 1);
  saveDb();
  res.json({ deletedId: req.params.id });
});

// Symptoms & Appetite
apiRouter.get('/symptoms/catalog', (_req, res) => {
  const db = getDb();
  res.json({ catalog: db.symptomCatalog });
});

apiRouter.get('/symptoms', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const entries = db.symptoms
    .filter((s) => s.userId === req.user!.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ symptoms: entries });
});

apiRouter.post('/symptoms', requireAuth, (req: AuthenticatedRequest, res) => {
  const { symptomId, symptomName, category, severity, appetiteScore, eatingDifficulty, triggerFood, timestamp, notes } =
    req.body || {};

  const db = getDb();
  const catalogMatch = db.symptomCatalog.find((c) => c.id === symptomId);
  const resolvedName = catalogMatch?.name || (typeof symptomName === 'string' ? symptomName.trim() : '');
  const resolvedCategory =
    catalogMatch?.category ||
    (VALID_SYMPTOM_CATS.includes(category) ? (category as SymptomCategory) : 'gastrointestinal');

  if (!resolvedName) {
    res.status(400).json({ error: 'symptomId or symptomName is required.' });
    return;
  }
  const sev = Number(severity);
  if (Number.isNaN(sev) || sev < 1 || sev > 5) {
    res.status(400).json({ error: 'severity must be between 1 and 5.' });
    return;
  }

  let parsedAppetite: number | undefined;
  if (appetiteScore !== undefined && appetiteScore !== null && appetiteScore !== '') {
    const a = Number(appetiteScore);
    if (!Number.isNaN(a) && a >= 1 && a <= 5) parsedAppetite = Math.round(a);
  }

  const now = new Date().toISOString();
  const entry = {
    id: `slog_${randomUUID().slice(0, 8)}`,
    userId: req.user!.id,
    symptomId: catalogMatch?.id || `custom_${randomUUID().slice(0, 4)}`,
    symptomName: resolvedName,
    category: resolvedCategory,
    severity: Math.round(sev),
    appetiteScore: parsedAppetite,
    eatingDifficulty: typeof eatingDifficulty === 'string' ? eatingDifficulty.trim() : undefined,
    triggerFood: typeof triggerFood === 'string' ? triggerFood.trim() : undefined,
    timestamp: timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).toISOString() : now,
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdAt: now,
  };

  db.symptoms.push(entry);
  saveDb();
  res.status(201).json({ symptom: entry });
});

apiRouter.delete('/symptoms/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.symptoms.findIndex((s) => s.id === req.params.id && s.userId === req.user!.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Symptom entry not found.' });
    return;
  }
  db.symptoms.splice(idx, 1);
  saveDb();
  res.json({ deletedId: req.params.id });
});

// Food Sensitivities
apiRouter.get('/sensitivities', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const items = db.sensitivities.filter((s) => s.userId === req.user!.id);
  res.json({ sensitivities: items });
});

apiRouter.post('/sensitivities', requireAuth, (req: AuthenticatedRequest, res) => {
  const { foodName, reactionType, severity, notes } = req.body || {};
  if (!foodName || typeof foodName !== 'string' || !foodName.trim()) {
    res.status(400).json({ error: 'foodName is required.' });
    return;
  }
  const sev = Math.max(1, Math.min(5, Math.round(Number(severity) || 3)));
  const now = new Date().toISOString();
  const record = {
    id: `sens_${randomUUID().slice(0, 8)}`,
    userId: req.user!.id,
    foodName: foodName.trim(),
    normalizedIngredient: normalizeIngredientName(foodName),
    reactionType: typeof reactionType === 'string' && reactionType.trim() ? reactionType.trim() : 'Discomfort',
    severity: sev,
    notes: typeof notes === 'string' ? notes.trim() : '',
    lastReportedAt: now,
    createdAt: now,
  };
  const db = getDb();
  db.sensitivities.push(record);
  saveDb();
  res.status(201).json({ sensitivity: record });
});

apiRouter.delete('/sensitivities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.sensitivities.findIndex((s) => s.id === req.params.id && s.userId === req.user!.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Sensitivity record not found.' });
    return;
  }
  db.sensitivities.splice(idx, 1);
  saveDb();
  res.json({ deletedId: req.params.id });
});

// Analytics Dashboard
apiRouter.get('/analytics/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const range = String(req.query.range || '14d');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 14;
  const start = typeof req.query.start === 'string' ? req.query.start : undefined;
  const end = typeof req.query.end === 'string' ? req.query.end : undefined;

  const analytics = buildDashboardAnalytics(
    db.meals.filter((m) => m.userId === uid),
    db.hydration.filter((h) => h.userId === uid),
    db.symptoms.filter((s) => s.userId === uid),
    db.sensitivities.filter((s) => s.userId === uid),
    req.user!.profile,
    days,
    start,
    end
  );

  res.json({
    ...analytics,
    disclaimer:
      'Tolerance patterns reflect observational correlations across your logged entries and do not establish medical causation.',
  });
});

// Recipes, Search, Filtering, Normalization, Recommendations, Collections
apiRouter.get('/recipes', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const maxPrep = req.query.maxPrep ? Number(req.query.maxPrep) : null;
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
  const ingredient =
    typeof req.query.ingredient === 'string' ? req.query.ingredient.trim().toLowerCase() : '';

  let list = db.recipes.filter((r) => !r.isCustom || r.createdByUserId === req.user!.id);
  if (q) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some(
          (i) => i.raw.toLowerCase().includes(q) || i.normalized.toLowerCase().includes(q)
        ) ||
        r.dietaryTags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (maxPrep && !Number.isNaN(maxPrep)) {
    list = list.filter((r) => r.prepTimeMinutes <= maxPrep);
  }
  if (tag) {
    list = list.filter((r) => r.dietaryTags.some((t) => t.toLowerCase().includes(tag)));
  }
  if (ingredient) {
    const normQuery = normalizeIngredientName(ingredient);
    list = list.filter((r) =>
      r.ingredients.some((i) => i.normalized.includes(normQuery) || i.raw.toLowerCase().includes(ingredient))
    );
  }

  const savedIds = new Set(
    db.savedRecipes.filter((s) => s.userId === req.user!.id).map((s) => s.recipeId)
  );

  res.json({
    recipes: list.map((r) => ({ ...r, isSaved: savedIds.has(r.id) })),
  });
});

apiRouter.get('/recipes/recommendations', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const uid = req.user!.id;
  const visibleRecipes = db.recipes.filter((r) => !r.isCustom || r.createdByUserId === uid);
  const recs = recommendRecipesForUser(
    visibleRecipes,
    req.user!.profile,
    db.meals.filter((m) => m.userId === uid),
    db.sensitivities.filter((s) => s.userId === uid),
    db.symptoms.filter((s) => s.userId === uid).slice(-10)
  );
  res.json({ recommendations: recs });
});

apiRouter.get('/recipes/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const recipe = db.recipes.find((r) => r.id === req.params.id);
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }
  const isSaved = db.savedRecipes.some(
    (s) => s.userId === req.user!.id && s.recipeId === recipe.id
  );
  res.json({ recipe: { ...recipe, isSaved } });
});

apiRouter.post('/recipes', requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, category, prepTimeMinutes, servings, ingredients, instructions, dietaryTags } =
    req.body || {};

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    res.status(400).json({ error: 'Recipe title must be at least 3 characters.' });
    return;
  }
  const rawIngs: string[] = Array.isArray(ingredients)
    ? ingredients.map(String).filter((s) => s.trim())
    : typeof ingredients === 'string'
      ? ingredients
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (rawIngs.length === 0) {
    res.status(400).json({ error: 'At least one ingredient is required.' });
    return;
  }

  const parsedIngredients = rawIngs.map(parseAndCleanIngredient);
  const steps: string[] = Array.isArray(instructions)
    ? instructions.map(String).filter((s) => s.trim())
    : typeof instructions === 'string'
      ? instructions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : ['Prepare ingredients cleanly and cook thoroughly to safe internal temperatures.'];

  const { safetyWarnings, allergens } = detectSafetyAndAllergenWarnings(parsedIngredients, steps);

  const recipe = {
    id: `rec_${randomUUID().slice(0, 8)}`,
    title: title.trim(),
    category: (['Breakfast', 'Soup & Broth', 'Main Dish', 'Smoothie & Snack'].includes(category)
      ? category
      : 'Main Dish') as 'Breakfast' | 'Soup & Broth' | 'Main Dish' | 'Smoothie & Snack',
    prepTimeMinutes: Math.max(5, Math.round(Number(prepTimeMinutes) || 20)),
    servings: Math.max(1, Math.round(Number(servings) || 2)),
    imageUrl: '/src/assets/images/recipe_ginger_broth_1794746822717.jpg',
    ingredients: parsedIngredients,
    instructions: steps,
    dietaryTags: Array.isArray(dietaryTags)
      ? dietaryTags.map(String).filter(Boolean)
      : ['Custom Recipe'],
    safetyWarnings,
    allergens,
    sourceName: `Personal Kitchen Library (${req.user!.name})`,
    sourceUrl: '',
    sourceVerified: false,
    nutritionPerServing: {
      source: 'Patient-submitted custom recipe',
    },
    isCustom: true,
    createdByUserId: req.user!.id,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.recipes.unshift(recipe);
  saveDb();
  res.status(201).json({ recipe });
});

apiRouter.post('/recipes/:id/save', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const recipe = db.recipes.find((r) => r.id === req.params.id);
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }
  const existing = db.savedRecipes.find(
    (s) => s.userId === req.user!.id && s.recipeId === recipe.id
  );
  if (!existing) {
    db.savedRecipes.push({
      id: `sav_${randomUUID().slice(0, 8)}`,
      userId: req.user!.id,
      recipeId: recipe.id,
      savedAt: new Date().toISOString(),
    });
    saveDb();
  }
  res.json({ saved: true, recipeId: recipe.id });
});

apiRouter.delete('/recipes/:id/save', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.savedRecipes.findIndex(
    (s) => s.userId === req.user!.id && s.recipeId === req.params.id
  );
  if (idx !== -1) {
    db.savedRecipes.splice(idx, 1);
    saveDb();
  }
  res.json({ saved: false, recipeId: req.params.id });
});

apiRouter.get('/collections', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const collections = db.collections.filter((c) => c.userId === req.user!.id);
  res.json({ collections });
});

apiRouter.post('/collections', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, description, recipeId } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Collection name is required.' });
    return;
  }
  const db = getDb();
  const col = {
    id: `col_${randomUUID().slice(0, 8)}`,
    userId: req.user!.id,
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    recipeIds: typeof recipeId === 'string' && recipeId ? [recipeId] : [],
    createdAt: new Date().toISOString(),
  };
  db.collections.push(col);
  saveDb();
  res.status(201).json({ collection: col });
});

apiRouter.post('/collections/:id/recipes', requireAuth, (req: AuthenticatedRequest, res) => {
  const { recipeId } = req.body || {};
  const db = getDb();
  const col = db.collections.find((c) => c.id === req.params.id && c.userId === req.user!.id);
  if (!col) {
    res.status(404).json({ error: 'Collection not found.' });
    return;
  }
  if (typeof recipeId === 'string' && !col.recipeIds.includes(recipeId)) {
    col.recipeIds.push(recipeId);
    saveDb();
  }
  res.json({ collection: col });
});

// USDA FoodData Central Nutrition Lookup (with live USDA FDC optional pass-through + verified Foundation fallback)
apiRouter.get('/nutrition/lookup', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const db = getDb();

  if (!q) {
    res.json({ foods: db.usdaFoods, source: 'USDA FoodData Central Verified Cache' });
    return;
  }

  const fdcKey = process.env.USDA_FDC_API_KEY;
  if (fdcKey) {
    try {
      const apiResp = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
          fdcKey
        )}&query=${encodeURIComponent(q)}&pageSize=8`
      );
      if (apiResp.ok) {
        const json = (await apiResp.json()) as {
          foods?: Array<{
            fdcId: number;
            description: string;
            foodCategory?: string;
            foodNutrients?: Array<{ nutrientName: string; value: number }>;
          }>;
        };
        if (Array.isArray(json.foods) && json.foods.length > 0) {
          const mapped = json.foods.map((item) => {
            const findN = (pattern: RegExp) =>
              item.foodNutrients?.find((n) => pattern.test(n.nutrientName))?.value || 0;
            return {
              fdcId: item.fdcId,
              description: item.description,
              category: item.foodCategory || 'USDA FoodData Central',
              servingSizeLabel: '100g',
              nutrientsPer100g: {
                proteinG: Number(findN(/^Protein$/i).toFixed(1)),
                fiberG: Number(findN(/Fiber, total dietary/i).toFixed(1)),
                potassiumMg: Math.round(findN(/Potassium/i)),
                sodiumMg: Math.round(findN(/Sodium/i)),
                ironMg: Number(findN(/^Iron/i).toFixed(2)),
                vitaminCMg: Number(findN(/Vitamin C/i).toFixed(1)),
                calciumMg: Math.round(findN(/Calcium/i)),
                energyKcal: Math.round(findN(/^Energy$/i)),
              },
            };
          });
          res.json({ foods: mapped, source: 'USDA FoodData Central Live API' });
          return;
        }
      }
    } catch {
      // Fallback to local verified USDA dataset below
    }
  }

  const qLower = q.toLowerCase();
  const normQ = normalizeIngredientName(q);
  const matches = db.usdaFoods.filter(
    (f) =>
      f.description.toLowerCase().includes(qLower) ||
      f.description.toLowerCase().includes(normQ) ||
      f.category.toLowerCase().includes(qLower)
  );
  res.json({ foods: matches, source: 'USDA FoodData Central Verified Reference' });
});

// Food Safety Resources & Clinical Disclaimers
apiRouter.get('/safety-resources', (_req, res) => {
  const db = getDb();
  res.json({
    guides: db.foodSafetyGuides,
    healthcareResources: db.healthcareResources,
    disclaimer:
      'General nutrition, recipe, and food safety information provided in OncoByte is for educational tracking only and does not replace individualized advice from your oncologist or Registered Dietitian Nutritionist (RDN).',
  });
});

// Reports & PDF Export
apiRouter.get('/reports', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const list = db.reports
    .filter((r) => r.userId === req.user!.id)
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  res.json({ reports: list });
});

apiRouter.post('/reports/generate', requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, dateRangeStart, dateRangeEnd, includedCategories } = req.body || {};
  const end = dateRangeEnd ? new Date(dateRangeEnd) : new Date();
  const start = dateRangeStart
    ? new Date(dateRangeStart)
    : new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ error: 'Valid dateRangeStart and dateRangeEnd are required.' });
    return;
  }

  const allowedCats: ReportCategory[] = [
    'meals',
    'hydration',
    'symptoms',
    'appetite',
    'tolerances',
    'sensitivities',
  ];
  const cats: ReportCategory[] = Array.isArray(includedCategories)
    ? includedCategories.filter((c): c is ReportCategory => allowedCats.includes(c))
    : allowedCats;

  const db = getDb();
  const uid = req.user!.id;
  const report = buildValidatedReport(
    `rep_${randomUUID().slice(0, 8)}`,
    uid,
    typeof title === 'string' && title.trim()
      ? title.trim()
      : `Oncology Nutrition Summary (${start.toISOString().slice(0, 10)} – ${end
          .toISOString()
          .slice(0, 10)})`,
    start.toISOString(),
    end.toISOString(),
    cats.length > 0 ? cats : allowedCats,
    db.meals.filter((m) => m.userId === uid),
    db.hydration.filter((h) => h.userId === uid),
    db.symptoms.filter((s) => s.userId === uid),
    db.sensitivities.filter((s) => s.userId === uid),
    req.user!.profile
  );

  db.reports.unshift(report);
  saveDb();
  res.status(201).json({ report });
});

apiRouter.get('/reports/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const report = db.reports.find((r) => r.id === req.params.id && r.userId === req.user!.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }
  res.json({ report });
});

apiRouter.get('/reports/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const report = db.reports.find((r) => r.id === req.params.id && r.userId === req.user!.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const uid = req.user!.id;
  try {
    const pdfBuffer = await generateClinicalReportPdf(
      report,
      req.user!,
      db.meals.filter((m) => m.userId === uid),
      db.hydration.filter((h) => h.userId === uid),
      db.symptoms.filter((s) => s.userId === uid),
      db.sensitivities.filter((s) => s.userId === uid)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="OncoByte-Report-${report.id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to render PDF document.', detail: String(err) });
  }
});

// Caregiver Access Control
apiRouter.get('/caregivers', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const grants = db.caregiverGrants.filter((g) => g.patientUserId === req.user!.id);
  res.json({ caregivers: grants });
});

apiRouter.post('/caregivers', requireAuth, (req: AuthenticatedRequest, res) => {
  const { caregiverName, caregiverEmail, relationship, permissions } = req.body || {};
  if (!caregiverName || !caregiverEmail || !String(caregiverEmail).includes('@')) {
    res.status(400).json({ error: 'Valid caregiverName and caregiverEmail are required.' });
    return;
  }
  const allowedPerms = ['read_journal', 'log_entries', 'export_reports'] as const;
  const cleanPerms = Array.isArray(permissions)
    ? permissions.filter((p) => (allowedPerms as readonly string[]).includes(p))
    : ['read_journal'];

  const grant = {
    id: `cg_${randomUUID().slice(0, 8)}`,
    patientUserId: req.user!.id,
    caregiverName: String(caregiverName).trim(),
    caregiverEmail: String(caregiverEmail).trim().toLowerCase(),
    relationship: typeof relationship === 'string' && relationship.trim() ? relationship.trim() : 'Caregiver',
    permissions: (cleanPerms.length > 0 ? cleanPerms : ['read_journal']) as Array<
      'read_journal' | 'log_entries' | 'export_reports'
    >,
    active: true,
    grantedAt: new Date().toISOString(),
  };

  const db = getDb();
  db.caregiverGrants.push(grant);
  saveDb();
  res.status(201).json({ caregiver: grant });
});

apiRouter.patch('/caregivers/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const grant = db.caregiverGrants.find(
    (g) => g.id === req.params.id && g.patientUserId === req.user!.id
  );
  if (!grant) {
    res.status(404).json({ error: 'Caregiver authorization not found.' });
    return;
  }
  if (typeof req.body?.active === 'boolean') grant.active = req.body.active;
  if (Array.isArray(req.body?.permissions)) grant.permissions = req.body.permissions;
  saveDb();
  res.json({ caregiver: grant });
});

apiRouter.delete('/caregivers/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const idx = db.caregiverGrants.findIndex(
    (g) => g.id === req.params.id && g.patientUserId === req.user!.id
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Caregiver authorization not found.' });
    return;
  }
  db.caregiverGrants.splice(idx, 1);
  saveDb();
  res.json({ deletedId: req.params.id });
});

// Structured Backend API Documentation for iOS & Web Clients
apiRouter.get('/docs/endpoints', (_req, res) => {
  res.json({
    service: 'OncoByte Independent REST API',
    baseUrl: '/api',
    authScheme: 'Bearer <HMAC-SHA256 Session Token>',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', auth: false, summary: 'Authenticate patient/caregiver and issue session token', sampleBody: { email: 'elena.vance@oncobyte.org', password: '***' } },
      { method: 'POST', path: '/api/auth/register', auth: false, summary: 'Register independent OncoByte user account' },
      { method: 'GET', path: '/api/profile', auth: true, summary: 'Retrieve dietary restrictions, allergies, fluid goal, and logging preferences' },
      { method: 'PUT', path: '/api/profile', auth: true, summary: 'Update profile preferences, reminder schedule, and fluid targets' },
      { method: 'GET', path: '/api/meals', auth: true, summary: 'List chronological meal logs with optional date range & mealType filter' },
      { method: 'POST', path: '/api/meals', auth: true, summary: 'Create meal entry with automatic ingredient normalization & tolerance rating' },
      { method: 'PUT', path: '/api/meals/:id', auth: true, summary: 'Edit existing meal entry, portion, or tolerance score' },
      { method: 'DELETE', path: '/api/meals/:id', auth: true, summary: 'Delete meal entry' },
      { method: 'GET', path: '/api/hydration', auth: true, summary: 'Retrieve fluid intake records and daily target progress' },
      { method: 'POST', path: '/api/hydration', auth: true, summary: 'Log fluid intake (ml, fluid type, temperature preference)' },
      { method: 'GET', path: '/api/symptoms/catalog', auth: false, summary: 'Structured catalog of oncology nutrition symptoms' },
      { method: 'POST', path: '/api/symptoms', auth: true, summary: 'Log symptom severity, appetite score (1-5), and eating difficulty notes' },
      { method: 'GET', path: '/api/analytics/dashboard?range=14d', auth: true, summary: 'Aggregated timelines, appetite trends, and non-causal tolerance patterns' },
      { method: 'GET', path: '/api/recipes/recommendations', auth: true, summary: 'Tolerance-matched recipes with explicit ingredient explanations' },
      { method: 'POST', path: '/api/recipes', auth: true, summary: 'Submit custom recipe with automatic ingredient normalization & safety scan' },
      { method: 'GET', path: '/api/nutrition/lookup?q=salmon', auth: false, summary: 'USDA FoodData Central nutrition lookup per 100g' },
      { method: 'GET', path: '/api/safety-resources', auth: false, summary: 'Oncology food safety guides, disclaimers, and RD/NCI/ACS links' },
      { method: 'POST', path: '/api/reports/generate', auth: true, summary: 'Aggregate validated clinical report with SHA-256 checksum' },
      { method: 'GET', path: '/api/reports/:id/pdf', auth: true, summary: 'Stream formatted binary application/pdf clinician report' },
      { method: 'GET', path: '/api/caregivers', auth: true, summary: 'Manage explicit patient-authorized caregiver access grants' },
    ],
  });
});
