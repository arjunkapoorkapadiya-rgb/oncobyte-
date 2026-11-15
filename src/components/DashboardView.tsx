import React, { useState } from 'react';
import { Droplets, Trash2, Edit3, Check, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type {
  DashboardAnalytics,
  HydrationEntry,
  MealEntry,
  SymptomCatalogItem,
  SymptomEntry,
  UserAccount,
} from '../types/oncobyte';

interface DashboardViewProps {
  user: UserAccount;
  analytics: DashboardAnalytics | null;
  meals: MealEntry[];
  hydration: HydrationEntry[];
  symptoms: SymptomEntry[];
  catalog: SymptomCatalogItem[];
  range: '7d' | '14d' | '30d';
  onChangeRange: (r: '7d' | '14d' | '30d') => void;
  onRefresh: () => Promise<void>;
  onOpenLogTab: (tab: 'meals' | 'hydration' | 'symptoms') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  analytics,
  meals,
  hydration,
  symptoms,
  catalog,
  range,
  onChangeRange,
  onRefresh,
  onOpenLogTab,
}) => {
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editPortion, setEditPortion] = useState('');
  const [editRating, setEditRating] = useState(4);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const prefs = user.profile.loggingPreferences;
  const quickSymptoms = catalog.filter((c) => c.quickEntry);

  async function handleQuickSymptom(item: SymptomCatalogItem) {
    setQuickBusy(item.id);
    setFeedback(null);
    try {
      await apiRequest('/api/symptoms', {
        method: 'POST',
        body: JSON.stringify({
          symptomId: item.id,
          severity: 3,
          notes: 'Quick-logged from dashboard',
        }),
      });
      setFeedback(`Logged "${item.name}" (Severity 3/5)`);
      await onRefresh();
    } finally {
      setQuickBusy(null);
    }
  }

  async function handleQuickHydration(amountMl: number, fluidType: string) {
    setQuickBusy(`${fluidType}_${amountMl}`);
    setFeedback(null);
    try {
      await apiRequest('/api/hydration', {
        method: 'POST',
        body: JSON.stringify({
          fluidType,
          amountMl,
          temperature: user.profile.preferredTemp === 'any' ? 'room' : user.profile.preferredTemp,
        }),
      });
      setFeedback(`Added ${amountMl} ml ${fluidType}`);
      await onRefresh();
    } finally {
      setQuickBusy(null);
    }
  }

  async function saveMealEdit(mealId: string) {
    await apiRequest(`/api/meals/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify({
        portion: editPortion,
        toleranceRating: editRating,
      }),
    });
    setEditingMealId(null);
    await onRefresh();
  }

  async function deleteMeal(mealId: string) {
    await apiRequest(`/api/meals/${mealId}`, { method: 'DELETE' });
    await onRefresh();
  }

  async function deleteHydration(id: string) {
    await apiRequest(`/api/hydration/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  async function deleteSymptom(id: string) {
    await apiRequest(`/api/symptoms/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  // Unified chronological journal for the selected period
  type JournalItem =
    | { kind: 'meal'; ts: string; item: MealEntry }
    | { kind: 'hydration'; ts: string; item: HydrationEntry }
    | { kind: 'symptom'; ts: string; item: SymptomEntry };

  const journalItems: JournalItem[] = [
    ...(prefs.meals ? meals.map((m) => ({ kind: 'meal' as const, ts: m.timestamp, item: m })) : []),
    ...(prefs.hydration
      ? hydration.map((h) => ({ kind: 'hydration' as const, ts: h.timestamp, item: h }))
      : []),
    ...(prefs.symptoms
      ? symptoms.map((s) => ({ kind: 'symptom' as const, ts: s.timestamp, item: s }))
      : []),
  ]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 14);

  const timeline = analytics?.timeline || [];
  const fluidGoal = analytics?.kpis.fluidGoalMl || user.profile.dailyFluidGoalMl || 1800;
  const todayFluid = analytics?.kpis.todayFluidMl || 0;
  const fluidPct = Math.min(100, Math.round((todayFluid / fluidGoal) * 100));

  const maxFluidInChart = Math.max(fluidGoal, ...timeline.map((t) => t.fluidMl), 1000);

  return (
    <div className="space-y-8">
      {/* Toolbar: Date Range & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Patient Nutrition & Symptom Overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {user.profile.treatmentPhase} · Clinician: {user.profile.clinicianName || 'Not set'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['7d', '14d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  range === r
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '14d' ? '14 Days' : '30 Days'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onOpenLogTab('meals')}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Log Meal
          </button>
        </div>
      </div>

      {/* Reminder Notice (if enabled) */}
      {(user.profile.reminders.mealRemindersEnabled ||
        user.profile.reminders.hydrationRemindersEnabled) && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Active Schedule Reminders: </span>
            {user.profile.reminders.mealRemindersEnabled &&
              `Meals at ${user.profile.reminders.mealTimes.join(', ')}`}
            {user.profile.reminders.mealRemindersEnabled &&
              user.profile.reminders.hydrationRemindersEnabled &&
              ' · '}
            {user.profile.reminders.hydrationRemindersEnabled &&
              `Hydration check-in every ${user.profile.reminders.hydrationIntervalMinutes} min`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={quickBusy !== null}
              onClick={() => handleQuickHydration(250, 'Filtered Water')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              +250 ml Water
            </button>
            <button
              type="button"
              disabled={quickBusy !== null}
              onClick={() => handleQuickHydration(250, 'Warm Ginger Tea')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              +250 ml Ginger Tea
            </button>
          </div>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Today&apos;s Hydration</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {todayFluid} ml
            </span>
            <span className="text-xs text-slate-500 tabular-nums">/ {fluidGoal} ml</span>
          </div>
          <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-700 rounded-full transition-all"
              style={{ width: `${fluidPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">{fluidPct}% of daily goal</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Meals Recorded ({range})</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {analytics?.kpis.totalMeals ?? 0}
            </span>
            <span className="text-xs text-slate-500">entries</span>
          </div>
          <p className="mt-3 text-xs text-slate-600 tabular-nums">
            Avg daily fluid: {analytics?.kpis.avgDailyFluidMl ?? 0} ml
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Average Appetite</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {analytics?.kpis.avgAppetite !== null && analytics?.kpis.avgAppetite !== undefined
                ? analytics.kpis.avgAppetite.toFixed(1)
                : '—'}
            </span>
            <span className="text-xs text-slate-500">/ 5.0 scale</span>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Higher scores indicate steadier interest in eating
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Meal Tolerance Avg</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {analytics?.kpis.avgTolerance !== null && analytics?.kpis.avgTolerance !== undefined
                ? analytics.kpis.avgTolerance.toFixed(1)
                : '—'}
            </span>
            <span className="text-xs text-slate-500">/ 5.0 comfort</span>
          </div>
          <p className="mt-3 text-xs text-slate-600 tabular-nums">
            {analytics?.kpis.totalSymptoms ?? 0} symptom check-ins in period
          </p>
        </div>
      </div>

      {/* Quick-Entry Symptom Logging Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Quick-Entry Symptom Check-In</h3>
            <p className="text-xs text-slate-500">
              One-tap recording for common treatment nutrition experiences.
            </p>
          </div>
          {feedback && (
            <span className="text-xs font-medium text-teal-800">{feedback}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {quickSymptoms.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={quickBusy === item.id}
              onClick={() => handleQuickSymptom(item)}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {quickBusy === item.id ? 'Logging...' : `+ ${item.name}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onOpenLogTab('symptoms')}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-colors whitespace-nowrap shrink-0"
          >
            Detailed Symptom & Appetite Log
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hydration & Meal Frequency Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Hydration Volume & Meal Frequency
              </h3>
              <p className="text-xs text-slate-500">
                Daily fluid ml compared to {fluidGoal} ml target
              </p>
            </div>
            <Droplets className="w-4 h-4 text-teal-700 shrink-0" />
          </div>

          {timeline.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              No hydration timeline records in this range.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-48 flex items-end gap-1.5 pt-4 border-b border-slate-100 relative">
                {timeline.map((day) => {
                  const pct = Math.max(4, Math.round((day.fluidMl / maxFluidInChart) * 100));
                  const isHovered = hoveredDay === day.date;
                  return (
                    <div
                      key={day.date}
                      onMouseEnter={() => setHoveredDay(day.date)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                    >
                      {isHovered && (
                        <div className="absolute -top-2 z-10 bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-sm whitespace-nowrap tabular-nums">
                          {day.date.slice(5)}: {day.fluidMl} ml · {day.mealCount} meals
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t transition-colors ${
                          day.fluidMl >= fluidGoal
                            ? 'bg-teal-700'
                            : day.fluidMl > 0
                              ? 'bg-teal-600/65'
                              : 'bg-slate-200'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                <span>{timeline[0]?.date.slice(5)}</span>
                <span>Target: {fluidGoal} ml/day</span>
                <span>{timeline[timeline.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Appetite & Symptom Severity Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Appetite & Symptom Severity Trends
              </h3>
              <p className="text-xs text-slate-500">
                Teal line: Appetite (1–5) · Amber dashed: Avg Symptom Severity (1–5)
              </p>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              No symptom or appetite records in this range.
            </div>
          ) : (
            <div className="space-y-3">
              <svg viewBox="0 0 420 160" className="w-full h-48 overflow-visible">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const y = 140 - ((lvl - 1) / 4) * 120;
                  return (
                    <g key={lvl}>
                      <line x1={28} y1={y} x2={410} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                      <text x={8} y={y + 4} fontSize="10" fill="#64748B" className="font-mono">
                        {lvl}
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const appetitePts = timeline
                    .map((d, i) => {
                      if (d.avgAppetite === null) return null;
                      const x = 32 + (i / Math.max(1, timeline.length - 1)) * 370;
                      const y = 140 - ((d.avgAppetite - 1) / 4) * 120;
                      return { x, y, val: d.avgAppetite };
                    })
                    .filter((p): p is { x: number; y: number; val: number } => p !== null);

                  const sevPts = timeline
                    .map((d, i) => {
                      if (d.avgSeverity === null) return null;
                      const x = 32 + (i / Math.max(1, timeline.length - 1)) * 370;
                      const y = 140 - ((d.avgSeverity - 1) / 4) * 120;
                      return { x, y, val: d.avgSeverity };
                    })
                    .filter((p): p is { x: number; y: number; val: number } => p !== null);

                  return (
                    <>
                      {appetitePts.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#0F766E"
                          strokeWidth="2.5"
                          points={appetitePts.map((p) => `${p.x},${p.y}`).join(' ')}
                        />
                      )}
                      {sevPts.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#D97706"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          points={sevPts.map((p) => `${p.x},${p.y}`).join(' ')}
                        />
                      )}
                      {appetitePts.map((p, idx) => (
                        <circle key={`a-${idx}`} cx={p.x} cy={p.y} r="4" fill="#0F766E" />
                      ))}
                      {sevPts.map((p, idx) => (
                        <circle key={`s-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#D97706" />
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Top symptom: {analytics?.symptomTrends[0]?.name || 'None logged'}</span>
                <span className="tabular-nums">
                  {analytics?.symptomTrends[0]
                    ? `${analytics.symptomTrends[0].count}x · avg ${analytics.symptomTrends[0].avgSeverity}/5`
                    : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Observational Food Tolerance Analysis & Consolidated Daily Journal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Observational Food Tolerance Patterns
          </h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            {analytics?.disclaimer ||
              'Observational correlations across your logged meals; does not claim medical causation.'}
          </p>

          {!analytics || analytics.tolerancePatterns.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Log meals with tolerance ratings to surface ingredient patterns.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {analytics.tolerancePatterns.slice(0, 7).map((pat) => (
                <div key={pat.ingredient} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">
                      {pat.ingredient}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{pat.observationalNote}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        pat.classification === 'well-tolerated'
                          ? 'text-emerald-700'
                          : pat.classification === 'watch'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {pat.classification === 'well-tolerated'
                        ? 'Well Tolerated'
                        : pat.classification === 'watch'
                          ? 'Warrants Attention'
                          : 'Mixed Comfort'}
                    </span>
                    <p className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                      {pat.avgRating.toFixed(1)}/5 ({pat.occurrences}x)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consolidated Daily Nutrition Journal */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Consolidated Daily Nutrition Journal
              </h3>
              <p className="text-xs text-slate-500">
                Chronological feed filtered by your Logging Preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLogTab('meals')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Full Log History
            </button>
          </div>

          {journalItems.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600">No entries visible for your current preferences.</p>
              <button
                type="button"
                onClick={() => onOpenLogTab('meals')}
                className="mt-3 px-4 py-2 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800"
              >
                Log First Entry
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {journalItems.map((entry) => {
                const timeStr = new Date(entry.ts).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                if (entry.kind === 'meal') {
                  const m = entry.item;
                  const isEditing = editingMealId === m.id;
                  return (
                    <div key={m.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-teal-800 capitalize">{m.mealType}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{timeStr}</span>
                          {prefs.tolerances && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                Tolerance {m.toleranceRating}/5
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{m.foodName}</p>
                        {isEditing ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={editPortion}
                              onChange={(e) => setEditPortion(e.target.value)}
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                              placeholder="Portion"
                            />
                            <select
                              value={editRating}
                              onChange={(e) => setEditRating(Number(e.target.value))}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  Tolerance {n}/5
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => saveMealEdit(m.id)}
                              aria-label="Save meal edit"
                              className="p-1.5 rounded bg-teal-700 text-white hover:bg-teal-800"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMealId(null)}
                              aria-label="Cancel meal edit"
                              className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-600">
                            {m.portion}
                            {m.toleranceNotes ? ` — ${m.toleranceNotes}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMealId(m.id);
                            setEditPortion(m.portion);
                            setEditRating(m.toleranceRating);
                          }}
                          aria-label={`Edit ${m.foodName}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMeal(m.id)}
                          aria-label={`Delete ${m.foodName}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                if (entry.kind === 'hydration') {
                  const h = entry.item;
                  return (
                    <div key={h.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-sky-700">Hydration</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{timeStr}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{h.temperature} temp</span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                          {h.fluidType} — <span className="font-mono tabular-nums">{h.amountMl} ml</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteHydration(h.id)}
                        aria-label={`Delete ${h.fluidType}`}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                const s = entry.item;
                return (
                  <div key={s.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-amber-700">Symptom Check-In</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{timeStr}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">Severity {s.severity}/5</span>
                        {prefs.appetite && typeof s.appetiteScore === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">Appetite {s.appetiteScore}/5</span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">{s.symptomName}</p>
                      {s.notes && <p className="mt-0.5 text-xs text-slate-600">{s.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSymptom(s.id)}
                      aria-label={`Delete ${s.symptomName}`}
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
