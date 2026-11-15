import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Search, Check, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type {
  FoodSensitivityRecord,
  HydrationEntry,
  MealEntry,
  MealType,
  SymptomCatalogItem,
  SymptomEntry,
  UsdaFoodItem,
  UserAccount,
} from '../types/oncobyte';

interface DailyLogViewProps {
  user: UserAccount;
  initialTab: 'meals' | 'hydration' | 'symptoms';
  meals: MealEntry[];
  hydration: HydrationEntry[];
  symptoms: SymptomEntry[];
  sensitivities: FoodSensitivityRecord[];
  catalog: SymptomCatalogItem[];
  onRefresh: () => Promise<void>;
}

export const DailyLogView: React.FC<DailyLogViewProps> = ({
  user,
  initialTab,
  meals,
  hydration,
  symptoms,
  sensitivities,
  catalog,
  onRefresh,
}) => {
  const [tab, setTab] = useState<'meals' | 'hydration' | 'symptoms'>(initialTab);

  // Meal form state
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [portion, setPortion] = useState('');
  const [toleranceRating, setToleranceRating] = useState(4);
  const [toleranceNotes, setToleranceNotes] = useState('');
  const [isCustomFood, setIsCustomFood] = useState(false);
  const [usdaQuery, setUsdaQuery] = useState('');
  const [usdaMatches, setUsdaMatches] = useState<UsdaFoodItem[]>([]);
  const [mealBusy, setMealBusy] = useState(false);
  const [mealMsg, setMealMsg] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editPortion, setEditPortion] = useState('');
  const [editRating, setEditRating] = useState(4);

  // Hydration form state
  const [fluidType, setFluidType] = useState('Filtered Water');
  const [amountMl, setAmountMl] = useState(250);
  const [temperature, setTemperature] = useState<'cool' | 'room' | 'warm'>('room');
  const [hydNotes, setHydNotes] = useState('');
  const [hydBusy, setHydBusy] = useState(false);

  // Symptom & sensitivity state
  const [selectedSymptomId, setSelectedSymptomId] = useState(catalog[0]?.id || 'sym_nausea');
  const [severity, setSeverity] = useState(3);
  const [appetiteScore, setAppetiteScore] = useState<number>(3);
  const [eatingDifficulty, setEatingDifficulty] = useState('');
  const [triggerFood, setTriggerFood] = useState('');
  const [symNotes, setSymNotes] = useState('');
  const [symBusy, setSymBusy] = useState(false);

  const [sensFood, setSensFood] = useState('');
  const [sensReaction, setSensReaction] = useState('Nausea / Queasiness');
  const [sensSeverity, setSensSeverity] = useState(3);
  const [sensNotes, setSensNotes] = useState('');

  async function lookupUsda(q: string) {
    setUsdaQuery(q);
    if (q.trim().length < 2) {
      setUsdaMatches([]);
      return;
    }
    try {
      const res = await apiRequest<{ foods: UsdaFoodItem[] }>(
        `/api/nutrition/lookup?q=${encodeURIComponent(q.trim())}`
      );
      setUsdaMatches(res.foods.slice(0, 4));
    } catch {
      setUsdaMatches([]);
    }
  }

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    setMealBusy(true);
    setMealMsg(null);
    try {
      await apiRequest('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          mealType,
          foodName,
          ingredients: ingredientsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          portion: portion || '1 serving',
          toleranceRating,
          toleranceNotes,
          isCustomFood,
        }),
      });
      setFoodName('');
      setIngredientsText('');
      setPortion('');
      setToleranceNotes('');
      setUsdaMatches([]);
      setUsdaQuery('');
      setMealMsg('Meal entry saved to your daily journal.');
      await onRefresh();
    } finally {
      setMealBusy(false);
    }
  }

  async function handleSaveMealEdit(id: string) {
    await apiRequest(`/api/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        foodName: editFoodName,
        portion: editPortion,
        toleranceRating: editRating,
      }),
    });
    setEditingMealId(null);
    await onRefresh();
  }

  async function handleDeleteMeal(id: string) {
    await apiRequest(`/api/meals/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  async function handleAddHydration(e: React.FormEvent) {
    e.preventDefault();
    setHydBusy(true);
    try {
      await apiRequest('/api/hydration', {
        method: 'POST',
        body: JSON.stringify({
          fluidType,
          amountMl: Number(amountMl),
          temperature,
          notes: hydNotes,
        }),
      });
      setHydNotes('');
      await onRefresh();
    } finally {
      setHydBusy(false);
    }
  }

  async function handleQuickHydration(ml: number) {
    setHydBusy(true);
    try {
      await apiRequest('/api/hydration', {
        method: 'POST',
        body: JSON.stringify({
          fluidType,
          amountMl: ml,
          temperature,
          notes: 'Quick entry',
        }),
      });
      await onRefresh();
    } finally {
      setHydBusy(false);
    }
  }

  async function handleAddSymptom(e: React.FormEvent) {
    e.preventDefault();
    setSymBusy(true);
    try {
      await apiRequest('/api/symptoms', {
        method: 'POST',
        body: JSON.stringify({
          symptomId: selectedSymptomId,
          severity,
          appetiteScore,
          eatingDifficulty,
          triggerFood,
          notes: symNotes,
        }),
      });
      setEatingDifficulty('');
      setTriggerFood('');
      setSymNotes('');
      await onRefresh();
    } finally {
      setSymBusy(false);
    }
  }

  async function handleAddSensitivity(e: React.FormEvent) {
    e.preventDefault();
    if (!sensFood.trim()) return;
    await apiRequest('/api/sensitivities', {
      method: 'POST',
      body: JSON.stringify({
        foodName: sensFood,
        reactionType: sensReaction,
        severity: sensSeverity,
        notes: sensNotes,
      }),
    });
    setSensFood('');
    setSensNotes('');
    await onRefresh();
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayHydrationMl = hydration
    .filter((h) => new Date(h.timestamp).toISOString().slice(0, 10) === todayKey)
    .reduce((sum, h) => sum + h.amountMl, 0);
  const goalMl = user.profile.dailyFluidGoalMl || 1800;
  const hydPct = Math.min(100, Math.round((todayHydrationMl / goalMl) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Daily Nutrition, Hydration & Symptom Logging
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Record meals, custom foods, fluid intake, eating difficulties, and food tolerances.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              ['meals', 'Meals & Tolerance'],
              ['hydration', 'Hydration'],
              ['symptoms', 'Symptoms & Sensitivities'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* MEALS TAB */}
      {tab === 'meals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">Record Meal or Snack</h3>
            <p className="mt-1 text-xs text-slate-500">
              Search USDA FoodData Central or enter a custom meal below.
            </p>

            {/* Optional USDA quick search */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Quick-Fill from USDA FoodData Central (Optional)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={usdaQuery}
                  onChange={(e) => lookupUsda(e.target.value)}
                  placeholder="Search e.g. salmon, oats, yogurt, sweet potato..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
              {usdaMatches.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50">
                  {usdaMatches.map((item) => (
                    <button
                      key={item.fdcId}
                      type="button"
                      onClick={() => {
                        setFoodName(item.description);
                        setIngredientsText(item.description.split(',')[0].toLowerCase());
                        setPortion(item.servingSizeLabel);
                        setIsCustomFood(false);
                        setUsdaMatches([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white transition-colors"
                    >
                      <span className="font-medium text-slate-900 block truncate">
                        {item.description}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        Protein {item.nutrientsPer100g.proteinG}g · Fiber{' '}
                        {item.nutrientsPer100g.fiberG}g · Potassium{' '}
                        {item.nutrientsPer100g.potassiumMg}mg per 100g
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddMeal} className="mt-5 space-y-4">
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => setMealType(mt)}
                    className={`py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                      mealType === mt
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mt}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Food or Dish Name
                </label>
                <input
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g., Warm Ginger Miso Broth"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ingredients (comma-separated for tolerance matching)
                </label>
                <input
                  type="text"
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder="e.g., ginger, miso, tofu, white rice"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Portion (optional)
                  </label>
                  <input
                    type="text"
                    value={portion}
                    onChange={(e) => setPortion(e.target.value)}
                    placeholder="e.g., 1 small bowl"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tolerance Rating (1–5)
                  </label>
                  <select
                    value={toleranceRating}
                    onChange={(e) => setToleranceRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none bg-white"
                  >
                    <option value={5}>5 — Very comfortable</option>
                    <option value={4}>4 — Well tolerated</option>
                    <option value={3}>3 — Neutral / manageable</option>
                    <option value={2}>2 — Mild discomfort</option>
                    <option value={1}>1 — Difficult to tolerate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tolerance & Texture Notes
                </label>
                <textarea
                  rows={2}
                  value={toleranceNotes}
                  onChange={(e) => setToleranceNotes(e.target.value)}
                  placeholder="How did this meal sit? Any taste, swallowing, or temperature notes?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCustomFood}
                  onChange={(e) => setIsCustomFood(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span>Mark as personal custom food entry</span>
              </label>

              {mealMsg && <p className="text-xs font-medium text-teal-700">{mealMsg}</p>}

              <button
                type="submit"
                disabled={mealBusy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{mealBusy ? 'Saving...' : 'Save Meal Entry'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">Chronological Meal History</h3>
            <p className="mt-1 text-xs text-slate-500">
              Edit portions or tolerance scores anytime, or remove incorrect entries.
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {meals.length === 0 ? (
                <p className="py-8 text-sm text-slate-500 text-center">No meals logged yet.</p>
              ) : (
                meals.map((m) => (
                  <div key={m.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-teal-800 capitalize">{m.mealType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(m.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-medium tabular-nums ${
                            m.toleranceRating >= 4
                              ? 'text-emerald-700'
                              : m.toleranceRating <= 2
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          Tolerance {m.toleranceRating}/5
                        </span>
                        {m.isCustomFood && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Custom Entry</span>
                          </>
                        )}
                      </div>

                      {editingMealId === m.id ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editFoodName}
                            onChange={(e) => setEditFoodName(e.target.value)}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={editPortion}
                            onChange={(e) => setEditPortion(e.target.value)}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs w-28"
                          />
                          <select
                            value={editRating}
                            onChange={(e) => setEditRating(Number(e.target.value))}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}/5
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSaveMealEdit(m.id)}
                            className="p-1.5 rounded bg-teal-700 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMealId(null)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-medium text-slate-900">{m.foodName}</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {m.portion}
                            {m.normalizedIngredients.length > 0 &&
                              ` · Standardized ingredients: ${m.normalizedIngredients.join(', ')}`}
                          </p>
                          {m.toleranceNotes && (
                            <p className="mt-1 text-xs text-slate-500">{m.toleranceNotes}</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMealId(m.id);
                          setEditFoodName(m.foodName);
                          setEditPortion(m.portion);
                          setEditRating(m.toleranceRating);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded"
                        aria-label="Edit meal"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMeal(m.id)}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                        aria-label="Delete meal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* HYDRATION TAB */}
      {tab === 'hydration' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Hydration Intake Logger</h3>
              <p className="mt-1 text-xs text-slate-500">
                Daily Target: <span className="font-mono tabular-nums">{goalMl} ml</span> · Logged
                Today: <span className="font-mono tabular-nums">{todayHydrationMl} ml</span> (
                {hydPct}%)
              </p>
              <div className="mt-3 h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700 rounded-full transition-all"
                  style={{ width: `${hydPct}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 mb-2">Quick-Add Fluid Volume</p>
              <div className="grid grid-cols-4 gap-2">
                {[150, 250, 350, 500].map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    disabled={hydBusy}
                    onClick={() => handleQuickHydration(ml)}
                    className="py-2 text-xs font-mono font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-slate-800 tabular-nums"
                  >
                    +{ml}ml
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddHydration} className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fluid Type</label>
                <select
                  value={fluidType}
                  onChange={(e) => setFluidType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option>Filtered Water</option>
                  <option>Warm Ginger Tea</option>
                  <option>Electrolyte Solution</option>
                  <option>Vegetable Broth</option>
                  <option>Chamomile Tea</option>
                  <option>Oral Nutrition Supplement</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Amount (ml)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2500}
                    value={amountMl}
                    onChange={(e) => setAmountMl(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Temperature
                  </label>
                  <select
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(e.target.value as 'cool' | 'room' | 'warm')
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="room">Room Temp</option>
                    <option value="warm">Warm</option>
                    <option value="cool">Cool</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={hydNotes}
                  onChange={(e) => setHydNotes(e.target.value)}
                  placeholder="Optional sip comfort note"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={hydBusy}
                className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors"
              >
                {hydBusy ? 'Saving...' : 'Log Fluid Entry'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">Fluid Intake History</h3>
            <div className="mt-4 divide-y divide-slate-100">
              {hydration.map((h) => (
                <div key={h.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {h.fluidType} ·{' '}
                      <span className="font-mono tabular-nums text-teal-800">{h.amountMl} ml</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono tabular-nums">
                        {new Date(h.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {' · '}
                      <span className="capitalize">{h.temperature} temperature</span>
                      {h.notes ? ` · ${h.notes}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/hydration/${h.id}`, { method: 'DELETE' });
                      await onRefresh();
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                    aria-label="Delete hydration entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SYMPTOMS & SENSITIVITIES TAB */}
      {tab === 'symptoms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900">
                Symptom, Appetite & Eating Difficulty Log
              </h3>
              <form onSubmit={handleAddSymptom} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Symptom / Experience
                  </label>
                  <select
                    value={selectedSymptomId}
                    onChange={(e) => setSelectedSymptomId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Severity (1–5)
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value={1}>1 — Very mild</option>
                      <option value={2}>2 — Mild</option>
                      <option value={3}>3 — Moderate</option>
                      <option value={4}>4 — Noticeable</option>
                      <option value={5}>5 — Severe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Appetite Level (1–5)
                    </label>
                    <select
                      value={appetiteScore}
                      onChange={(e) => setAppetiteScore(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value={1}>1 — No appetite</option>
                      <option value={2}>2 — Low appetite</option>
                      <option value={3}>3 — Moderate</option>
                      <option value={4}>4 — Good</option>
                      <option value={5}>5 — Strong appetite</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Eating or Swallowing Challenge (optional)
                  </label>
                  <input
                    type="text"
                    value={eatingDifficulty}
                    onChange={(e) => setEatingDifficulty(e.target.value)}
                    placeholder="e.g., Dry throat with solid toast, food aversion"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Suspected Context / Food (optional)
                  </label>
                  <input
                    type="text"
                    value={triggerFood}
                    onChange={(e) => setTriggerFood(e.target.value)}
                    placeholder="e.g., acidic tomato soup"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={symNotes}
                    onChange={(e) => setSymNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={symBusy}
                  className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors"
                >
                  {symBusy ? 'Logging...' : 'Save Symptom Entry'}
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900">Food Sensitivity Registry</h3>
              <p className="mt-1 text-xs text-slate-500">
                Track foods you find difficult to tolerate so recipe recommendations flag them.
              </p>

              <form onSubmit={handleAddSensitivity} className="mt-4 space-y-3">
                <input
                  type="text"
                  required
                  value={sensFood}
                  onChange={(e) => setSensFood(e.target.value)}
                  placeholder="Food or ingredient (e.g., Tomato, Citrus, Spicy Chili)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={sensReaction}
                    onChange={(e) => setSensReaction(e.target.value)}
                    placeholder="Reaction type"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <select
                    value={sensSeverity}
                    onChange={(e) => setSensSeverity(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        Severity {n}/5
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={sensNotes}
                  onChange={(e) => setSensNotes(e.target.value)}
                  placeholder="Comfort notes or substitutes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  Add to Sensitivity Registry
                </button>
              </form>

              <div className="mt-4 divide-y divide-slate-100">
                {sensitivities.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {s.foodName} · <span className="text-red-700">Severity {s.severity}/5</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.reactionType}
                        {s.notes ? ` — ${s.notes}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/sensitivities/${s.id}`, { method: 'DELETE' });
                        await onRefresh();
                      }}
                      className="p-1 text-slate-400 hover:text-red-700"
                      aria-label="Remove sensitivity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">Symptom & Appetite Timeline</h3>
            <div className="mt-4 divide-y divide-slate-100">
              {symptoms.map((s) => (
                <div key={s.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-amber-800">{s.symptomName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(s.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Severity {s.severity}/5</span>
                      {typeof s.appetiteScore === 'number' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Appetite {s.appetiteScore}/5</span>
                        </>
                      )}
                    </div>
                    {s.eatingDifficulty && (
                      <p className="mt-1 text-xs text-slate-700">
                        Eating challenge: {s.eatingDifficulty}
                      </p>
                    )}
                    {s.triggerFood && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        Reported context food: {s.triggerFood}
                      </p>
                    )}
                    {s.notes && <p className="mt-0.5 text-xs text-slate-500">{s.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/symptoms/${s.id}`, { method: 'DELETE' });
                      await onRefresh();
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                    aria-label="Delete symptom"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
