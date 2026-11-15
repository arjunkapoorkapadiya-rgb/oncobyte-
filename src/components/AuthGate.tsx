import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api';
import type { UserAccount } from '../types/oncobyte';

interface AuthGateProps {
  onAuthenticated: (user: UserAccount) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('elena.vance@oncobyte.org');
  const [password, setPassword] = useState('OncoCare2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login' ? { email, password } : { name, email, password };
      const res = await apiRequest<{ token: string; user: UserAccount }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserAccount }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'elena.vance@oncobyte.org',
          password: 'OncoCare2026!',
        }),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-teal-700 tracking-wide">
              Oncology Nutrition Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 text-balance">
              OncoByte
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A calm, structured nutrition journal for tracking daily meals, fluid intake,
              treatment symptoms, and food tolerances—paired with tolerance-matched recipes and
              clinician-ready PDF summaries.
            </p>

            <dl className="mt-8 space-y-4 border-t border-slate-100 pt-6 text-sm">
              <div>
                <dt className="font-semibold text-slate-900">Observational Tolerance Tracking</dt>
                <dd className="mt-0.5 text-slate-600">
                  Spot recurring food comfort patterns without calorie-counting pressure or medical
                  causation claims.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Clinician PDF Summaries</dt>
                <dd className="mt-0.5 text-slate-600">
                  Generate validated, checksum-verified nutrition and symptom reports for oncology
                  and dietitian visits.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Independent REST Backend</dt>
                <dd className="mt-0.5 text-slate-600">
                  Full API support for web and mobile clients with session authentication and
                  caregiver access controls.
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              General nutrition information in OncoByte is for personal tracking only and does not
              replace individualized guidance from your oncologist or Registered Dietitian.
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            {mode === 'login' ? 'Sign in to your journal' : 'Create a patient account'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login'
              ? 'Use the seeded patient record below or enter your credentials.'
              : 'Your meal, hydration, and symptom logs are stored privately to your account.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Rivera"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <span>{loading ? 'Signing in...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Continue as Demo Patient (Elena Vance — 14 Days Pre-Logged)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
