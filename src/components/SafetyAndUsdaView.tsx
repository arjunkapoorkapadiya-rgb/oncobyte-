import React, { useEffect, useState } from 'react';
import { ExternalLink, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { FoodSafetyGuide, HealthcareResource, UsdaFoodItem } from '../types/oncobyte';

export const SafetyAndUsdaView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<UsdaFoodItem[]>([]);
  const [usdaSource, setUsdaSource] = useState('');
  const [guides, setGuides] = useState<FoodSafetyGuide[]>([]);
  const [resources, setResources] = useState<HealthcareResource[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [loadingFood, setLoadingFood] = useState(false);

  useEffect(() => {
    void loadInitial();
  }, []);

  async function loadInitial() {
    const [safetyRes, usdaRes] = await Promise.all([
      apiRequest<{
        guides: FoodSafetyGuide[];
        healthcareResources: HealthcareResource[];
        disclaimer: string;
      }>('/api/safety-resources'),
      apiRequest<{ foods: UsdaFoodItem[]; source: string }>('/api/nutrition/lookup'),
    ]);
    setGuides(safetyRes.guides);
    setResources(safetyRes.healthcareResources);
    setDisclaimer(safetyRes.disclaimer);
    setFoods(usdaRes.foods);
    setUsdaSource(usdaRes.source);
  }

  async function handleUsdaSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoadingFood(true);
    try {
      const res = await apiRequest<{ foods: UsdaFoodItem[]; source: string }>(
        `/api/nutrition/lookup?q=${encodeURIComponent(query)}`
      );
      setFoods(res.foods);
      setUsdaSource(res.source);
    } finally {
      setLoadingFood(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Food Safety, USDA Nutrition Reference & Clinical Guidance
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Evidence-based oncology food safety guidelines and ingredient nutrition lookup without
          calorie-counting pressure.
        </p>
      </div>

      {/* Nutrition Disclaimer */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">Nutrition & Medical Disclaimer</p>
          <p className="mt-1">
            {disclaimer ||
              'General nutrition and food safety information provided in OncoByte is for personal tracking and educational reference only. It does not constitute individualized medical nutrition therapy—always consult your oncologist or Registered Dietitian Nutritionist (RDN).'}
          </p>
        </div>
      </div>

      {/* USDA FoodData Central Ingredient Lookup */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              USDA FoodData Central Ingredient Lookup
            </h3>
            <p className="text-xs text-slate-500">
              Source: {usdaSource || 'USDA FoodData Central Reference'} · Values shown per 100g to
              support protein and micronutrient awareness.
            </p>
          </div>

          <form onSubmit={handleUsdaSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Lookup ingredient (e.g., salmon, tofu, oats)..."
                className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 w-64 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loadingFood}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 whitespace-nowrap"
            >
              {loadingFood ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-medium">Food / Ingredient</th>
                <th className="py-2.5 px-3 font-medium text-right">Protein</th>
                <th className="py-2.5 px-3 font-medium text-right">Fiber</th>
                <th className="py-2.5 px-3 font-medium text-right">Potassium</th>
                <th className="py-2.5 px-3 font-medium text-right">Iron</th>
                <th className="py-2.5 px-3 font-medium text-right">Vitamin C</th>
                <th className="py-2.5 pl-3 font-medium text-right">Sodium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {foods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No matching USDA FoodData Central entries found for &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              ) : (
                foods.map((f) => (
                  <tr key={f.fdcId} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{f.description}</p>
                      <p className="text-[11px] text-slate-500">
                        FDC #{f.fdcId} · {f.category}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {f.nutrientsPer100g.proteinG}g
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {f.nutrientsPer100g.fiberG}g
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {f.nutrientsPer100g.potassiumMg}mg
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {f.nutrientsPer100g.ironMg}mg
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {f.nutrientsPer100g.vitaminCMg}mg
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-700">
                      {f.nutrientsPer100g.sodiumMg}mg
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Food Safety Guidance Cards */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Treatment-Specific Food Safety Reference
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {guides.map((guide) => (
            <div
              key={guide.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-teal-800">{guide.audience}</p>
                <h4 className="mt-1 text-base font-semibold text-slate-900">{guide.topic}</h4>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{guide.summary}</p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-800">Recommended Practices</p>
                  <ul className="mt-1.5 space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                    {guide.actionableSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-red-800">Foods to Handle Carefully / Avoid</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-slate-600 list-disc list-inside">
                    {guide.avoidList.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <a
                href={guide.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 pt-3 border-t border-slate-100 inline-flex items-center justify-between text-xs font-medium text-teal-700 hover:underline"
              >
                <span>{guide.sourceOrganization}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Registered Dietitian & Reputable Medical Organizations */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Healthcare Professional & Dietitian Guidance Resources
        </h3>
        <div className="mt-4 divide-y divide-slate-100">
          {resources.map((res) => (
            <div key={res.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">
                  {res.category} · {res.organization}
                </p>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{res.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{res.description}</p>
              </div>
              <a
                href={res.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <span>Visit Resource</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
