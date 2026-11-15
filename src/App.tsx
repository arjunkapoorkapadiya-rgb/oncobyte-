import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { DailyLogView } from './components/DailyLogView';
import { DashboardView } from './components/DashboardView';
import { RecipesView } from './components/RecipesView';
import { ReportsAndCaregiversView } from './components/ReportsAndCaregiversView';
import { SafetyAndUsdaView } from './components/SafetyAndUsdaView';
import { SettingsAndApiView } from './components/SettingsAndApiView';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import type {
  CaregiverGrant,
  DashboardAnalytics,
  FoodSensitivityRecord,
  HydrationEntry,
  MealEntry,
  Recipe,
  RecipeCollection,
  RecipeRecommendation,
  ReportRecord,
  SymptomCatalogItem,
  SymptomEntry,
  UserAccount,
} from './types/oncobyte';

type NavModule =
  | 'overview'
  | 'logging'
  | 'recipes'
  | 'safety'
  | 'reports'
  | 'settings';

const NAV_ITEMS: Array<{ id: NavModule; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview & Journal', icon: Activity },
  { id: 'logging', label: 'Meals, Fluids & Symptoms', icon: ClipboardList },
  { id: 'recipes', label: 'Recipes & Tolerance', icon: BookOpen },
  { id: 'safety', label: 'Food Safety & USDA', icon: ShieldCheck },
  { id: 'reports', label: 'PDF Reports & Caregivers', icon: FileText },
  { id: 'settings', label: 'Preferences & API', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeModule, setActiveModule] = useState<NavModule>('overview');
  const [logSubTab, setLogSubTab] = useState<'meals' | 'hydration' | 'symptoms'>('meals');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [range, setRange] = useState<'7d' | '14d' | '30d'>('14d');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [hydration, setHydration] = useState<HydrationEntry[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [sensitivities, setSensitivities] = useState<FoodSensitivityRecord[]>([]);
  const [catalog, setCatalog] = useState<SymptomCatalogItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverGrant[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(
    async (selectedRange: '7d' | '14d' | '30d' = range) => {
      setDataError(null);
      try {
        const [
          analyticsRes,
          mealsRes,
          hydrationRes,
          symptomsRes,
          sensRes,
          catalogRes,
          recipesRes,
          recsRes,
          colsRes,
          reportsRes,
          cgRes,
        ] = await Promise.all([
          apiRequest<DashboardAnalytics>(`/api/analytics/dashboard?range=${selectedRange}`),
          apiRequest<{ meals: MealEntry[] }>('/api/meals'),
          apiRequest<{ entries: HydrationEntry[] }>('/api/hydration'),
          apiRequest<{ symptoms: SymptomEntry[] }>('/api/symptoms'),
          apiRequest<{ sensitivities: FoodSensitivityRecord[] }>('/api/sensitivities'),
          apiRequest<{ catalog: SymptomCatalogItem[] }>('/api/symptoms/catalog'),
          apiRequest<{ recipes: Recipe[] }>('/api/recipes'),
          apiRequest<{ recommendations: RecipeRecommendation[] }>('/api/recipes/recommendations'),
          apiRequest<{ collections: RecipeCollection[] }>('/api/collections'),
          apiRequest<{ reports: ReportRecord[] }>('/api/reports'),
          apiRequest<{ caregivers: CaregiverGrant[] }>('/api/caregivers'),
        ]);

        setAnalytics(analyticsRes);
        setMeals(mealsRes.meals);
        setHydration(hydrationRes.entries);
        setSymptoms(symptomsRes.symptoms);
        setSensitivities(sensRes.sensitivities);
        setCatalog(catalogRes.catalog);
        setRecipes(recipesRes.recipes);
        setRecommendations(recsRes.recommendations);
        setCollections(colsRes.collections);
        setReports(reportsRes.reports);
        setCaregivers(cgRes.caregivers);
      } catch (err) {
        setDataError(err instanceof Error ? err.message : 'Failed to load OncoByte records.');
      }
    },
    [range]
  );

  useEffect(() => {
    async function restoreSession() {
      const token = getStoredToken();
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const res = await apiRequest<{ user: UserAccount }>('/api/auth/me');
        setUser(res.user);
      } catch {
        setStoredToken(null);
      } finally {
        setBooting(false);
      }
    }
    void restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      void loadWorkspaceData(range);
    }
  }, [user, range, loadWorkspaceData]);

  function handleSignOut() {
    setStoredToken(null);
    setUser(null);
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-600">Loading OncoByte workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        onAuthenticated={(u) => {
          setUser(u);
        }}
      />
    );
  }

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeModule)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            OncoByte
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">{user.name}</p>
            <p className="text-slate-500 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/40 flex">
          <div className="w-72 bg-white h-full border-r border-slate-200 flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="text-lg font-bold text-slate-900 font-display">OncoByte</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left ${
                        active ? 'bg-teal-50 text-teal-900' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">OncoByte</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLogSubTab('meals');
              setActiveModule('logging');
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            New Log Entry
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {dataError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              {dataError}
            </div>
          )}

          {activeModule === 'overview' && (
            <DashboardView
              user={user}
              analytics={analytics}
              meals={meals}
              hydration={hydration}
              symptoms={symptoms}
              catalog={catalog}
              range={range}
              onChangeRange={(r) => setRange(r)}
              onRefresh={() => loadWorkspaceData(range)}
              onOpenLogTab={(tab) => {
                setLogSubTab(tab);
                setActiveModule('logging');
              }}
            />
          )}

          {activeModule === 'logging' && (
            <DailyLogView
              key={logSubTab}
              user={user}
              initialTab={logSubTab}
              meals={meals}
              hydration={hydration}
              symptoms={symptoms}
              sensitivities={sensitivities}
              catalog={catalog}
              onRefresh={() => loadWorkspaceData(range)}
            />
          )}

          {activeModule === 'recipes' && (
            <RecipesView
              recipes={recipes}
              recommendations={recommendations}
              collections={collections}
              onRefresh={() => loadWorkspaceData(range)}
            />
          )}

          {activeModule === 'safety' && <SafetyAndUsdaView />}

          {activeModule === 'reports' && (
            <ReportsAndCaregiversView
              reports={reports}
              caregivers={caregivers}
              onRefresh={() => loadWorkspaceData(range)}
            />
          )}

          {activeModule === 'settings' && (
            <SettingsAndApiView
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                void loadWorkspaceData(range);
              }}
            />
          )}
        </main>

        <footer className="px-4 sm:px-8 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            OncoByte · Personal oncology nutrition tracking is informational and not medical advice.
          </span>
          <span>Discuss dietary adjustments with your oncologist or Registered Dietitian.</span>
        </footer>
      </div>
    </div>
  );
}
