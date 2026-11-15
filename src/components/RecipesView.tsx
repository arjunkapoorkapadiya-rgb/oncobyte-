import React, { useState } from 'react';
import { Bookmark, ExternalLink, Plus, Search, AlertTriangle, X, Utensils } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Recipe, RecipeCollection, RecipeRecommendation } from '../types/oncobyte';

interface RecipesViewProps {
  recipes: Recipe[];
  recommendations: RecipeRecommendation[];
  collections: RecipeCollection[];
  onRefresh: () => Promise<void>;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  recipes,
  recommendations,
  collections,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<'all' | 'quick' | 'soft' | 'bland' | 'protein' | 'saved'>('all');
  const [activeCollectionId, setActiveCollectionId] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Custom recipe submission state
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<Recipe['category']>('Main Dish');
  const [customPrep, setCustomPrep] = useState(20);
  const [customServings, setCustomServings] = useState(2);
  const [customIngredients, setCustomIngredients] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customBusy, setCustomBusy] = useState(false);

  // New collection creation
  const [newCollectionName, setNewCollectionName] = useState('');

  const filteredRecipes = recipes.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchIng = r.ingredients.some(
        (i) => i.raw.toLowerCase().includes(q) || i.normalized.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchIng) return false;
    }

    if (filterTag === 'quick' && r.prepTimeMinutes > 15) return false;
    if (filterTag === 'soft' && !r.dietaryTags.some((t) => /soft/i.test(t))) return false;
    if (filterTag === 'bland' && !r.dietaryTags.some((t) => /bland|gentle|nausea/i.test(t)))
      return false;
    if (filterTag === 'protein' && !r.dietaryTags.some((t) => /protein/i.test(t))) return false;
    if (filterTag === 'saved' && !r.isSaved) return false;

    if (activeCollectionId !== 'all') {
      const col = collections.find((c) => c.id === activeCollectionId);
      if (!col || !col.recipeIds.includes(r.id)) return false;
    }

    return true;
  });

  async function toggleSaveRecipe(recipe: Recipe) {
    if (recipe.isSaved) {
      await apiRequest(`/api/recipes/${recipe.id}/save`, { method: 'DELETE' });
    } else {
      await apiRequest(`/api/recipes/${recipe.id}/save`, { method: 'POST' });
    }
    await onRefresh();
    if (selectedRecipe?.id === recipe.id) {
      setSelectedRecipe({ ...recipe, isSaved: !recipe.isSaved });
    }
  }

  async function addToCollection(collectionId: string, recipeId: string) {
    await apiRequest(`/api/collections/${collectionId}/recipes`, {
      method: 'POST',
      body: JSON.stringify({ recipeId }),
    });
    await onRefresh();
  }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    await apiRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ name: newCollectionName.trim() }),
    });
    setNewCollectionName('');
    await onRefresh();
  }

  async function submitCustomRecipe(e: React.FormEvent) {
    e.preventDefault();
    setCustomBusy(true);
    try {
      await apiRequest('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: customTitle,
          category: customCategory,
          prepTimeMinutes: customPrep,
          servings: customServings,
          ingredients: customIngredients,
          instructions: customInstructions,
        }),
      });
      setCustomTitle('');
      setCustomIngredients('');
      setCustomInstructions('');
      setShowCustomModal(false);
      await onRefresh();
    } finally {
      setCustomBusy(false);
    }
  }

  const recMap = new Map(recommendations.map((rec) => [rec.recipe.id, rec]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Tolerance-Matched Recipes & Personal Library
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Curated oncology-friendly recipes matched against your logged food tolerances and
            sensitivities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCustomModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Recipe</span>
        </button>
      </div>

      {/* Personalized Recommendations Strip */}
      {recommendations.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Recommended Based on Your Logged Tolerances
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Ranked by ingredient tolerance history, recent symptom check-ins, and allergy filters.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.slice(0, 2).map((rec) => (
              <div
                key={rec.recipe.id}
                onClick={() => setSelectedRecipe(rec.recipe)}
                className="border border-slate-200 rounded-xl p-4 hover:border-teal-700/50 transition-colors cursor-pointer flex gap-4 items-start"
              >
                <div className="w-24 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative flex items-center justify-center">
                  <img
                    src={rec.recipe.imageUrl}
                    alt={rec.recipe.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-teal-800 tabular-nums">
                      {rec.matchScore}% Tolerance Match
                    </span>
                    <span className="tabular-nums">{rec.recipe.prepTimeMinutes} min</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {rec.recipe.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{rec.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipe name or normalized ingredient (e.g., ginger, oats)..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['quick', '≤15 min'],
              ['soft', 'Soft Texture'],
              ['bland', 'Bland / Gentle'],
              ['protein', 'High Protein'],
              ['saved', 'Saved'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterTag(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterTag === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Collections Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Collections:</span>
          <button
            type="button"
            onClick={() => setActiveCollectionId('all')}
            className={`px-3 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
              activeCollectionId === 'all'
                ? 'border-teal-700 bg-teal-50 text-teal-900 font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
            }`}
          >
            All Library
          </button>
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCollectionId(c.id)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                activeCollectionId === c.id
                  ? 'border-teal-700 bg-teal-50 text-teal-900 font-medium'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.name} ({c.recipeIds.length})
            </button>
          ))}
        </div>

        <form onSubmit={createCollection} className="flex items-center gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="New collection name..."
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Create
          </button>
        </form>
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm text-slate-600">No recipes matched your search or filter criteria.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterTag('all');
              setActiveCollectionId('all');
            }}
            className="mt-3 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          {filteredRecipes.map((recipe) => {
            const rec = recMap.get(recipe.id);
            return (
              <article
                key={recipe.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div
                  onClick={() => setSelectedRecipe(recipe)}
                  className="aspect-4/3 w-full bg-slate-100 relative overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  <Utensils className="w-8 h-8 text-slate-300 absolute" />
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover relative z-10 hover:scale-[1.02] transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {recipe.category} ·{' '}
                        <span className="tabular-nums">{recipe.prepTimeMinutes} min</span> ·{' '}
                        <span className="tabular-nums">{recipe.servings} servings</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSaveRecipe(recipe)}
                        aria-label={recipe.isSaved ? 'Remove bookmark' : 'Save recipe'}
                        className={`p-1.5 rounded-md transition-colors ${
                          recipe.isSaved
                            ? 'text-teal-700 bg-teal-50'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <Bookmark
                          className="w-4 h-4"
                          fill={recipe.isSaved ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>

                    <h3
                      onClick={() => setSelectedRecipe(recipe)}
                      className="mt-2 text-lg font-semibold text-slate-900 cursor-pointer hover:text-teal-800"
                    >
                      {recipe.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {recipe.dietaryTags.join(' · ')}
                    </p>

                    {rec && (
                      <p className="mt-3 text-xs text-slate-700 leading-relaxed">
                        <span className="font-semibold text-teal-800 tabular-nums">
                          {rec.matchScore}% Match:
                        </span>{' '}
                        {rec.explanation}
                      </p>
                    )}

                    {recipe.safetyWarnings.length > 0 && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200 rounded-lg p-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{recipe.safetyWarnings[0]}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 truncate">{recipe.sourceName}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipe(recipe)}
                      className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
                    >
                      View Recipe
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  {selectedRecipe.category} · {selectedRecipe.prepTimeMinutes} min ·{' '}
                  {selectedRecipe.servings} servings
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedRecipe.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipe(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
                aria-label="Close recipe detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRecipe.safetyWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Food Safety & Treatment Notes</p>
                {selectedRecipe.safetyWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
                {selectedRecipe.allergens.length > 0 && (
                  <p className="font-medium pt-1">
                    Allergens present: {selectedRecipe.allergens.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                  Ingredients & Standardized Names
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex justify-between gap-2 text-xs">
                      <span>{ing.raw}</span>
                      <span className="font-mono text-slate-400 shrink-0">{ing.normalized}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                  Gentle Nutrition Context (per serving)
                </h4>
                <dl className="grid grid-cols-2 gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <dt className="text-slate-500">Protein</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedRecipe.nutritionPerServing.proteinG ?? '—'} g
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Fiber</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedRecipe.nutritionPerServing.fiberG ?? '—'} g
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Potassium</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedRecipe.nutritionPerServing.potassiumMg ?? '—'} mg
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Iron</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedRecipe.nutritionPerServing.ironMg ?? '—'} mg
                    </dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Source: {selectedRecipe.nutritionPerServing.source || 'USDA Reference'}.
                  Presented for nourishment support, not calorie restriction.
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Preparation Steps</h4>
              <ol className="space-y-2 list-decimal list-inside text-sm text-slate-700">
                {selectedRecipe.instructions.map((step, i) => (
                  <li key={i} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) addToCollection(e.target.value, selectedRecipe.id);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                >
                  <option value="" disabled>
                    Add to Collection...
                  </option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => toggleSaveRecipe(selectedRecipe)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  {selectedRecipe.isSaved ? 'Saved' : 'Bookmark'}
                </button>
              </div>

              {selectedRecipe.sourceUrl && (
                <a
                  href={selectedRecipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:underline"
                >
                  <span>{selectedRecipe.sourceName}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Recipe Submission Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Submit Custom Recipe</h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitCustomRecipe} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Recipe Title</label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Soft Mashed Sweet Potato & Chicken Broth"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as Recipe['category'])}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
                  >
                    <option>Breakfast</option>
                    <option>Soup & Broth</option>
                    <option>Main Dish</option>
                    <option>Smoothie & Snack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prep (min)</label>
                  <input
                    type="number"
                    min={5}
                    value={customPrep}
                    onChange={(e) => setCustomPrep(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Servings</label>
                  <input
                    type="number"
                    min={1}
                    value={customServings}
                    onChange={(e) => setCustomServings(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ingredients (one per line; normalized & checked for safety automatically)
                </label>
                <textarea
                  rows={4}
                  required
                  value={customIngredients}
                  onChange={(e) => setCustomIngredients(e.target.value)}
                  placeholder={'1 large sweet potato\n1 cup low-sodium vegetable broth\n1 tsp fresh grated ginger'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preparation Instructions (one step per line)
                </label>
                <textarea
                  rows={3}
                  required
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Boil peeled sweet potato until soft, then blend with warm broth."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={customBusy}
                className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                {customBusy ? 'Normalizing & Saving...' : 'Save to Personal Library'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
