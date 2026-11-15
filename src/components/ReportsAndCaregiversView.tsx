import React, { useState } from 'react';
import { Download, FileCheck2, Share2, Trash2, UserPlus } from 'lucide-react';
import { apiRequest, getStoredToken } from '../lib/api';
import type { CaregiverGrant, ReportCategory, ReportRecord } from '../types/oncobyte';

interface ReportsAndCaregiversViewProps {
  reports: ReportRecord[];
  caregivers: CaregiverGrant[];
  onRefresh: () => Promise<void>;
}

const ALL_CATEGORIES: Array<{ key: ReportCategory; label: string }> = [
  { key: 'meals', label: 'Meals & Portions' },
  { key: 'hydration', label: 'Hydration Intake' },
  { key: 'symptoms', label: 'Symptom Check-Ins' },
  { key: 'appetite', label: 'Appetite Scores' },
  { key: 'tolerances', label: 'Food Tolerance Patterns' },
  { key: 'sensitivities', label: 'Sensitivity Registry' },
];

export const ReportsAndCaregiversView: React.FC<ReportsAndCaregiversViewProps> = ({
  reports,
  caregivers,
  onRefresh,
}) => {
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [title, setTitle] = useState('Oncology Dietitian Visit Summary');
  const [dateRangeStart, setDateRangeStart] = useState(defaultStart);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultEnd);
  const [selectedCats, setSelectedCats] = useState<ReportCategory[]>(
    ALL_CATEGORIES.map((c) => c.key)
  );
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(reports[0] || null);
  const [generating, setGenerating] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Caregiver form
  const [cgName, setCgName] = useState('');
  const [cgEmail, setCgEmail] = useState('');
  const [cgRelationship, setCgRelationship] = useState('Family Caregiver');
  const [cgPerms, setCgPerms] = useState<Array<'read_journal' | 'log_entries' | 'export_reports'>>([
    'read_journal',
  ]);
  const [cgBusy, setCgBusy] = useState(false);

  function toggleCategory(cat: ReportCategory) {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setShareMsg(null);
    try {
      const res = await apiRequest<{ report: ReportRecord }>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          title,
          dateRangeStart,
          dateRangeEnd,
          includedCategories: selectedCats,
        }),
      });
      setActiveReport(res.report);
      await onRefresh();
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadPdf(reportId: string) {
    const token = getStoredToken();
    const url = `/api/reports/${reportId}/pdf?token=${encodeURIComponent(token || '')}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `OncoByte-Report-${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleShareSummary(report: ReportRecord) {
    const summaryText = `${report.title} (${report.dateRangeStart.slice(0, 10)} to ${report.dateRangeEnd.slice(0, 10)})\nMeals: ${report.summary.totalMeals} | Avg Daily Fluid: ${report.summary.avgDailyFluidMl} ml | Avg Appetite: ${report.summary.avgAppetiteScore ?? 'N/A'}/5 | Validation Hash: ${report.validationChecksum}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: report.title, text: summaryText });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(summaryText);
    setShareMsg('Clinical report summary copied to clipboard for care team sharing.');
  }

  async function handleAddCaregiver(e: React.FormEvent) {
    e.preventDefault();
    setCgBusy(true);
    try {
      await apiRequest('/api/caregivers', {
        method: 'POST',
        body: JSON.stringify({
          caregiverName: cgName,
          caregiverEmail: cgEmail,
          relationship: cgRelationship,
          permissions: cgPerms,
        }),
      });
      setCgName('');
      setCgEmail('');
      await onRefresh();
    } finally {
      setCgBusy(false);
    }
  }

  async function toggleCaregiverActive(grant: CaregiverGrant) {
    await apiRequest(`/api/caregivers/${grant.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !grant.active }),
    });
    await onRefresh();
  }

  async function revokeCaregiver(id: string) {
    await apiRequest(`/api/caregivers/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  const previewReport = activeReport || reports[0] || null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Clinician PDF Reports & Caregiver Access
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Aggregate validated dietary records into downloadable PDF summaries and manage explicit
          patient-authorized caregiver sharing.
        </p>
      </div>

      {/* PDF Report Builder & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">Configure Clinical Report</h3>
          <form onSubmit={handleGenerateReport} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Report Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 mb-2">Included Record Categories</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CATEGORIES.map((cat) => (
                  <label
                    key={cat.key}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(cat.key)}
                      onChange={() => toggleCategory(cat.key)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={generating || selectedCats.length === 0}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {generating ? 'Aggregating & Validating...' : 'Generate & Preview Report'}
            </button>
          </form>

          {reports.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">Previously Generated</p>
              <div className="space-y-2">
                {reports.slice(0, 4).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      previewReport?.id === r.id
                        ? 'border-teal-700 bg-teal-50/50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-medium block truncate">{r.title}</span>
                    <span className="text-slate-500 font-mono tabular-nums">
                      {r.dateRangeStart.slice(0, 10)} → {r.dateRangeEnd.slice(0, 10)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Report Preview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          {!previewReport ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-600">
                Select a date range and click &ldquo;Generate & Preview Report&rdquo; to build a
                clinician-ready PDF summary.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <p className="text-xs text-teal-800 font-medium">Clinician Summary Preview</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{previewReport.title}</h3>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    Period: {previewReport.dateRangeStart.slice(0, 10)} to{' '}
                    {previewReport.dateRangeEnd.slice(0, 10)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleShareSummary(previewReport)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(previewReport.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {shareMsg && <p className="text-xs font-medium text-teal-700">{shareMsg}</p>}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-500">Meals Logged</p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                    {previewReport.summary.totalMeals}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-500">Avg Fluid / Day</p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                    {previewReport.summary.avgDailyFluidMl} ml
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-500">Avg Appetite</p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                    {previewReport.summary.avgAppetiteScore !== null
                      ? `${previewReport.summary.avgAppetiteScore}/5`
                      : '—'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-500">Avg Tolerance</p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                    {previewReport.summary.avgToleranceRating !== null
                      ? `${previewReport.summary.avgToleranceRating}/5`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 mb-1.5">
                    Well-Tolerated Ingredients (Observational)
                  </p>
                  {previewReport.summary.wellToleratedFoods.length === 0 ? (
                    <p className="text-slate-500">None flagged in this range.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {previewReport.summary.wellToleratedFoods.map((f) => (
                        <li key={f.ingredient} className="capitalize tabular-nums">
                          {f.ingredient} — {f.avgRating}/5 ({f.count}x)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="font-semibold text-slate-900 mb-1.5">
                    Top Logged Symptoms
                  </p>
                  {previewReport.summary.topSymptoms.length === 0 ? (
                    <p className="text-slate-500">No symptoms logged in this range.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {previewReport.summary.topSymptoms.map((s) => (
                        <li key={s.name} className="tabular-nums">
                          {s.name} — {s.count}x (avg severity {s.avgSeverity}/5)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Accuracy Verified · Checksum{' '}
                    <span className="font-mono text-slate-700">
                      {previewReport.validationChecksum}
                    </span>
                  </span>
                </div>
                <span className="font-mono tabular-nums">
                  {previewReport.recordCounts.meals}M / {previewReport.recordCounts.hydration}H /{' '}
                  {previewReport.recordCounts.symptoms}S
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Caregiver Access Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <h3 className="text-base font-semibold text-slate-900">
              Caregiver Sharing & Access Control
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Explicit patient-authorized sharing. You control whether caregivers can read logs,
              record entries on your behalf, or export clinician PDF reports.
            </p>

            <form onSubmit={handleAddCaregiver} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={cgName}
                onChange={(e) => setCgName(e.target.value)}
                placeholder="Caregiver Full Name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                value={cgEmail}
                onChange={(e) => setCgEmail(e.target.value)}
                placeholder="Caregiver Email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={cgRelationship}
                onChange={(e) => setCgRelationship(e.target.value)}
                placeholder="Relationship (e.g., Spouse, Daughter)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-medium text-slate-700">Authorized Permissions</p>
                {(
                  [
                    ['read_journal', 'View daily nutrition & symptom journal'],
                    ['log_entries', 'Log meals & hydration on my behalf'],
                    ['export_reports', 'Export clinician PDF summaries'],
                  ] as const
                ).map(([perm, label]) => (
                  <label key={perm} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={cgPerms.includes(perm)}
                      onChange={() =>
                        setCgPerms((prev) =>
                          prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
                        )
                      }
                      className="rounded border-slate-300 text-teal-700"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={cgBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{cgBusy ? 'Authorizing...' : 'Grant Caregiver Access'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              Authorized Caregivers ({caregivers.length})
            </h4>
            <div className="divide-y divide-slate-100">
              {caregivers.length === 0 ? (
                <p className="py-6 text-xs text-slate-500">
                  No caregivers authorized. Your journal remains private to your account.
                </p>
              ) : (
                caregivers.map((g) => (
                  <div key={g.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{g.caregiverName}</p>
                        <span
                          className={`text-xs font-medium ${
                            g.active ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {g.active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {g.caregiverEmail} · {g.relationship}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Permissions: {g.permissions.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleCaregiverActive(g)}
                        className="px-2.5 py-1 text-xs rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        {g.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeCaregiver(g.id)}
                        className="p-1.5 text-slate-400 hover:text-red-700"
                        aria-label="Revoke caregiver access"
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
      </section>
    </div>
  );
};
