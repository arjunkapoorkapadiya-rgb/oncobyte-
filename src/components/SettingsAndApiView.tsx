import React, { useEffect, useState } from 'react';
import { Play, Save } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { ApiEndpointDoc, UserAccount } from '../types/oncobyte';

interface SettingsAndApiViewProps {
  user: UserAccount;
  onUserUpdated: (user: UserAccount) => void;
}

export const SettingsAndApiView: React.FC<SettingsAndApiViewProps> = ({
  user,
  onUserUpdated,
}) => {
  const [name, setName] = useState(user.name);
  const [treatmentPhase, setTreatmentPhase] = useState(user.profile.treatmentPhase);
  const [fluidGoal, setFluidGoal] = useState(user.profile.dailyFluidGoalMl);
  const [restrictions, setRestrictions] = useState(user.profile.dietaryRestrictions.join(', '));
  const [allergies, setAllergies] = useState(user.profile.allergies.join(', '));
  const [clinicianName, setClinicianName] = useState(user.profile.clinicianName || '');
  const [dietitianName, setDietitianName] = useState(user.profile.dietitianName || '');
  const [prefs, setPrefs] = useState(user.profile.loggingPreferences);
  const [reminders, setReminders] = useState(user.profile.reminders);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [endpoints, setEndpoints] = useState<ApiEndpointDoc[]>([]);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testingPath, setTestingPath] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ endpoints: ApiEndpointDoc[] }>('/api/docs/endpoints').then((res) =>
      setEndpoints(res.endpoints)
    );
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);
    try {
      const res = await apiRequest<{ user: UserAccount }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          profile: {
            treatmentPhase,
            dailyFluidGoalMl: Number(fluidGoal),
            dietaryRestrictions: restrictions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            allergies: allergies
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            clinicianName,
            dietitianName,
            loggingPreferences: prefs,
            reminders,
          },
        }),
      });
      onUserUpdated(res.user);
      setSavedNotice('Profile, logging preferences, and reminder settings saved.');
    } finally {
      setSaving(false);
    }
  }

  async function runEndpointTest(path: string) {
    setTestingPath(path);
    try {
      const resolvedPath = path.includes(':id') ? '/api/health' : path;
      const data = await apiRequest<unknown>(resolvedPath);
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setTestOutput(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }, null, 2)
      );
    } finally {
      setTestingPath(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Profile Preferences, Reminders & Backend API Reference
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Customize your daily journal categories, hydration targets, reminders, and inspect
          OncoByte&apos;s independent REST API endpoints for mobile client integration.
        </p>
      </div>

      {/* Patient Profile & Preferences */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Treatment Phase
            </label>
            <input
              type="text"
              value={treatmentPhase}
              onChange={(e) => setTreatmentPhase(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Dietary Restrictions (comma-separated)
            </label>
            <input
              type="text"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Food Allergies (comma-separated)
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Daily Fluid Goal (ml)
            </label>
            <input
              type="number"
              min={500}
              max={4500}
              step={50}
              value={fluidGoal}
              onChange={(e) => setFluidGoal(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Oncologist / Registered Dietitian
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={clinicianName}
                onChange={(e) => setClinicianName(e.target.value)}
                placeholder="Oncologist"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={dietitianName}
                onChange={(e) => setDietitianName(e.target.value)}
                placeholder="Dietitian (RDN)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Daily Journal Logging Categories
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Choose which categories appear in your consolidated Daily Nutrition Journal.
            </p>
            <div className="space-y-2">
              {(
                [
                  ['meals', 'Meals & Snacks'],
                  ['hydration', 'Fluid & Hydration Logs'],
                  ['symptoms', 'Symptom Check-Ins'],
                  ['appetite', 'Appetite Ratings'],
                  ['tolerances', 'Food Tolerance Ratings'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Optional Meal & Hydration Reminders
            </h3>
            <div className="space-y-3 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reminders.mealRemindersEnabled}
                  onChange={() =>
                    setReminders((r) => ({
                      ...r,
                      mealRemindersEnabled: !r.mealRemindersEnabled,
                    }))
                  }
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Enable gentle meal logging prompts</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reminders.hydrationRemindersEnabled}
                  onChange={() =>
                    setReminders((r) => ({
                      ...r,
                      hydrationRemindersEnabled: !r.hydrationRemindersEnabled,
                    }))
                  }
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Enable fluid sip reminders</span>
              </label>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Hydration reminder cadence (minutes)
                </label>
                <select
                  value={reminders.hydrationIntervalMinutes}
                  onChange={(e) =>
                    setReminders((r) => ({
                      ...r,
                      hydrationIntervalMinutes: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                >
                  <option value={60}>Every 60 minutes</option>
                  <option value={90}>Every 90 minutes</option>
                  <option value={120}>Every 120 minutes</option>
                  <option value={180}>Every 180 minutes</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-teal-700">{savedNotice || ''}</span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>

      {/* OncoByte Backend REST API Documentation & Live Runner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            OncoByte Independent Backend API Reference
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            REST endpoints backing web, React Native, and iOS clients. Protected routes accept{' '}
            <code className="font-mono text-slate-800">Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Method</th>
                <th className="py-2 px-3 font-medium">Endpoint</th>
                <th className="py-2 px-3 font-medium">Auth</th>
                <th className="py-2 px-3 font-medium">Purpose</th>
                <th className="py-2 pl-3 font-medium text-right">Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {endpoints.map((ep) => (
                <tr key={`${ep.method}-${ep.path}`} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono font-semibold text-teal-800">{ep.method}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-900">{ep.path}</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {ep.auth ? 'Bearer Token' : 'Public'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{ep.summary}</td>
                  <td className="py-2.5 pl-3 text-right">
                    {ep.method === 'GET' && !ep.path.includes(':id') && (
                      <button
                        type="button"
                        onClick={() => runEndpointTest(ep.path)}
                        disabled={testingPath === ep.path}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        <Play className="w-3 h-3" />
                        <span>{testingPath === ep.path ? '...' : 'Run'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {testOutput && (
          <div className="mt-5">
            <p className="text-xs font-medium text-slate-700 mb-1.5">Live API Response Preview</p>
            <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-64">
              {testOutput}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
