import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.ts';
import { parseAndCleanIngredient } from './analytics.ts';
import type { DatabaseSchema } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'oncobyte-db.json');

function daysAgoIso(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function createInitialSeed(): DatabaseSchema {
  const patientId = 'usr_elena_vance';
  const passwordHash = hashPassword('OncoCare2026!');

  const recipes = [
    {
      id: 'rec_ginger_miso_broth',
      title: 'Warm Ginger Miso & Silken Tofu Broth',
      category: 'Soup & Broth' as const,
      prepTimeMinutes: 15,
      servings: 2,
      imageUrl: '/src/assets/images/recipe_ginger_broth_1794746822717.jpg',
      ingredients: [
        '3 cups low-sodium vegetable broth',
        '1 tbsp fresh grated ginger',
        '2 tbsp white miso paste',
        '150 g silken tofu, cubed',
        '1 medium carrot, thinly sliced',
        '1 cup steamed white rice',
      ].map(parseAndCleanIngredient),
      instructions: [
        'Simmer low-sodium vegetable broth with sliced carrots and grated ginger for 8 minutes until carrots are very soft.',
        'Remove from direct boil, whisk white miso paste in a small ladle of warm broth, and stir back into the pot.',
        'Gently fold in silken tofu cubes and warm for 2 minutes without boiling. Serve over soft steamed white rice.',
      ],
      dietaryTags: ['Soft Texture', 'Bland / Low-Nausea', 'Dairy-Free', 'Warm & Soothing'],
      safetyWarnings: [
        'Use pasteurized miso paste and ensure tofu is heated thoroughly to at least 165°F (74°C) if following neutropenic guidelines.',
      ],
      allergens: ['Soy'],
      sourceName: 'National Cancer Institute — Eating Hints Recipe Adaptation',
      sourceUrl: 'https://www.cancer.gov/publications/patient-education/eatinghints',
      sourceVerified: true,
      nutritionPerServing: {
        proteinG: 11,
        fiberG: 2.5,
        potassiumMg: 340,
        sodiumMg: 480,
        ironMg: 1.8,
        vitaminCMg: 4,
        energyKcal: 215,
        source: 'USDA FoodData Central composite calculation',
      },
      isCustom: false,
      createdAt: daysAgoIso(20, 9, 0),
    },
    {
      id: 'rec_poached_pear_oat_porridge',
      title: 'Creamy Oat & Poached Pear Almond Porridge',
      category: 'Breakfast' as const,
      prepTimeMinutes: 12,
      servings: 1,
      imageUrl: '/src/assets/images/recipe_oat_porridge_1794746823540.jpg',
      ingredients: [
        '1/2 cup rolled oats',
        '1 cup unsweetened almond milk',
        '1 medium poached pear, peeled and sliced',
        '1 tbsp smooth almond butter',
        '1/4 tsp ground cinnamon',
      ].map(parseAndCleanIngredient),
      instructions: [
        'Combine rolled oats and unsweetened almond milk in a small saucepan over gentle medium-low heat.',
        'Simmer for 6–8 minutes, stirring occasionally, until creamy and very soft.',
        'Top with peeled poached pear slices, smooth almond butter swirl, and a pinch of cinnamon.',
      ],
      dietaryTags: ['Soft Texture', 'Dairy-Free', 'Low-Acid', 'Gentle Fiber'],
      safetyWarnings: [
        'Peel pears thoroughly and ensure poached fruit is cooked until fork-tender for swallowing comfort.',
      ],
      allergens: ['Tree Nuts / Peanuts'],
      sourceName: 'Oncology Nutrition DPG — Gentle Breakfast Guide',
      sourceUrl: 'https://www.oncologynutrition.org/erfc/eating-well-during-treatment',
      sourceVerified: true,
      nutritionPerServing: {
        proteinG: 9.5,
        fiberG: 7.2,
        potassiumMg: 390,
        sodiumMg: 165,
        ironMg: 2.4,
        vitaminCMg: 5,
        energyKcal: 340,
        source: 'USDA FoodData Central composite calculation',
      },
      isCustom: false,
      createdAt: daysAgoIso(18, 8, 30),
    },
    {
      id: 'rec_herb_salmon_sweet_potato',
      title: 'Tender Baked Herb Salmon & Mashed Sweet Potato',
      category: 'Main Dish' as const,
      prepTimeMinutes: 25,
      servings: 2,
      imageUrl: '/src/assets/images/recipe_salmon_quinoa_1794746829385.jpg',
      ingredients: [
        '2 fillets wild salmon (140g each)',
        '1 large sweet potato, peeled and cubed',
        '1 medium zucchini, ribboned and steamed',
        '1 tbsp extra virgin olive oil',
        '1 tsp chopped fresh dill',
      ].map(parseAndCleanIngredient),
      instructions: [
        'Bake seasoned wild salmon at 375°F (190°C) for 14–16 minutes until internal temperature reaches 145°F (63°C) and flesh flakes effortlessly.',
        'Boil peeled sweet potato cubes until tender and mash with olive oil and a splash of warm water or broth.',
        'Steam zucchini ribbons until completely soft and plate beside the salmon and sweet potato.',
      ],
      dietaryTags: ['High Protein', 'Soft Texture', 'Dairy-Free', 'Gluten-Free'],
      safetyWarnings: [
        'Cook salmon thoroughly to an internal temperature of 145°F (63°C); avoid raw or cold-smoked fish during active treatment.',
      ],
      allergens: ['Fish'],
      sourceName: 'American Cancer Society — Protein Recovery Kitchen',
      sourceUrl: 'https://www.cancer.org/cancer/survivorship/coping/nutrition.html',
      sourceVerified: true,
      nutritionPerServing: {
        proteinG: 29,
        fiberG: 4.8,
        potassiumMg: 860,
        sodiumMg: 110,
        ironMg: 1.6,
        vitaminCMg: 24,
        energyKcal: 410,
        source: 'USDA FoodData Central composite calculation',
      },
      isCustom: false,
      createdAt: daysAgoIso(16, 12, 0),
    },
    {
      id: 'rec_blueberry_yogurt_smoothie',
      title: 'Silky Blueberry Banana Greek Yogurt Smoothie',
      category: 'Smoothie & Snack' as const,
      prepTimeMinutes: 5,
      servings: 1,
      imageUrl: '/src/assets/images/recipe_berry_smoothie_1794746822742.jpg',
      ingredients: [
        '3/4 cup plain Greek yogurt',
        '1/2 cup frozen blueberries',
        '1/2 ripe banana',
        '1/2 cup unsweetened almond milk',
      ].map(parseAndCleanIngredient),
      instructions: [
        'Wash any fresh fruit under running water; combine pasteurized Greek yogurt, frozen blueberries, ripe banana, and almond milk in a clean blender.',
        'Blend on high for 45 seconds until completely velvety with no berry skin fragments if mouth soreness is present.',
        'Serve chilled or let rest 5 minutes to temper coldness if experiencing cold sensitivity.',
      ],
      dietaryTags: ['High Protein', 'Soft Texture', 'No-Cook Quick', 'Cool & Soothing'],
      safetyWarnings: [
        'If experiencing oxaliplatin-related cold sensitivity, allow smoothie to warm slightly toward room temperature before sipping.',
        'Use commercially pasteurized yogurt only.',
      ],
      allergens: ['Dairy', 'Tree Nuts / Peanuts'],
      sourceName: 'Cook for Your Life — Fred Hutch Cancer Center',
      sourceUrl: 'https://www.cookforyourlife.org/',
      sourceVerified: true,
      nutritionPerServing: {
        proteinG: 18,
        fiberG: 4.1,
        potassiumMg: 490,
        sodiumMg: 130,
        ironMg: 0.7,
        vitaminCMg: 14,
        energyKcal: 265,
        source: 'USDA FoodData Central composite calculation',
      },
      isCustom: false,
      createdAt: daysAgoIso(15, 10, 0),
    },
  ];

  const meals = [
    {
      id: 'meal_1',
      userId: patientId,
      mealType: 'breakfast' as const,
      foodName: 'Creamy Oat & Poached Pear Porridge',
      ingredients: ['rolled oats', 'almond milk', 'poached pear', 'almond butter'],
      normalizedIngredients: ['oats', 'almond milk', 'pear', 'almond butter'],
      portion: '1 small bowl (220g)',
      timestamp: daysAgoIso(6, 8, 45),
      toleranceRating: 5,
      toleranceNotes: 'Warm temperature and smooth texture felt very soothing.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 9.5, fiberG: 7.2, energyKcal: 340, source: 'USDA FDC' },
      createdAt: daysAgoIso(6, 8, 50),
      updatedAt: daysAgoIso(6, 8, 50),
    },
    {
      id: 'meal_2',
      userId: patientId,
      mealType: 'lunch' as const,
      foodName: 'Warm Ginger Miso & Silken Tofu Broth',
      ingredients: ['vegetable broth', 'fresh ginger', 'white miso paste', 'silken tofu', 'white rice'],
      normalizedIngredients: ['vegetable broth', 'ginger', 'miso', 'tofu', 'white rice'],
      portion: '1.5 cups',
      timestamp: daysAgoIso(5, 12, 30),
      toleranceRating: 5,
      toleranceNotes: 'Ginger settled mild morning queasiness cleanly.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 11, fiberG: 2.5, energyKcal: 215, source: 'USDA FDC' },
      createdAt: daysAgoIso(5, 12, 40),
      updatedAt: daysAgoIso(5, 12, 40),
    },
    {
      id: 'meal_3',
      userId: patientId,
      mealType: 'dinner' as const,
      foodName: 'Tomato Basil Soup with Grilled Cheese',
      ingredients: ['tomato soup', 'cheddar cheese', 'sourdough bread'],
      normalizedIngredients: ['tomato', 'cheddar cheese', 'bread'],
      portion: '1 cup soup, 1/2 sandwich',
      timestamp: daysAgoIso(4, 18, 20),
      toleranceRating: 2,
      toleranceNotes: 'Acidity from tomato caused mild reflux and mouth tingling.',
      isCustomFood: true,
      nutritionSummary: { proteinG: 12, fiberG: 2.1, energyKcal: 290, source: 'Manual Entry' },
      createdAt: daysAgoIso(4, 19, 0),
      updatedAt: daysAgoIso(4, 19, 0),
    },
    {
      id: 'meal_4',
      userId: patientId,
      mealType: 'dinner' as const,
      foodName: 'Baked Herb Salmon & Mashed Sweet Potato',
      ingredients: ['wild salmon', 'sweet potato', 'zucchini', 'olive oil'],
      normalizedIngredients: ['salmon', 'sweet potato', 'zucchini', 'olive oil'],
      portion: '1 fillet (130g) + 1/2 cup mash',
      timestamp: daysAgoIso(3, 18, 15),
      toleranceRating: 4,
      toleranceNotes: 'Easy to swallow; mild metallic aftertaste subsided with lemon water.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 29, fiberG: 4.8, energyKcal: 410, source: 'USDA FDC' },
      createdAt: daysAgoIso(3, 18, 30),
      updatedAt: daysAgoIso(3, 18, 30),
    },
    {
      id: 'meal_5',
      userId: patientId,
      mealType: 'snack' as const,
      foodName: 'Blueberry Banana Greek Yogurt Smoothie',
      ingredients: ['greek yogurt', 'frozen blueberries', 'banana', 'almond milk'],
      normalizedIngredients: ['yogurt', 'blueberries', 'banana', 'almond milk'],
      portion: '250 ml glass',
      timestamp: daysAgoIso(2, 15, 10),
      toleranceRating: 5,
      toleranceNotes: 'Let warm 10 min out of blender; great protein boost.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 18, fiberG: 4.1, energyKcal: 265, source: 'USDA FDC' },
      createdAt: daysAgoIso(2, 15, 15),
      updatedAt: daysAgoIso(2, 15, 15),
    },
    {
      id: 'meal_6',
      userId: patientId,
      mealType: 'breakfast' as const,
      foodName: 'Scrambled Eggs with Soft Avocado Toast',
      ingredients: ['eggs', 'avocado', 'white toast'],
      normalizedIngredients: ['eggs', 'avocado', 'bread'],
      portion: '2 soft-scrambled eggs, 1 slice',
      timestamp: daysAgoIso(1, 9, 0),
      toleranceRating: 4,
      toleranceNotes: 'Ate slowly over 20 minutes; tolerated well.',
      isCustomFood: true,
      nutritionSummary: { proteinG: 16, fiberG: 4.0, energyKcal: 320, source: 'USDA FDC' },
      createdAt: daysAgoIso(1, 9, 15),
      updatedAt: daysAgoIso(1, 9, 15),
    },
    {
      id: 'meal_7',
      userId: patientId,
      mealType: 'breakfast' as const,
      foodName: 'Creamy Oat & Poached Pear Porridge',
      ingredients: ['rolled oats', 'almond milk', 'poached pear', 'almond butter'],
      normalizedIngredients: ['oats', 'almond milk', 'pear', 'almond butter'],
      portion: '1 bowl (240g)',
      timestamp: daysAgoIso(0, 8, 25),
      toleranceRating: 5,
      toleranceNotes: 'Consistent go-to breakfast; zero discomfort.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 9.5, fiberG: 7.2, energyKcal: 340, source: 'USDA FDC' },
      createdAt: daysAgoIso(0, 8, 35),
      updatedAt: daysAgoIso(0, 8, 35),
    },
    {
      id: 'meal_8',
      userId: patientId,
      mealType: 'lunch' as const,
      foodName: 'Warm Ginger Miso & Silken Tofu Broth',
      ingredients: ['vegetable broth', 'fresh ginger', 'white miso paste', 'silken tofu', 'white rice'],
      normalizedIngredients: ['vegetable broth', 'ginger', 'miso', 'tofu', 'white rice'],
      portion: '1.5 cups',
      timestamp: daysAgoIso(0, 12, 40),
      toleranceRating: 5,
      toleranceNotes: 'Comforting and hydrating.',
      isCustomFood: false,
      nutritionSummary: { proteinG: 11, fiberG: 2.5, energyKcal: 215, source: 'USDA FDC' },
      createdAt: daysAgoIso(0, 12, 50),
      updatedAt: daysAgoIso(0, 12, 50),
    },
  ];

  const hydration = [
    { id: 'hyd_1', userId: patientId, fluidType: 'Warm Ginger Tea', amountMl: 250, temperature: 'warm' as const, timestamp: daysAgoIso(6, 9, 30), notes: 'Sipped slowly', createdAt: daysAgoIso(6, 9, 30) },
    { id: 'hyd_2', userId: patientId, fluidType: 'Filtered Water', amountMl: 500, temperature: 'room' as const, timestamp: daysAgoIso(6, 14, 0), notes: '', createdAt: daysAgoIso(6, 14, 0) },
    { id: 'hyd_3', userId: patientId, fluidType: 'Electrolyte Solution', amountMl: 350, temperature: 'room' as const, timestamp: daysAgoIso(5, 11, 0), notes: '', createdAt: daysAgoIso(5, 11, 0) },
    { id: 'hyd_4', userId: patientId, fluidType: 'Filtered Water', amountMl: 500, temperature: 'room' as const, timestamp: daysAgoIso(5, 16, 20), notes: '', createdAt: daysAgoIso(5, 16, 20) },
    { id: 'hyd_5', userId: patientId, fluidType: 'Chamomile Tea', amountMl: 300, temperature: 'warm' as const, timestamp: daysAgoIso(4, 10, 15), notes: '', createdAt: daysAgoIso(4, 10, 15) },
    { id: 'hyd_6', userId: patientId, fluidType: 'Filtered Water', amountMl: 600, temperature: 'room' as const, timestamp: daysAgoIso(4, 15, 0), notes: '', createdAt: daysAgoIso(4, 15, 0) },
    { id: 'hyd_7', userId: patientId, fluidType: 'Vegetable Broth', amountMl: 250, temperature: 'warm' as const, timestamp: daysAgoIso(3, 11, 45), notes: '', createdAt: daysAgoIso(3, 11, 45) },
    { id: 'hyd_8', userId: patientId, fluidType: 'Filtered Water', amountMl: 750, temperature: 'room' as const, timestamp: daysAgoIso(3, 16, 30), notes: '', createdAt: daysAgoIso(3, 16, 30) },
    { id: 'hyd_9', userId: patientId, fluidType: 'Filtered Water', amountMl: 500, temperature: 'room' as const, timestamp: daysAgoIso(2, 10, 0), notes: '', createdAt: daysAgoIso(2, 10, 0) },
    { id: 'hyd_10', userId: patientId, fluidType: 'Electrolyte Solution', amountMl: 450, temperature: 'room' as const, timestamp: daysAgoIso(2, 17, 0), notes: '', createdAt: daysAgoIso(2, 17, 0) },
    { id: 'hyd_11', userId: patientId, fluidType: 'Warm Ginger Tea', amountMl: 300, temperature: 'warm' as const, timestamp: daysAgoIso(1, 9, 45), notes: '', createdAt: daysAgoIso(1, 9, 45) },
    { id: 'hyd_12', userId: patientId, fluidType: 'Filtered Water', amountMl: 850, temperature: 'room' as const, timestamp: daysAgoIso(1, 15, 30), notes: '', createdAt: daysAgoIso(1, 15, 30) },
    { id: 'hyd_13', userId: patientId, fluidType: 'Warm Ginger Tea', amountMl: 250, temperature: 'warm' as const, timestamp: daysAgoIso(0, 8, 0), notes: 'Morning hydration', createdAt: daysAgoIso(0, 8, 0) },
    { id: 'hyd_14', userId: patientId, fluidType: 'Filtered Water', amountMl: 500, temperature: 'room' as const, timestamp: daysAgoIso(0, 11, 15), notes: 'With glass bottle', createdAt: daysAgoIso(0, 11, 15) },
    { id: 'hyd_15', userId: patientId, fluidType: 'Electrolyte Solution', amountMl: 350, temperature: 'room' as const, timestamp: daysAgoIso(0, 14, 10), notes: 'Afternoon sip', createdAt: daysAgoIso(0, 14, 10) },
  ];

  const symptomCatalog = [
    { id: 'sym_nausea', name: 'Nausea', category: 'gastrointestinal' as const, description: 'Queasiness or stomach upset before or after eating', quickEntry: true },
    { id: 'sym_fatigue', name: 'Fatigue', category: 'energy' as const, description: 'Low physical energy affecting meal prep or eating stamina', quickEntry: true },
    { id: 'sym_taste', name: 'Taste Changes', category: 'sensory' as const, description: 'Metallic taste, dulled flavors, or heightened bitterness', quickEntry: true },
    { id: 'sym_appetite_loss', name: 'Appetite Loss', category: 'appetite' as const, description: 'Reduced interest in food or early fullness', quickEntry: true },
    { id: 'sym_swallowing', name: 'Difficulty Swallowing', category: 'swallowing' as const, description: 'Dry throat, soreness, or discomfort when swallowing solids', quickEntry: true },
    { id: 'sym_reflux', name: 'Acid Reflux / Heartburn', category: 'gastrointestinal' as const, description: 'Upper chest warmth or sour sensation post-meal', quickEntry: false },
    { id: 'sym_dry_mouth', name: 'Dry Mouth', category: 'sensory' as const, description: 'Reduced saliva making dry foods difficult to chew', quickEntry: false },
  ];

  const symptoms = [
    { id: 'slog_1', userId: patientId, symptomId: 'sym_nausea', symptomName: 'Nausea', category: 'gastrointestinal' as const, severity: 3, appetiteScore: 2, timestamp: daysAgoIso(5, 10, 15), notes: 'Mild morning queasiness before ginger broth', createdAt: daysAgoIso(5, 10, 15) },
    { id: 'slog_2', userId: patientId, symptomId: 'sym_reflux', symptomName: 'Acid Reflux / Heartburn', category: 'gastrointestinal' as const, severity: 4, appetiteScore: 2, triggerFood: 'tomato', timestamp: daysAgoIso(4, 19, 15), notes: 'Occurred 40 minutes after tomato soup', createdAt: daysAgoIso(4, 19, 15) },
    { id: 'slog_3', userId: patientId, symptomId: 'sym_taste', symptomName: 'Taste Changes', category: 'sensory' as const, severity: 2, appetiteScore: 3, timestamp: daysAgoIso(3, 18, 45), notes: 'Slight metallic taste on initial bites', createdAt: daysAgoIso(3, 18, 45) },
    { id: 'slog_4', userId: patientId, symptomId: 'sym_fatigue', symptomName: 'Fatigue', category: 'energy' as const, severity: 3, appetiteScore: 3, timestamp: daysAgoIso(2, 13, 30), notes: 'Needed shorter prep meal for afternoon snack', createdAt: daysAgoIso(2, 13, 30) },
    { id: 'slog_5', userId: patientId, symptomId: 'sym_appetite_loss', symptomName: 'Appetite Loss', category: 'appetite' as const, severity: 2, appetiteScore: 4, timestamp: daysAgoIso(1, 12, 15), notes: 'Appetite improved steadily by midday', createdAt: daysAgoIso(1, 12, 15) },
    { id: 'slog_6', userId: patientId, symptomId: 'sym_fatigue', symptomName: 'Fatigue', category: 'energy' as const, severity: 2, appetiteScore: 4, timestamp: daysAgoIso(0, 13, 30), notes: 'Mild afternoon tiredness, hydrated well', createdAt: daysAgoIso(0, 13, 30) },
  ];

  const sensitivities = [
    {
      id: 'sens_1',
      userId: patientId,
      foodName: 'Acidic Tomato Sauces',
      normalizedIngredient: 'tomato',
      reactionType: 'Heartburn & oral sensitivity',
      severity: 4,
      notes: 'Better tolerated when substituted with sweet potato or broth bases.',
      lastReportedAt: daysAgoIso(4, 19, 15),
      createdAt: daysAgoIso(4, 19, 20),
    },
    {
      id: 'sens_2',
      userId: patientId,
      foodName: 'Very Cold Beverages',
      normalizedIngredient: 'ice water',
      reactionType: 'Throat discomfort',
      severity: 3,
      notes: 'Prefer room-temperature or warm herbal infusions.',
      lastReportedAt: daysAgoIso(7, 14, 0),
      createdAt: daysAgoIso(7, 14, 0),
    },
  ];

  const usdaFoods = [
    {
      fdcId: 171287,
      description: 'Yogurt, Greek, plain, nonfat (USDA Foundation)',
      category: 'Dairy and Egg Products',
      servingSizeLabel: '100g (approx. 3.5 oz)',
      nutrientsPer100g: { proteinG: 10.2, fiberG: 0, potassiumMg: 141, sodiumMg: 36, ironMg: 0.07, vitaminCMg: 0, calciumMg: 110, energyKcal: 59 },
    },
    {
      fdcId: 175167,
      description: 'Fish, salmon, Atlantic, wild, cooked, dry heat',
      category: 'Finfish and Shellfish Products',
      servingSizeLabel: '100g (approx. 3.5 oz)',
      nutrientsPer100g: { proteinG: 25.4, fiberG: 0, potassiumMg: 628, sodiumMg: 56, ironMg: 1.03, vitaminCMg: 0, calciumMg: 15, energyKcal: 182 },
    },
    {
      fdcId: 173904,
      description: 'Oats, rolled, regular and quick, dry',
      category: 'Cereal Grains and Pasta',
      servingSizeLabel: '100g dry',
      nutrientsPer100g: { proteinG: 13.2, fiberG: 10.1, potassiumMg: 362, sodiumMg: 6, ironMg: 4.25, vitaminCMg: 0, calciumMg: 52, energyKcal: 379 },
    },
    {
      fdcId: 168482,
      description: 'Sweet potato, cooked, boiled, without skin',
      category: 'Vegetables and Vegetable Products',
      servingSizeLabel: '100g',
      nutrientsPer100g: { proteinG: 1.4, fiberG: 2.5, potassiumMg: 230, sodiumMg: 27, ironMg: 0.72, vitaminCMg: 12.8, calciumMg: 27, energyKcal: 76 },
    },
    {
      fdcId: 174277,
      description: 'Tofu, silken, soft, prepared with calcium sulfate',
      category: 'Legumes and Legume Products',
      servingSizeLabel: '100g',
      nutrientsPer100g: { proteinG: 4.8, fiberG: 0.1, potassiumMg: 150, sodiumMg: 12, ironMg: 0.85, vitaminCMg: 0.1, calciumMg: 130, energyKcal: 55 },
    },
    {
      fdcId: 169231,
      description: 'Ginger root, raw (culinary aromatic)',
      category: 'Spices and Herbs',
      servingSizeLabel: '100g',
      nutrientsPer100g: { proteinG: 1.8, fiberG: 2.0, potassiumMg: 415, sodiumMg: 13, ironMg: 0.6, vitaminCMg: 5.0, calciumMg: 16, energyKcal: 80 },
    },
    {
      fdcId: 173944,
      description: 'Bananas, raw',
      category: 'Fruits and Fruit Juices',
      servingSizeLabel: '100g',
      nutrientsPer100g: { proteinG: 1.1, fiberG: 2.6, potassiumMg: 358, sodiumMg: 1, ironMg: 0.26, vitaminCMg: 8.7, calciumMg: 5, energyKcal: 89 },
    },
    {
      fdcId: 171711,
      description: 'Blueberries, frozen or raw',
      category: 'Fruits and Fruit Juices',
      servingSizeLabel: '100g',
      nutrientsPer100g: { proteinG: 0.7, fiberG: 2.4, potassiumMg: 77, sodiumMg: 1, ironMg: 0.28, vitaminCMg: 9.7, calciumMg: 6, energyKcal: 57 },
    },
    {
      fdcId: 172421,
      description: 'Rice, white, long-grain, regular, cooked',
      category: 'Cereal Grains and Pasta',
      servingSizeLabel: '100g cooked',
      nutrientsPer100g: { proteinG: 2.7, fiberG: 0.4, potassiumMg: 35, sodiumMg: 1, ironMg: 1.2, vitaminCMg: 0, calciumMg: 10, energyKcal: 130 },
    },
  ];

  const foodSafetyGuides = [
    {
      id: 'fs_neutropenic',
      topic: 'Food Handling During Low White Blood Cell Counts (Neutropenia)',
      audience: 'Patients undergoing chemotherapy or stem cell transplant',
      summary:
        'Safe food preparation lowers exposure to foodborne pathogens when immune defenses are temporarily reduced.',
      actionableSteps: [
        'Wash hands with warm soapy water for 20 seconds before preparing or eating meals.',
        'Cook poultry to 165°F (74°C), fish to 145°F (63°C), and reheat leftovers until steaming hot.',
        'Refrigerate perishable dishes within 2 hours of cooking (1 hour if ambient room temperature exceeds 90°F).',
        'Scrub thick-skinned fruits and vegetables under running water before peeling.',
      ],
      avoidList: [
        'Unpasteurized milk, soft cheeses (brie, queso fresco, blue cheese), and unpasteurized juices',
        'Raw or undercooked eggs, sushi, sashimi, ceviche, and raw sprouts (alfalfa, mung bean)',
        'Self-serve bulk bins, salad bars, and deli meats unless heated steaming hot',
      ],
      sourceOrganization: 'FDA & USDA — Food Safety for People with Cancer',
      sourceUrl: 'https://www.fda.gov/food/people-risk-foodborne-illness/food-safety-people-cancer',
    },
    {
      id: 'fs_mucositis',
      topic: 'Texture & Acidity Considerations for Mouth Sores & Swallowing',
      audience: 'Patients experiencing oral mucositis, dry mouth, or dysphagia',
      summary:
        'Adjusting food temperature, moisture, and acidity makes eating more comfortable and reduces mucosal irritation.',
      actionableSteps: [
        'Serve foods lukewarm or at room temperature rather than piping hot.',
        'Moisten meats, grains, and vegetables with mild broths, olive oil, or plain yogurt.',
        'Blend soups and smoothies until smooth; peel fruits before poaching or pureeing.',
      ],
      avoidList: [
        'Sharp, crunchy foods (crackers, toast crusts, tortilla chips)',
        'Highly acidic tomatoes, citrus juices, vinegar dressings, and spicy peppers',
        'Alcohol-based mouthwashes or carbonated beverages during acute soreness',
      ],
      sourceOrganization: 'National Cancer Institute (NCI) — Eating Hints',
      sourceUrl: 'https://www.cancer.gov/publications/patient-education/eatinghints',
    },
    {
      id: 'fs_taste_nausea',
      topic: 'Managing Metallic Taste & Treatment-Related Nausea',
      audience: 'Patients noticing dysgeusia or episodic nausea',
      summary:
        'Small, frequent, low-odor meals paired with non-reactive utensils help preserve intake on low-appetite days.',
      actionableSteps: [
        'Use bamboo, ceramic, or plastic utensils if metal cutlery worsens metallic taste.',
        'Favor cold or room-temperature dishes that release fewer strong cooking aromas.',
        'Sip ginger tea, peppermint infusion, or diluted electrolyte fluids in small steady amounts between meals.',
      ],
      avoidList: [
        'Heavy fried, greasy, or strongly perfumed foods immediately before infusions',
        'Eating large volumes at once when early satiety is present',
      ],
      sourceOrganization: 'American Cancer Society — Nutrition for People with Cancer',
      sourceUrl: 'https://www.cancer.org/cancer/survivorship/coping/nutrition.html',
    },
  ];

  const healthcareResources = [
    {
      id: 'hr_onc_dpg',
      title: 'Find a Board-Certified Specialist in Oncology Nutrition (CSO)',
      organization: 'Oncology Nutrition Dietetic Practice Group (Academy of Nutrition and Dietetics)',
      description:
        'Directory and evidence-based articles authored by Registered Dietitian Nutritionists specializing in cancer care.',
      url: 'https://www.oncologynutrition.org/',
      category: 'Registered Dietitian' as const,
    },
    {
      id: 'hr_nci_hints',
      title: 'Eating Hints: Before, During, and After Cancer Treatment',
      organization: 'National Cancer Institute (NIH)',
      description:
        'Comprehensive patient guide covering appetite changes, hydration strategies, weight maintenance, and caregiver meal tips.',
      url: 'https://www.cancer.gov/publications/patient-education/eatinghints',
      category: 'Clinical Guidelines' as const,
    },
    {
      id: 'hr_acs_nutrition',
      title: 'Nutrition for the Person With Cancer During Treatment',
      organization: 'American Cancer Society',
      description:
        'Practical guidance on protein needs, managing side effects, and questions to bring to your oncology care team.',
      url: 'https://www.cancer.org/cancer/survivorship/coping/nutrition.html',
      category: 'Symptom Management' as const,
    },
  ];

  return {
    users: [
      {
        id: patientId,
        email: 'elena.vance@oncobyte.org',
        name: 'Elena Vance',
        passwordHash,
        role: 'patient',
        createdAt: daysAgoIso(30, 8, 0),
        profile: {
          dietaryRestrictions: ['Soft Texture', 'Low-Acid'],
          allergies: ['Peanuts'],
          treatmentPhase: 'Cycle 3 — Outpatient Chemotherapy',
          dailyFluidGoalMl: 1800,
          preferredTemp: 'room',
          loggingPreferences: {
            meals: true,
            hydration: true,
            symptoms: true,
            appetite: true,
            tolerances: true,
          },
          reminders: {
            mealRemindersEnabled: true,
            mealTimes: ['08:30', '12:30', '18:00'],
            hydrationRemindersEnabled: true,
            hydrationIntervalMinutes: 120,
          },
          clinicianName: 'Dr. Priya Nair, MD (Medical Oncology)',
          dietitianName: 'Marcus Chen, MS, RDN, CSO',
        },
      },
    ],
    meals,
    hydration,
    symptomCatalog,
    symptoms,
    sensitivities,
    recipes,
    collections: [
      {
        id: 'col_gentle_mornings',
        userId: patientId,
        name: 'Gentle Mornings',
        description: 'Warm, soothing breakfasts and low-odor infusions for treatment weeks.',
        recipeIds: ['rec_poached_pear_oat_porridge', 'rec_blueberry_yogurt_smoothie'],
        createdAt: daysAgoIso(12, 9, 0),
      },
      {
        id: 'col_high_protein',
        userId: patientId,
        name: 'Soft High-Protein Recovery',
        description: 'Easy-to-swallow protein-forward dishes.',
        recipeIds: ['rec_herb_salmon_sweet_potato', 'rec_ginger_miso_broth'],
        createdAt: daysAgoIso(10, 11, 0),
      },
    ],
    savedRecipes: [
      { id: 'sav_1', userId: patientId, recipeId: 'rec_ginger_miso_broth', savedAt: daysAgoIso(5, 13, 0) },
      { id: 'sav_2', userId: patientId, recipeId: 'rec_poached_pear_oat_porridge', savedAt: daysAgoIso(3, 9, 0) },
    ],
    usdaFoods,
    foodSafetyGuides,
    healthcareResources,
    reports: [],
    caregiverGrants: [
      {
        id: 'cg_1',
        patientUserId: patientId,
        caregiverName: 'David Vance',
        caregiverEmail: 'david.vance@familycare.org',
        relationship: 'Spouse / Primary Caregiver',
        permissions: ['read_journal', 'log_entries', 'export_reports'],
        active: true,
        grantedAt: daysAgoIso(14, 10, 0),
      },
    ],
  };
}

let cachedDb: DatabaseSchema | null = null;

export function getDb(): DatabaseSchema {
  if (cachedDb) return cachedDb;
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (existsSync(DB_FILE)) {
    try {
      const raw = readFileSync(DB_FILE, 'utf8');
      cachedDb = JSON.parse(raw) as DatabaseSchema;
      return cachedDb;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  cachedDb = createInitialSeed();
  saveDb();
  return cachedDb;
}

export function saveDb(): void {
  if (!cachedDb) return;
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(cachedDb, null, 2), 'utf8');
  renameSync(tmpFile, DB_FILE);
}
