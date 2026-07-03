// filename: frontend/src/App.tsx
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios, { AxiosInstance } from 'axios';
import ReactMarkdown from 'react-markdown';
import { useDropzone } from 'react-dropzone';
import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  Cog,
  Database,
  FileUp,
  LayoutDashboard,
  MessageSquare,
  PlayCircle,
  Moon,
  PanelLeft,
  PiggyBank,
  PlusCircle,
  Sparkles,
  Sun,
  Tags,
  Target,
  Trash2,
  UploadCloud,
  Wallet,
  WifiOff,
  Briefcase,
  User,
  LogOut,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
} from 'lucide-react';

/* ===================== Types ===================== */

type ThemeMode = 'dark' | 'light';

type AppSettings = {
  apiBaseUrl: string;
  theme: ThemeMode;
  sidebarCollapsed: boolean;
};

type Metrics = {
  processedFiles: number;
  aiQueries: number;
};

type ApiErr = { message: string; status?: number; kind?: 'network' | 'http' | 'unknown' };

type Category = {
  id: string;
  user_id: string;
  name: string;
  icon?: string | null;
  created_at: string;
  updated_at: string;
};

type Transaction = {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category_id?: string | null;
  payment_method: string;
  description?: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

type PersonalOverview = {
  range: { from: string; to: string };
  currency: string;
  total_income: number;
  total_expenses: number;
  savings: number;
  balance: number;
  trend: { day: string; income: number; expense: number }[];
  top_categories: { category: string; icon?: string; total: number }[];
};

type BudgetRow = {
  id: string;
  user_id: string;
  month: string;
  category_id: string;
  currency: string;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
  category_name: string;
  icon: string;
  spent: number;
  remaining: number;
};

type Goal = {
  id: string;
  user_id: string;
  title: string;
  currency: string;
  target_amount: number;
  saved_amount: number;
  deadline?: string | null;
  created_at: string;
  updated_at: string;
};

type AnalysisLog = {
  id: string;
  filename: string;
  created_at: string;
  question: string;
  status: 'processed' | 'error';
  error?: string;

  answer?: string;
  extracted_fields?: any;
  vision_analysis?: any;
  context_used?: string[];
  document_markdown?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

/* ===================== Constants ===================== */

const ENV_API = (process.env.REACT_APP_API_BASE_URL as string | undefined) || '';
const DEFAULT_API = ENV_API || 'http://127.0.0.1:8000';

const STORAGE_KEYS = {
  settings: 'montera.settings.v4',
  metrics: 'montera.metrics.v4',
  analyses: 'montera.analyses.v4',
  conversations: 'montera.conversations.v4',
  activeUser: 'montera.activeUser.v4',
  activePersona: 'montera.activePersona.v4',
  recentUsers: 'montera.recentUsers.v4',
};

const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: DEFAULT_API,
  theme: 'dark',
  sidebarCollapsed: false,
};

const DEFAULT_METRICS: Metrics = { processedFiles: 0, aiQueries: 0 };

const SUGGESTED_PROMPTS = [
  'Summarize this report',
  'Find unusual expenses',
  'What are the biggest costs?',
  'Identify financial risks',
];

/* ===================== Helpers ===================== */

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthKey(d: Date) {
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${String(m).padStart(2, '0')}`;
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pct(n: number) {
  if (!isFinite(n)) return '0%';
  return `${(n * 100).toFixed(1)}%`;
}

function formatMoneyBDT(n: number) {
  try {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function numFromMoneyLike(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v);
  const cleaned = s.replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function axiosToApiErr(e: any): ApiErr {
  const status = e?.response?.status as number | undefined;
  const message =
    e?.response?.data?.error ||
    e?.response?.data?.detail ||
    e?.message ||
    'Request failed';

  if (e?.request && !e?.response) {
    return {
      kind: 'network',
      message:
        'Network Error: cannot reach API. Ensure backend is running and API Base URL is correct (Settings).',
    };
  }
  if (status) return { kind: 'http', status, message };
  return { kind: 'unknown', message };
}

function createApi(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: 20000 });

  instance.interceptors.request.use(
    (config) => {
      const loggedEmail = sessionStorage.getItem('montera.loggedEmail') || 'local';
      const activeUser = localStorage.getItem('montera.activeUser.v4') || 'local';
      const compositeUserId = `${loggedEmail}:${activeUser}`;
      
      if (config.method === 'get' || config.method === 'delete') {
        config.params = {
          user_id: compositeUserId,
          ...config.params,
        };
      }

      if (config.method === 'post' || config.method === 'put') {
        if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
          config.data = {
            user_id: compositeUserId,
            ...config.data,
          };
        } else if (!config.data) {
          config.data = { user_id: compositeUserId };
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return instance;
}

async function healthOk(baseURL: string): Promise<boolean> {
  try {
    const api = axios.create({ baseURL, timeout: 2500 });
    await api.get('/health');
    return true;
  } catch {
    return false;
  }
}

/* ===================== Demo Login Portal ===================== */

function DemoLoginPortal({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState('demo@montera.ai');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    onLogin(email);
  };

  return (
    <div className="portalBg">
      <div className="portalGlow portalGlow1"></div>
      <div className="portalGlow portalGlow2"></div>

      <div className="portalCard">
        <div>
          <div className="portalHeader">
            <div className="portalLogo">M</div>
            <h1 className="portalTitle">Montera</h1>
            <p className="portalSubtitle">SaaS Demo Portal Login</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="formLabel">Email Address</label>
              <input
                type="email"
                className="input portalInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="formLabel">Password</label>
              <input
                type="password"
                className="input portalInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: 12, 
              padding: '10px 14px', 
              fontSize: 12, 
              color: '#9CA3AF', 
              textAlign: 'center' 
            }}>
              💡 <strong>SaaS Sandbox Access:</strong><br />
              Enter any valid email and password (4+ chars) to explore the system!
            </div>

            <button type="submit" className="btn btnPrimary portalSubmitBtn">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ===================== Workspace Portal ===================== */

function WorkspacePortal({
  onConnect,
  onLogout,
  recentUsers,
}: {
  onConnect: (userId: string, persona: 'business' | 'personal') => void;
  onLogout: () => void;
  recentUsers: string[];
}) {
  const [userId, setUserId] = useState('local');
  const [persona, setPersona] = useState<'business' | 'personal'>('business');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    onConnect(userId.trim().toLowerCase(), persona);
  };

  return (
    <div className="portalBg">
      {/* Floating ambient glow effects */}
      <div className="portalGlow portalGlow1"></div>
      <div className="portalGlow portalGlow2"></div>

      <div className="portalCard">
        <div>
          <div className="portalHeader">
            <div className="portalLogo">M</div>
            <h1 className="portalTitle">Montera</h1>
            <p className="portalSubtitle">AI Financial Analyst + Personal Tracker</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="formLabel">Workspace / User ID</label>
              <input
                type="text"
                className="input portalInput"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter workspace name e.g. local, john..."
                required
              />
            </div>

            {recentUsers && recentUsers.length > 0 && (
              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Recent Workspaces</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {recentUsers.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className="recentUserBtn"
                      onClick={() => setUserId(u)}
                    >
                      <Users size={12} />
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="formLabel">Choose Workspace Persona</label>
              <div className="personaGrid">
                <div
                  className={`personaCard ${persona === 'business' ? 'active' : ''}`}
                  onClick={() => setPersona('business')}
                >
                  <Briefcase size={24} className="personaIcon" />
                  <div className="personaMeta">
                    <strong>Business, Freelance & Auditing AI</strong>
                    <span>For Freelancers, Owners, Bookkeepers & Analysts. Ingest invoices, parse statements, and run AI audits.</span>
                  </div>
                </div>

                <div
                  className={`personaCard ${persona === 'personal' ? 'active' : ''}`}
                  onClick={() => setPersona('personal')}
                >
                  <User size={24} className="personaIcon" />
                  <div className="personaMeta">
                    <strong>Personal Finance Tracker</strong>
                    <span>For household tracking. Categories, transactions, budgets, and savings goals.</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="submit" className="btn btnPrimary portalSubmitBtn" style={{ flex: 2, margin: 0 }}>
                Access Workspace
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={onLogout} 
                style={{ flex: 1, margin: 0, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}
              >
                Log Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ===================== App Root ===================== */

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

/* ===================== App Shell ===================== */

function AppShell() {
  const routeLocation = useLocation();
  const nav = useNavigate();

  const [settings, setSettings] = useState<AppSettings>(() =>
    safeParse(localStorage.getItem(STORAGE_KEYS.settings), DEFAULT_SETTINGS)
  );
  const [metrics, setMetrics] = useState<Metrics>(() => {
    const email = sessionStorage.getItem('montera.loggedEmail') || '';
    if (email) {
      return safeParse(localStorage.getItem(`montera.metrics.${email}.v4`), DEFAULT_METRICS);
    }
    return safeParse(localStorage.getItem(STORAGE_KEYS.metrics), DEFAULT_METRICS);
  });
  const [analyses, setAnalyses] = useState<AnalysisLog[]>(() => {
    const email = sessionStorage.getItem('montera.loggedEmail') || '';
    if (email) {
      return safeParse(localStorage.getItem(`montera.analyses.${email}.v4`), []);
    }
    return safeParse(localStorage.getItem(STORAGE_KEYS.analyses), []);
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const email = sessionStorage.getItem('montera.loggedEmail') || '';
    if (email) {
      return safeParse(localStorage.getItem(`montera.conversations.${email}.v4`), []);
    }
    return safeParse(localStorage.getItem(STORAGE_KEYS.conversations), []);
  });

  const [activeUser, setActiveUser] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEYS.activeUser) || ''
  );
  const [activePersona, setActivePersona] = useState<'business' | 'personal'>(() =>
    (localStorage.getItem(STORAGE_KEYS.activePersona) as 'business' | 'personal') || 'business'
  );
  const [recentUsers, setRecentUsers] = useState<string[]>(['local']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    sessionStorage.getItem('montera.isDemoLoggedIn') === 'true'
  );
  const [loggedEmail, setLoggedEmail] = useState<string>(() =>
    sessionStorage.getItem('montera.loggedEmail') || ''
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeUser, activeUser);
  }, [activeUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activePersona, activePersona);
  }, [activePersona]);

  useEffect(() => {
    if (loggedEmail) {
      const key = `montera.recentUsers.${loggedEmail}.v4`;
      setRecentUsers(safeParse(localStorage.getItem(key), ['local']));
    } else {
      setRecentUsers(['local']);
    }
  }, [loggedEmail]);

  const addRecentUser = useCallback((user: string) => {
    if (!user || user.trim() === '') return;
    setRecentUsers(prev => {
      const next = [user, ...prev.filter(u => u !== user)].slice(0, 5);
      if (loggedEmail) {
        localStorage.setItem(`montera.recentUsers.${loggedEmail}.v4`, JSON.stringify(next));
      } else {
        localStorage.setItem(STORAGE_KEYS.recentUsers, JSON.stringify(next));
      }
      return next;
    });
  }, [loggedEmail]);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', settings.theme === 'dark');
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  const prevEmailRef = useRef(loggedEmail);

  useEffect(() => {
    // If the active email changed, load the new email's data instead of writing old state to the new key
    if (prevEmailRef.current !== loggedEmail) {
      if (loggedEmail) {
        setMetrics(safeParse(localStorage.getItem(`montera.metrics.${loggedEmail}.v4`), DEFAULT_METRICS));
        setAnalyses(safeParse(localStorage.getItem(`montera.analyses.${loggedEmail}.v4`), []));
        setConversations(safeParse(localStorage.getItem(`montera.conversations.${loggedEmail}.v4`), []));
      } else {
        setMetrics(DEFAULT_METRICS);
        setAnalyses([]);
        setConversations([]);
      }
      prevEmailRef.current = loggedEmail;
      return;
    }

    // Standard state updates - write to active email's localStorage keys
    if (loggedEmail) {
      localStorage.setItem(`montera.metrics.${loggedEmail}.v4`, JSON.stringify(metrics));
      localStorage.setItem(`montera.analyses.${loggedEmail}.v4`, JSON.stringify(analyses));
      localStorage.setItem(`montera.conversations.${loggedEmail}.v4`, JSON.stringify(conversations));
    }
  }, [loggedEmail, metrics, analyses, conversations]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [routeLocation.pathname]);

  // API probe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setApiOk(null);
      const ok = await healthOk(settings.apiBaseUrl);
      if (!cancelled) setApiOk(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.apiBaseUrl]);

  const meta = useMemo(() => {
    const map: Record<string, { title: string; subtitle: string }> = {
      '/': { title: 'Landing', subtitle: 'Your AI Financial Analyst + Personal Finance' },
      '/business/dashboard': { title: 'Business Dashboard', subtitle: 'Revenue, expenses, cash-flow & forecast' },
      '/upload': { title: 'Upload & Analyze', subtitle: 'Upload a PDF/image and ask a question' },
      '/chat': { title: 'AI Chat', subtitle: 'Iterative Q&A (file re-uploaded per message)' },
      '/library': { title: 'Library', subtitle: 'Saved AI analysis history (local)' },
      '/insights': { title: 'Insights', subtitle: 'Charts derived from AI + transactions' },

      '/personal/dashboard': { title: 'Personal Dashboard', subtitle: 'Income, expenses, savings, trends' },
      '/personal/transactions': { title: 'Transactions', subtitle: 'Add and manage transactions' },
      '/personal/reports': { title: 'Reports', subtitle: 'Category breakdown + trends' },
      '/personal/categories': { title: 'Categories', subtitle: 'Manage categories' },
      '/personal/budgets': { title: 'Budgets', subtitle: 'Monthly budgets + progress' },
      '/personal/goals': { title: 'Savings Goals', subtitle: 'Create goals and track progress' },

      '/settings': { title: 'Settings', subtitle: 'API URL, theme, local data' },
    };
    return map[routeLocation.pathname] || { title: 'Montera', subtitle: 'Fintech AI workspace' };
  }, [routeLocation.pathname]);

  const shellClass = `appShell ${settings.sidebarCollapsed ? 'sidebarCollapsed' : ''}`;

  if (!isAuthenticated) {
    return (
      <DemoLoginPortal
        onLogin={(email) => {
          setIsAuthenticated(true);
          sessionStorage.setItem('montera.isDemoLoggedIn', 'true');
          sessionStorage.setItem('montera.loggedEmail', email);
          setLoggedEmail(email);
        }}
      />
    );
  }

  if (!activeUser) {
    return (
      <WorkspacePortal
        recentUsers={recentUsers}
        onConnect={(user, persona) => {
          setActiveUser(user);
          setActivePersona(persona);
          addRecentUser(user);
          if (persona === 'business') {
            nav('/business/dashboard');
          } else {
            nav('/personal/dashboard');
          }
        }}
        onLogout={() => {
          setIsAuthenticated(false);
          setLoggedEmail('');
          setMetrics(DEFAULT_METRICS);
          setAnalyses([]);
          setConversations([]);
          sessionStorage.removeItem('montera.isDemoLoggedIn');
          sessionStorage.removeItem('montera.loggedEmail');
          nav('/');
        }}
      />
    );
  }

  return (
    <div className={shellClass}>
      {sidebarOpen && <div className="mobileBackdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebarOpen' : ''}`}>
        <div className="brand" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
          <div className="logoMark">M</div>
          {!settings.sidebarCollapsed && (
            <div className="brandText">
              <strong>Montera</strong>
              <span>AI Financial Analyst</span>
            </div>
          )}
        </div>

        {/* Workspace Card Section */}
        {!settings.sidebarCollapsed ? (
          <div className="activeWorkspaceCard">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="workspaceAvatar">
                {activePersona === 'business' ? <Briefcase size={16} /> : <User size={16} />}
              </div>
              <div className="workspaceMeta">
                <span className="workspaceLabel">Active Workspace</span>
                <strong className="workspaceName" title={activeUser}>{activeUser}</strong>
              </div>
            </div>
            
            <div className="workspaceActions">
              <button 
                className="workspaceActionBtn" 
                onClick={() => {
                  const nextPersona = activePersona === 'business' ? 'personal' : 'business';
                  setActivePersona(nextPersona);
                  nav(nextPersona === 'business' ? '/business/dashboard' : '/personal/dashboard');
                }}
              >
                Switch to {activePersona === 'business' ? 'Personal Tracker' : 'AI Auditing'}
              </button>
              <button 
                className="workspaceLogoutBtn" 
                onClick={() => {
                  setActiveUser('');
                  setIsAuthenticated(false);
                  setLoggedEmail('');
                  sessionStorage.removeItem('montera.isDemoLoggedIn');
                  sessionStorage.removeItem('montera.loggedEmail');
                  nav('/');
                }}
                title="Exit Workspace"
              >
                <LogOut size={12} /> Exit
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div 
              className="workspaceAvatar" 
              onClick={() => {
                const nextPersona = activePersona === 'business' ? 'personal' : 'business';
                setActivePersona(nextPersona);
                nav(nextPersona === 'business' ? '/business/dashboard' : '/personal/dashboard');
              }}
              style={{ cursor: 'pointer' }}
              title={`Switch to ${activePersona === 'business' ? 'Personal' : 'Business'} Persona`}
            >
              {activePersona === 'business' ? <Briefcase size={16} /> : <User size={16} />}
            </div>
            <button 
              className="sidebarMiniBtn"
              onClick={() => {
                setActiveUser('');
                nav('/');
              }}
              title="Logout"
              style={{ padding: 4, height: 26, width: 26 }}
            >
              <LogOut size={12} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 12 }}>
          {activePersona === 'business' && (
            <>
              {!settings.sidebarCollapsed && (
                <div style={{ padding: '6px 10px', fontSize: 11, letterSpacing: 0.6, opacity: 0.8 }}>
                  AI DOCS & AUDITING
                </div>
              )}
              <nav className="nav">
                <SideLink to="/business/dashboard" icon={<LayoutDashboard className="navIcon" />} label="Dashboard" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/upload" icon={<FileUp className="navIcon" />} label="Upload" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/chat" icon={<MessageSquare className="navIcon" />} label="AI Chat" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/library" icon={<Database className="navIcon" />} label="Library" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/insights" icon={<BarChart3 className="navIcon" />} label="Insights" collapsed={settings.sidebarCollapsed} />
              </nav>
            </>
          )}

          {activePersona === 'personal' && (
            <>
              {!settings.sidebarCollapsed && (
                <div style={{ padding: '6px 10px', fontSize: 11, letterSpacing: 0.6, opacity: 0.8 }}>
                  PERSONAL (TRACKER)
                </div>
              )}
              <nav className="nav">
                <SideLink to="/personal/dashboard" icon={<Wallet className="navIcon" />} label="Dashboard" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/personal/transactions" icon={<PlusCircle className="navIcon" />} label="Transactions" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/personal/reports" icon={<BarChart3 className="navIcon" />} label="Reports" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/personal/categories" icon={<Tags className="navIcon" />} label="Categories" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/personal/budgets" icon={<PiggyBank className="navIcon" />} label="Budgets" collapsed={settings.sidebarCollapsed} />
                <SideLink to="/personal/goals" icon={<Target className="navIcon" />} label="Goals" collapsed={settings.sidebarCollapsed} />
              </nav>
            </>
          )}

          <nav className="nav" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <SideLink to="/settings" icon={<Cog className="navIcon" />} label="Settings" collapsed={settings.sidebarCollapsed} />
            <ExternalSideLink
              href={
                activePersona === 'business'
                  ? 'https://drive.google.com/drive/folders/1WheArwTlyaJFBIDA1vbYmpFrecy7jPuT?usp=sharing'
                  : 'https://drive.google.com/drive/folders/1kT_tZYa3vFIZmfVxR3oTbLoMRTKTDEzf?usp=sharing'
              }
              icon={<PlayCircle className="navIcon" style={{ color: 'var(--accent)' }} />}
              label={`${activePersona === 'business' ? 'Business' : 'Personal'} Video`}
              collapsed={settings.sidebarCollapsed}
            />
          </nav>
        </div>

        <div className="sidebarFooter">
          {!settings.sidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="badge badgeEmerald">
                <Sparkles size={14} /> Vision + RAG
              </span>
              <span className="badge">
                <Bot size={14} /> {metrics.aiQueries} AI queries
              </span>
              <span className={`badge ${apiOk ? 'badgeEmerald' : ''}`} title={settings.apiBaseUrl}>
                {apiOk === null ? 'API: checking…' : apiOk ? 'API: online' : 'API: offline'}
              </span>
            </div>
          )}

          <div className="sidebarButtons">
            <button
              className="sidebarMiniBtn"
              onClick={() => setSettings(s => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))}
              title={settings.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {settings.sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {!settings.sidebarCollapsed && (
              <button
                className="sidebarMiniBtn"
                onClick={() => setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}
                title="Toggle theme"
              >
                {settings.theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="container topbarInner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn mobileToggle" onClick={() => setSidebarOpen(true)}>
                <PanelLeft size={18} />
              </button>

              <div className="pageTitle">
                <strong>{meta.title}</strong>
                <span>{meta.subtitle}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`badge ${apiOk ? 'badgeEmerald' : ''}`} title={settings.apiBaseUrl}>
                {apiOk === null ? 'API: checking…' : apiOk ? 'API: online' : <><WifiOff size={14} /> API offline</>}
              </span>

              <button
                className="btn"
                onClick={() => setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}
                title="Toggle theme"
              >
                {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {settings.theme === 'dark' ? 'Light' : 'Dark'}
              </button>

              <button className="btn btnPrimary" onClick={() => nav('/upload')}>
                <UploadCloud size={16} />
                Upload
              </button>
            </div>
          </div>
        </header>

        {apiOk === false && (
          <div className="container" style={{ paddingTop: 12 }}>
            <div className="card" style={{ boxShadow: 'none', borderColor: 'rgba(239,68,68,0.35)' }}>
              <div className="cardBody" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="small" style={{ lineHeight: 1.7 }}>
                  <strong style={{ color: '#ef4444' }}>API unreachable.</strong> Start backend or set API Base URL in Settings.
                  Recommended: <span className="mono">http://localhost:8000</span> (Docker) or <span className="mono">http://127.0.0.1:8000</span> (local).
                </div>
                <button className="btn btnPrimary" onClick={() => nav('/settings')}>Open Settings</button>
              </div>
            </div>
          </div>
        )}

        <div className="content">
          <div className="container">
            <Routes>
              <Route path="/" element={<LandingPage metrics={metrics} analyses={analyses} />} />

              <Route path="/dashboard" element={<Navigate to="/business/dashboard" replace />} />
              <Route path="/business/dashboard" element={<BusinessDashboardPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route
                path="/upload"
                element={
                  <UploadPage
                    apiBaseUrl={settings.apiBaseUrl}
                    activeFile={activeFile}
                    setActiveFile={setActiveFile}
                    metrics={metrics}
                    setMetrics={setMetrics}
                    analyses={analyses}
                    setAnalyses={setAnalyses}
                  />
                }
              />
              <Route
                path="/chat"
                element={
                  <ChatPage
                    apiBaseUrl={settings.apiBaseUrl}
                    activeFile={activeFile}
                    setActiveFile={setActiveFile}
                    conversations={conversations}
                    setConversations={setConversations}
                    metrics={metrics}
                    setMetrics={setMetrics}
                  />
                }
              />
              <Route path="/library" element={<LibraryPage analyses={analyses} setAnalyses={setAnalyses} />} />
              <Route path="/insights" element={<InsightsPage apiBaseUrl={settings.apiBaseUrl} analyses={analyses} />} />

              <Route path="/personal/dashboard" element={<PersonalDashboardPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route path="/personal/transactions" element={<PersonalTransactionsPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route path="/personal/reports" element={<PersonalReportsPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route path="/personal/categories" element={<PersonalCategoriesPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route path="/personal/budgets" element={<PersonalBudgetsPage apiBaseUrl={settings.apiBaseUrl} />} />
              <Route path="/personal/goals" element={<PersonalGoalsPage apiBaseUrl={settings.apiBaseUrl} />} />

              <Route
                path="/settings"
                element={
                  <SettingsPage
                    settings={settings}
                    setSettings={setSettings}
                    clearLocalAi={() => {
                      localStorage.removeItem(STORAGE_KEYS.analyses);
                      localStorage.removeItem(STORAGE_KEYS.conversations);
                      localStorage.removeItem(STORAGE_KEYS.metrics);
                      setAnalyses([]);
                      setConversations([]);
                      setMetrics(DEFAULT_METRICS);
                      alert('Local AI data cleared.');
                    }}
                  />
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}

function SideLink({
  to,
  icon,
  label,
  collapsed,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span style={{ fontWeight: 850 }}>{label}</span>}
    </NavLink>
  );
}

function ExternalSideLink({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="navItem"
      title={collapsed ? label : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
    >
      {icon}
      {!collapsed && <span style={{ fontWeight: 850, color: 'var(--accent)' }}>{label}</span>}
    </a>
  );
}

/* ===================== Pages ===================== */

function LandingPage({ metrics, analyses }: { metrics: Metrics; analyses: AnalysisLog[] }) {
  const nav = useNavigate();
  const recent = analyses.slice(0, 3);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody" style={{ padding: 18 }}>
          <span className="badge badgeEmerald" style={{ width: 'fit-content' }}>
            <Sparkles size={14} /> Your AI Financial Analyst
          </span>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 560px', minWidth: 260 }}>
              <h1 style={{ margin: 0, fontSize: 36, letterSpacing: -0.9 }}>Montera</h1>
              <p style={{ margin: '10px 0 0', color: 'var(--muted)', lineHeight: 1.75 }}>
                Upload invoices, receipts, reports, or statements. Ask questions and get AI answers with extracted fields,
                vision analysis, and supporting context. Track spending with budgets and goals.
              </p>

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btnPrimary" onClick={() => nav('/upload')}>
                  <FileUp size={16} /> Get Started
                </button>
                <button className="btn" onClick={() => nav('/chat')}>
                  <MessageSquare size={16} /> AI Chat
                </button>
                <button 
                  className="btn" 
                  onClick={() => {
                    const activePersona = localStorage.getItem('montera.activePersona.v4') || 'business';
                    nav(activePersona === 'business' ? '/business/dashboard' : '/personal/dashboard');
                  }}
                >
                  <LayoutDashboard size={16} /> Dashboard
                </button>
                <button className="btn" onClick={() => nav('/personal/transactions')}>
                  <PlusCircle size={16} /> Add Transaction
                </button>
              </div>

            </div>

            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <div className="grid grid2">
                <StatCard label="Processed files" value={metrics.processedFiles} />
                <StatCard label="AI queries" value={metrics.aiQueries} />
                <StatCard label="Saved analyses" value={analyses.length} />
                <StatCard label="Recent" value={Math.min(analyses.length, 3)} />
              </div>
            </div>
          </div>

          <hr className="hr" />

          <div className="grid grid2">
            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="cardHeader">
                <p className="cardTitle">Suggested prompts</p>
                <p className="cardSub">Use these in Upload or Chat</p>
              </div>
              <div className="cardBody" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {SUGGESTED_PROMPTS.map(p => (
                  <span key={p} className="badge">{p}</span>
                ))}
              </div>
            </div>

            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="cardHeader">
                <p className="cardTitle">Recent AI results</p>
                <p className="cardSub">Stored locally</p>
              </div>
              <div className="cardBody">
                {recent.length === 0 ? (
                  <div className="small">No analyses yet. Upload a document to begin.</div>
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {recent.map(a => (
                      <div key={a.id} className="card" style={{ boxShadow: 'none' }}>
                        <div className="cardBody">
                          <div className="mono" style={{ fontWeight: 900 }}>{a.filename}</div>
                          <div className="small" style={{ marginTop: 6 }}>Q: {a.question}</div>
                          {a.answer && <div className="small" style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{a.answer}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="cardBody">
        <div className="small">{label}</div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ===================== Business Dashboard ===================== */

const MOCK_DASHBOARD_DATA: any[] = [
  { id: 'm1', type: 'income', amount: 5500, occurred_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), category_id: '', description: 'Consulting Retainer - Acme Corp', payment_method: 'ACH' },
  { id: 'm2', type: 'income', amount: 4800, occurred_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), category_id: '', description: 'SaaS Platform Sales Payout', payment_method: 'Stripe' },
  { id: 'm3', type: 'income', amount: 6200, occurred_at: new Date().toISOString(), category_id: '', description: 'Contract Deliverable Commission', payment_method: 'ACH' },
  { id: 'm4', type: 'expense', amount: 209.52, occurred_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), category_id: '', description: 'Google Cloud Platform Hosting | Tax: Office/Software', payment_method: 'Credit Card' },
  { id: 'm5', type: 'expense', amount: 150.00, occurred_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), category_id: '', description: 'Office Internet Provider | Tax: Utilities', payment_method: 'Debit Card' },
  { id: 'm6', type: 'expense', amount: 75.00, occurred_at: new Date().toISOString(), category_id: '', description: 'Team coworking lunch | Tax: Meals & Entertainment', payment_method: 'Cash' },
];

function BusinessDashboardPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [useMockData, setUseMockData] = useState(false);

  // Quick Add States
  const [qAmount, setQAmount] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qType, setQType] = useState<'income' | 'expense'>('expense');
  const [qCat, setQCat] = useState('');
  const [qDate, setQDate] = useState(isoDate(new Date()));
  const [qLoading, setQLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get('/transactions', {
        params: { frm: isoDate(daysAgo(365)), to: isoDate(new Date()), limit: 1000, sort: 'date_asc' },
      });
      setItems(res.data.items || []);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const catRes = await api.get('/categories');
        if (!cancelled) setCategories(catRes.data.items || []);
        
        const txRes = await api.get('/transactions', {
          params: { frm: isoDate(daysAgo(365)), to: isoDate(new Date()), limit: 1000, sort: 'date_asc' },
        });
        if (!cancelled) setItems(txRes.data.items || []);
      } catch (e: any) {
        if (!cancelled) setErr(axiosToApiErr(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(qAmount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount.');
    if (!qDesc.trim()) return alert('Please enter a description.');

    setQLoading(true);
    try {
      await api.post('/transactions', {
        type: qType,
        amount: amt,
        currency: 'BDT',
        category_id: qCat || null,
        payment_method: 'Manual Entry',
        description: qDesc.trim(),
        occurred_at: new Date(qDate).toISOString(),
      });
      alert('Transaction saved successfully!');
      setQAmount('');
      setQDesc('');
      await fetchTransactions();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    } finally {
      setQLoading(false);
    }
  };

  const computed = useMemo(() => {
    const activeItems = useMockData ? [...items, ...MOCK_DASHBOARD_DATA] : items;

    const income = activeItems.filter(x => x.type === 'income').reduce((s, x) => s + (x.amount || 0), 0);
    const expense = activeItems.filter(x => x.type === 'expense').reduce((s, x) => s + (x.amount || 0), 0);
    const profit = income - expense;
    const margin = income > 0 ? profit / income : 0;

    const byMonth = new Map<string, { month: string; inflow: number; outflow: number; net: number }>();
    for (const t of activeItems) {
      const d = new Date(t.occurred_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = byMonth.get(key) || { month: key, inflow: 0, outflow: 0, net: 0 };
      if (t.type === 'income') row.inflow += t.amount;
      else row.outflow += t.amount;
      row.net = row.inflow - row.outflow;
      byMonth.set(key, row);
    }
    const months = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const byQuarter = new Map<string, { q: string; revenue: number; expenses: number; profit: number }>();
    for (const t of activeItems) {
      const d = new Date(t.occurred_at);
      const q = Math.floor(d.getMonth() / 3) + 1;
      const key = `${d.getFullYear()} Q${q}`;
      const row = byQuarter.get(key) || { q: key, revenue: 0, expenses: 0, profit: 0 };
      if (t.type === 'income') row.revenue += t.amount;
      else row.expenses += t.amount;
      row.profit = row.revenue - row.expenses;
      byQuarter.set(key, row);
    }
    const quarters = Array.from(byQuarter.values()).sort((a, b) => a.q.localeCompare(b.q)).slice(-8);

    const last3 = months.slice(-3);
    const avgNet = last3.length ? last3.reduce((s, r) => s + r.net, 0) / last3.length : 0;
    const forecast = Array.from({ length: 6 }).map((_, i) => ({
      m: `F${i + 1}`,
      forecast: Math.round(avgNet * (1 + i * 0.02)),
    }));

    return { income, expense, profit, margin, months, quarters, forecast, activeItems };
  }, [items, useMockData]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      {err && <ApiErrorBox err={err} />}

      {/* Modern Dashboard Options Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 12,
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '10px 16px',
        marginTop: -4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--emerald)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Workspace Live Reports Mode
          </span>
        </div>
        <button 
          className={`btn ${useMockData ? 'btnPrimary' : ''}`}
          onClick={() => setUseMockData(p => !p)}
          style={{ fontSize: 12, padding: '6px 12px', height: 'auto' }}
        >
          {useMockData ? '⚡ Custom Demo Data Active' : '🔌 Enable Demo Sandbox Data'}
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid3" style={{ gap: 14 }}>
        <KpiCard 
          title="Revenue (Inflow)" 
          value={formatMoneyBDT(computed.income)} 
          hint="Total income logged in workspace" 
          glowColor="#10B981"
          icon={<ArrowUpRight size={20} />}
        />
        <KpiCard 
          title="Expenses (Outflow)" 
          value={formatMoneyBDT(computed.expense)} 
          hint="Total expenses parsed or recorded" 
          glowColor="#ef4444"
          icon={<ArrowDownRight size={20} />}
        />
        <KpiCard 
          title="Profit Margin" 
          value={pct(computed.margin)} 
          hint="Margin efficiency (Revenue vs Expenses)" 
          glowColor="#06B6D4"
          icon={<PieChartIcon size={20} />}
        />
      </div>

      {loading ? (
        <div className="small">Loading dashboard analytics…</div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid2" style={{ gap: 16 }}>
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="cardHeader">
                <p className="cardTitle" style={{ fontSize: 15, fontWeight: 850 }}>Quarterly Financial Trends</p>
                <p className="cardSub">Comparing revenue vs expenses vs net margin</p>
              </div>
              <div className="cardBody" style={{ height: 290, padding: '0 16px 16px' }}>
                {computed.quarters.length === 0 ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 12 }}>
                    <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      <TrendingUp size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>No Trend Lines Plotted</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Add manual entries or toggle demo data above to view graphs</div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={computed.quarters}>
                      <CartesianGrid strokeDasharray="4 4" opacity={0.1} />
                      <XAxis dataKey="q" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="profit" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="cardHeader">
                <p className="cardTitle" style={{ fontSize: 15, fontWeight: 850 }}>Runway & Cashflow Forecast</p>
                <p className="cardSub">6-month projections based on average net burn rates</p>
              </div>
              <div className="cardBody" style={{ height: 290, padding: '0 16px 16px' }}>
                {computed.forecast[0]?.forecast === 0 ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 12 }}>
                    <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      <TrendingUp size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Forecast Graph Empty</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Inject sandbox demo data above to test runway trends</div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={computed.forecast}>
                      <defs>
                        <linearGradient id="glowArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" opacity={0.1} />
                      <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Area type="monotone" dataKey="forecast" stroke="#06B6D4" fill="url(#glowArea)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Lower Section (Split into Cashflow Table & Quick Transaction Form) */}
          <div className="grid grid2" style={{ gap: 16, alignItems: 'start' }}>
            {/* Cashflow Table Card */}
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="cardHeader">
                <p className="cardTitle" style={{ fontSize: 15, fontWeight: 850 }}>Monthly General Ledger</p>
                <p className="cardSub">Workspace monthly cash summaries</p>
              </div>
              <div className="cardBody" style={{ maxHeight: 350, overflowY: 'auto' }}>
                {computed.months.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>No monthly records logged</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11 }}>Log a transaction manually to see it listed here.</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Inflow (Revenue)</th>
                        <th>Outflow (Expenses)</th>
                        <th>Net Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.months.map(r => (
                        <tr key={r.month}>
                          <td className="mono" style={{ fontSize: 12, fontWeight: 800 }}>{r.month}</td>
                          <td style={{ color: '#10B981', fontWeight: 600 }}>{formatMoneyBDT(r.inflow)}</td>
                          <td style={{ color: '#ef4444', fontWeight: 600 }}>{formatMoneyBDT(r.outflow)}</td>
                          <td style={{ fontWeight: 900, color: r.net >= 0 ? '#10B981' : '#ef4444' }}>
                            {formatMoneyBDT(r.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Quick Add Form Card */}
            <div className="card" style={{ 
              background: 'rgba(16, 185, 129, 0.03)', 
              border: '1px solid rgba(16, 185, 129, 0.12)' 
            }}>
              <div className="cardHeader">
                <p className="cardTitle" style={{ fontSize: 15, fontWeight: 850, color: '#FFFFFF' }}>
                  ⚡ Quick Ledger Entry
                </p>
                <p className="cardSub">Manually insert a workspace transaction record</p>
              </div>
              <div className="cardBody">
                <form onSubmit={handleQuickAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="formLabel" style={{ fontSize: 10 }}>Description / Vendor Name</label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ padding: '8px 12px', fontSize: 13 }}
                      value={qDesc} 
                      onChange={(e) => setQDesc(e.target.value)} 
                      placeholder="e.g. AWS Subscription, Client Consulting Fee"
                      required
                    />
                  </div>

                  <div>
                    <label className="formLabel" style={{ fontSize: 10 }}>Total Amount (BDT)</label>
                    <input 
                      type="number" 
                      className="input mono" 
                      style={{ padding: '8px 12px', fontSize: 13 }}
                      value={qAmount} 
                      onChange={(e) => setQAmount(e.target.value)} 
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="formLabel" style={{ fontSize: 10 }}>Transaction Date</label>
                    <input 
                      type="date" 
                      className="input mono" 
                      style={{ padding: '8px 12px', fontSize: 13 }}
                      value={qDate} 
                      onChange={(e) => setQDate(e.target.value)} 
                      required
                    />
                  </div>

                  <div>
                    <label className="formLabel" style={{ fontSize: 10 }}>Type</label>
                    <select 
                      className="input" 
                      style={{ padding: '8px 12px', fontSize: 13 }}
                      value={qType} 
                      onChange={(e) => setQType(e.target.value as 'income' | 'expense')}
                    >
                      <option value="expense">Expense (Outflow)</option>
                      <option value="income">Income (Revenue)</option>
                    </select>
                  </div>

                  <div>
                    <label className="formLabel" style={{ fontSize: 10 }}>Account Category</label>
                    <select 
                      className="input" 
                      style={{ padding: '8px 12px', fontSize: 13 }}
                      value={qCat} 
                      onChange={(e) => setQCat(e.target.value)}
                    >
                      <option value="">-- No Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btnPrimary" 
                    style={{ gridColumn: 'span 2', padding: '10px', fontSize: 13, height: 'auto', marginTop: 4 }}
                    disabled={qLoading}
                  >
                    {qLoading ? 'Recording…' : 'Add to Ledger'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ 
  title, 
  value, 
  hint, 
  icon, 
  glowColor 
}: { 
  title: string; 
  value: string; 
  hint: string; 
  icon?: React.ReactNode; 
  glowColor?: string 
}) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 20,
      padding: '20px 24px',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
    }}>
      {/* Subtle corner glow sphere */}
      <div style={{
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: glowColor || '#10B981',
        opacity: 0.1,
        filter: 'blur(30px)',
        top: -20,
        right: -20,
        pointerEvents: 'none'
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px' }}>
            {title}
          </span>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: '6px 0 2px', color: '#FFFFFF', letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </h2>
          <span style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hint}
          </span>
        </div>
        {icon && (
          <div style={{ 
            color: glowColor || '#10B981', 
            background: 'rgba(255,255,255,0.03)', 
            padding: 8, 
            borderRadius: 12, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginLeft: 8
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Upload & Analyze ===================== */

const TAX_CATEGORIES = [
  'Office Expense (Supplies, Software, Subscriptions)',
  'Travel & Lodging',
  'Meals & Entertainment (50% deductible)',
  'Utilities (Internet, Phone, Power)',
  'Advertising & Marketing',
  'Professional Services (Legal, Bookkeeping, Consulting)',
  'Rent or Lease (Office Space)',
  'Insurance (Business Liability, Equipment)',
  'Other Business Expenses',
];

function UploadPage({
  apiBaseUrl,
  activeFile,
  setActiveFile,
  metrics,
  setMetrics,
  analyses,
  setAnalyses,
}: {
  apiBaseUrl: string;
  activeFile: File | null;
  setActiveFile: (f: File | null) => void;
  metrics: Metrics;
  setMetrics: (next: Metrics | ((prev: Metrics) => Metrics)) => void;
  analyses: AnalysisLog[];
  setAnalyses: (next: AnalysisLog[] | ((prev: AnalysisLog[]) => AnalysisLog[])) => void;
}) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [preview, setPreview] = useState('');
  const [question, setQuestion] = useState('');
  const [tab, setTab] = useState<'answer' | 'fields' | 'vision' | 'context' | 'raw'>('answer');

  const [loading, setLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<ApiErr | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [taxCategory, setTaxCategory] = useState<string>('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');

  const [vendorName, setVendorName] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [billingDate, setBillingDate] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/categories');
        if (!cancelled) setCategories(res.data.items || []);
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (result?.extracted_fields) {
      const f = result.extracted_fields;
      const vendor = String(f.vendor_name || f.vendor || '').toLowerCase();
      const type = String(f.document_type || f.type || '').toLowerCase();
      
      let suggestedCat = '';
      if (categories.length > 0) {
        const found = categories.find(c => {
          const name = c.name.toLowerCase();
          return name.includes(vendor) || vendor.includes(name) || name.includes(type) || type.includes(name);
        });
        if (found) suggestedCat = found.id;
      }
      setSelectedCategoryId(suggestedCat);

      let suggestedTax = 'Other Business Expenses';
      if (vendor.includes('aws') || vendor.includes('google') || vendor.includes('microsoft') || vendor.includes('github') || vendor.includes('chatgpt') || vendor.includes('software') || vendor.includes('figma')) {
        suggestedTax = 'Office Expense (Supplies, Software, Subscriptions)';
      } else if (vendor.includes('restaurant') || vendor.includes('cafe') || vendor.includes('food') || vendor.includes('eats') || vendor.includes('dinner') || vendor.includes('lunch')) {
        suggestedTax = 'Meals & Entertainment (50% deductible)';
      } else if (vendor.includes('uber') || vendor.includes('lyft') || vendor.includes('airlines') || vendor.includes('hotel') || vendor.includes('flight') || vendor.includes('travel')) {
        suggestedTax = 'Travel & Lodging';
      } else if (vendor.includes('telecom') || vendor.includes('internet') || vendor.includes('verizon') || vendor.includes('comcast') || vendor.includes('electric') || vendor.includes('power')) {
        suggestedTax = 'Utilities (Internet, Phone, Power)';
      } else if (vendor.includes('ads') || vendor.includes('facebook') || vendor.includes('marketing') || vendor.includes('adwords') || vendor.includes('agency')) {
        suggestedTax = 'Advertising & Marketing';
      } else if (vendor.includes('lawyer') || vendor.includes('legal') || vendor.includes('consulting') || vendor.includes('audit') || vendor.includes('accounting')) {
        suggestedTax = 'Professional Services (Legal, Bookkeeping, Consulting)';
      }
      setTaxCategory(suggestedTax);

      // Initialize editable inputs
      const fVendor = String(f.vendor_name || f.vendor || 'Unknown Vendor').trim();
      const fAmount = numFromMoneyLike(f.total_amount) ?? numFromMoneyLike(f.total) ?? numFromMoneyLike(f.amount) ?? '';
      
      const dateStr = f.billing_date || f.date;
      const parsedDate = (() => {
        const d = dateStr ? new Date(String(dateStr)) : new Date();
        return isNaN(d.getTime()) ? isoDate(new Date()) : isoDate(d);
      })();

      setVendorName(fVendor);
      setTotalAmount(String(fAmount));
      setBillingDate(parsedDate);
    } else {
      setVendorName('');
      setTotalAmount('');
      setBillingDate('');
    }
  }, [result, categories]);

  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setActiveFile(f);
    setPreview(f.type.startsWith('image') ? URL.createObjectURL(f) : '');
    setQuestion('');
    setResult(null);
    setErr(null);
    setUploadPct(0);
    setTab('answer');
  }, [setActiveFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
  });

  const analyze = async () => {
    if (!activeFile) return;
    const finalQuestion = question.trim() || "Analyze this financial document. Extract the vendor name, billing date, total amount, taxes, line items, and audit for any pricing discrepancies or unusual details.";

    setLoading(true);
    setErr(null);
    setResult(null);
    setUploadPct(0);

    const loggedEmail = sessionStorage.getItem('montera.loggedEmail') || 'local';
    const activeUser = localStorage.getItem('montera.activeUser.v4') || 'local';
    const compositeUserId = `${loggedEmail}:${activeUser}`;
    const form = new FormData();
    form.append('file', activeFile);
    form.append('question', finalQuestion);
    form.append('user_id', compositeUserId);

    try {
      setMetrics(m => ({ ...m, aiQueries: m.aiQueries + 1 }));

      const res = await api.post('/analyze', form, {
        onUploadProgress: (evt) => {
          const total = evt.total || 0;
          if (!total) return;
          setUploadPct(clamp(Math.round((evt.loaded / total) * 100), 0, 100));
        },
      });

      setResult(res.data);
      setTab('answer');

      const log: AnalysisLog = {
        id: uid('ana'),
        filename: res.data?.filename || activeFile.name,
        created_at: new Date().toISOString(),
        question: finalQuestion,
        status: 'processed',
        answer: res.data?.answer,
        extracted_fields: res.data?.extracted_fields,
        vision_analysis: res.data?.vision_analysis,
        context_used: res.data?.context_used,
        document_markdown: res.data?.document_markdown,
      };

      setAnalyses(prev => [log, ...prev].slice(0, 250));
      setMetrics(m => ({ ...m, processedFiles: m.processedFiles + 1 }));
    } catch (e: any) {
      const apiErr = axiosToApiErr(e);
      setErr(apiErr);

      const log: AnalysisLog = {
        id: uid('ana'),
        filename: activeFile.name,
        created_at: new Date().toISOString(),
        question: finalQuestion,
        status: 'error',
        error: apiErr.message,
      };
      setAnalyses(prev => [log, ...prev].slice(0, 250));
    } finally {
      setLoading(false);
    }
  };

  const addAsExpense = async () => {
    const amt = Number(totalAmount);
    if (isNaN(amt) || amt <= 0) {
      return alert('Please enter a valid total amount (greater than 0) before saving.');
    }
    const vendor = String(vendorName || 'Document').trim();
    const occurred_at = (() => {
      const d = billingDate ? new Date(billingDate) : new Date();
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })();

    try {
      const taxLabel = taxCategory ? ` | Tax: ${taxCategory}` : '';
      await api.post('/transactions', {
        type: txType,
        amount: amt,
        currency: 'BDT',
        category_id: selectedCategoryId || null,
        payment_method: 'Document',
        description: `Imported from AI: ${vendor} (${result.filename || activeFile?.name || 'document'})${taxLabel}`,
        occurred_at,
      });
      alert(`Saved as a transaction (${txType}) successfully!`);
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card" style={{ 
        background: 'rgba(15, 23, 42, 0.45)', 
        backdropFilter: 'blur(20px)', 
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 24
      }}>
        <div className="cardBody" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                AI Document Auditor & OCR
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Upload scans, statements, receipts, or PDFs to extract ledger data and execute automated AI audits.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => {
                  setActiveFile(null);
                  setPreview('');
                  setQuestion('');
                  setResult(null);
                  setErr(null);
                  setUploadPct(0);
                  setTab('answer');
                }}
                style={{ fontSize: 13, height: 40 }}
              >
                Reset Form
              </button>
              <button 
                className="btn btnPrimary" 
                onClick={analyze} 
                disabled={!activeFile || loading}
                style={{ fontSize: 13, height: 40 }}
              >
                <Sparkles size={15} /> {loading ? 'Analyzing…' : 'Process & Audit'}
              </button>
            </div>
          </div>

          <div
            {...getRootProps()}
            style={{
              marginTop: 18,
              border: '2px dashed rgba(16, 185, 129, 0.25)',
              borderRadius: 16,
              background: isDragActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)',
              borderColor: isDragActive ? '#10B981' : 'rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDragActive ? '0 0 20px rgba(16, 185, 129, 0.1)' : 'none'
            }}
          >
            <input {...getInputProps()} />
            <div style={{ textAlign: 'center' }}>
              <span className="badge badgeEmerald" style={{ margin: '0 auto 12px', width: 'fit-content' }}>
                <UploadCloud size={14} /> drag & drop active
              </span>

              {activeFile ? (
                <>
                  <div className="mono" style={{ fontWeight: 950, color: '#FFFFFF', fontSize: 14 }}>{activeFile.name}</div>
                  <div className="small" style={{ marginTop: 6, color: 'var(--muted)' }}>
                    {(activeFile.size / 1024).toFixed(1)} KB &bull; Click or drop a new file to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: 14 }}>
                    {isDragActive ? 'Drop your document here' : 'Drop a document here or click to browse'}
                  </div>
                  <div className="small" style={{ marginTop: 6, color: 'var(--muted)' }}>Supports PDF, PNG, JPG, and WEBP</div>
                </>
              )}
            </div>
          </div>

          {preview && (
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)', marginTop: 18 }}>
              <div className="cardHeader" style={{ padding: '12px 16px' }}>
                <p className="cardTitle" style={{ fontSize: 12, fontWeight: 800 }}>Document Image Preview</p>
              </div>
              <div className="cardBody" style={{ padding: 12, textAlign: 'center' }}>
                <img
                  src={preview}
                  alt="preview"
                  style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Auditing Instructions / Query</label>
            <textarea
              className="textarea"
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 14,
                fontSize: 14,
                lineHeight: 1.6,
                minHeight: 90,
                color: '#FFFFFF',
                width: '100%'
              }}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g., Check for pricing variances, verify totals, or outline billing details..."
            />
          </div>

          {loading && (
            <div className="card" style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.12)', marginTop: 18 }}>
              <div className="cardBody" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, color: '#FFFFFF', fontSize: 13 }}>Processing Ledger & OCR...</div>
                  <div className="small mono" style={{ fontWeight: 800, color: 'var(--emerald)' }}>{uploadPct}%</div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${uploadPct}%`, background: 'linear-gradient(90deg, #34d399, #10B981)', transition: 'width 100ms ease' }} />
                </div>
              </div>
            </div>
          )}

          {err && <div style={{ marginTop: 18 }}><ApiErrorBox err={err} /></div>}
        </div>
      </div>

      {result && !loading && (
        <div className="card">
          <div className="cardBody">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className={`btn ${tab === 'answer' ? 'btnPrimary' : ''}`} onClick={() => setTab('answer')}>Answer</button>
                <button className={`btn ${tab === 'fields' ? 'btnPrimary' : ''}`} onClick={() => setTab('fields')}>Extracted</button>
                <button className={`btn ${tab === 'vision' ? 'btnPrimary' : ''}`} onClick={() => setTab('vision')}>Vision</button>
                <button className={`btn ${tab === 'context' ? 'btnPrimary' : ''}`} onClick={() => setTab('context')}>Context</button>
                <button className={`btn ${tab === 'raw' ? 'btnPrimary' : ''}`} onClick={() => setTab('raw')}>Raw</button>
              </div>
            </div>

            {/* Smart Categorization & Tax Mapping Portal Widget */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.05)', 
              border: '1px solid rgba(16, 185, 129, 0.18)', 
              borderRadius: 12, 
              padding: 16, 
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              alignItems: 'end'
            }}>
              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Vendor Name</label>
                <input 
                  type="text" 
                  className="input" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={vendorName} 
                  onChange={(e) => setVendorName(e.target.value)} 
                  placeholder="Vendor Name"
                />
              </div>

              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Total Amount (BDT)</label>
                <input 
                  type="number" 
                  className="input mono" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={totalAmount} 
                  onChange={(e) => setTotalAmount(e.target.value)} 
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Billing Date</label>
                <input 
                  type="date" 
                  className="input mono" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={billingDate} 
                  onChange={(e) => setBillingDate(e.target.value)} 
                />
              </div>

              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Transaction Type</label>
                <select 
                  className="input" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={txType} 
                  onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
                >
                  <option value="expense">Expense (Outflow)</option>
                  <option value="income">Income (Revenue)</option>
                </select>
              </div>

              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>Assign Category</label>
                <select 
                  className="input" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={selectedCategoryId} 
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="">-- No Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="formLabel" style={{ fontSize: 11, marginBottom: 6 }}>
                  Tax Class (Schedule C)
                </label>
                <select 
                  className="input" 
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  value={taxCategory} 
                  onChange={(e) => setTaxCategory(e.target.value)}
                >
                  <option value="">-- None --</option>
                  {TAX_CATEGORIES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <button 
                className="btn btnPrimary" 
                onClick={addAsExpense}
                style={{ padding: '8px 16px', fontSize: 13, height: 42, width: '100%' }}
              >
                <PlusCircle size={15} /> Save to Dashboard
              </button>
            </div>

            <hr className="hr" />

            {tab === 'answer' && (
              <div className="tabAnswerContent">
                <ReactMarkdown>{result.answer || '(No answer returned)'}</ReactMarkdown>
              </div>
            )}

            {tab === 'fields' && (
              <div>
                {result.extracted_fields?.error ? (
                  <div className="small" style={{ color: '#ef4444', fontWeight: 900 }}>
                    {String(result.extracted_fields.error)}
                  </div>
                ) : (
                  <table className="table">
                    <tbody>
                      {Object.entries(result.extracted_fields || {}).map(([k, v]) => (
                        <tr key={k}>
                          <th style={{ width: 240, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</th>
                          <td className="mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'vision' && (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 12, color: 'var(--muted)' }}>
                {typeof result.vision_analysis === 'string' ? result.vision_analysis : JSON.stringify(result.vision_analysis, null, 2)}
              </pre>
            )}

            {tab === 'context' && (
              <div className="grid" style={{ gap: 10 }}>
                {Array.isArray(result.context_used) && result.context_used.length > 0 ? (
                  result.context_used.map((c: string, i: number) => (
                    <div key={i} className="card" style={{ boxShadow: 'none', borderLeft: '4px solid var(--emerald)' }}>
                      <div className="cardBody">
                        <div className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{c}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="small">No context snippets returned.</div>
                )}
              </div>
            )}

            {tab === 'raw' && (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 12, color: 'var(--muted)' }}>
                {result.document_markdown || '(No raw text returned)'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== AI Chat ===================== */

function ChatPage({
  apiBaseUrl,
  activeFile,
  setActiveFile,
  conversations,
  setConversations,
  metrics,
  setMetrics,
}: {
  apiBaseUrl: string;
  activeFile: File | null;
  setActiveFile: (f: File | null) => void;
  conversations: Conversation[];
  setConversations: (next: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  metrics: Metrics;
  setMetrics: (next: Metrics | ((prev: Metrics) => Metrics)) => void;
}) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [selectedId, setSelectedId] = useState<string>(() => conversations[0]?.id || '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => conversations.find(c => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (!selectedId && conversations[0]?.id) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  const createConversation = () => {
    const now = new Date().toISOString();
    const c: Conversation = { id: uid('conv'), title: 'New conversation', createdAt: now, updatedAt: now, messages: [] };
    setConversations(prev => [c, ...prev].slice(0, 80));
    setSelectedId(c.id);
  };

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (f) setActiveFile(f);
  }, [setActiveFile]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
  });

  const send = async (text: string) => {
    if (!text.trim()) return;
    if (!activeFile) return alert('Attach a PDF or image first.');
    if (!selected) return createConversation();

    setLoading(true);
    setInput('');

    const now = new Date().toISOString();
    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text, createdAt: now };
    const assistantMsg: ChatMessage = { id: uid('m'), role: 'assistant', content: 'Thinking…', createdAt: now };

    setConversations(prev =>
      prev.map(c => c.id === selected.id
        ? { ...c, title: c.messages.length === 0 ? text.slice(0, 42) : c.title, updatedAt: now, messages: [...c.messages, userMsg, assistantMsg] }
        : c
      )
    );

    try {
      setMetrics(m => ({ ...m, aiQueries: m.aiQueries + 1 }));
      const loggedEmail = sessionStorage.getItem('montera.loggedEmail') || 'local';
      const activeUser = localStorage.getItem('montera.activeUser.v4') || 'local';
      const compositeUserId = `${loggedEmail}:${activeUser}`;
      const form = new FormData();
      form.append('file', activeFile);
      form.append('question', text);
      form.append('user_id', compositeUserId);

      const res = await api.post('/analyze', form);
      const answer = res.data?.answer || '(No answer returned)';

      setConversations(prev =>
        prev.map(c => {
          if (c.id !== selected.id) return c;
          const next = c.messages.slice();
          const idx = next.findIndex(m => m.id === assistantMsg.id);
          if (idx !== -1) next[idx] = { ...assistantMsg, content: answer };
          return { ...c, updatedAt: new Date().toISOString(), messages: next };
        })
      );
    } catch (e: any) {
      const msg = axiosToApiErr(e).message;
      setConversations(prev =>
        prev.map(c => {
          if (c.id !== selected.id) return c;
          const next = c.messages.slice();
          const idx = next.findIndex(m => m.id === assistantMsg.id);
          if (idx !== -1) next[idx] = { ...assistantMsg, content: `Error: ${msg}` };
          return { ...c, updatedAt: new Date().toISOString(), messages: next };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="cardBody" style={{ padding: 0 }}>
        <div className="chatLayout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 560 }}>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 950, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Database size={16} /> Conversations
              </div>
              <button className="btn btnPrimary" onClick={createConversation} style={{ padding: '9px 10px' }}>New</button>
            </div>

            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 510, overflow: 'auto' }}>
              {conversations.length === 0 ? (
                <div className="small" style={{ padding: 12 }}>No conversations yet.</div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.id}
                    className="btn"
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      justifyContent: 'flex-start',
                      borderColor: c.id === selectedId ? 'rgba(16,185,129,0.40)' : 'var(--border)',
                      background: c.id === selectedId ? 'rgba(16,185,129,0.10)' : undefined,
                    }}
                  >
                    <MessageSquare size={16} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                      <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>
                        {c.title}
                      </div>
                      <div className="small">{new Date(c.updatedAt).toLocaleString()}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <Bot size={16} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selected ? selected.title : 'No conversation selected'}
                  </div>
                  <div className="small">{activeFile ? `Attached: ${activeFile.name}` : 'Attach a PDF/image to start'}</div>
                </div>
              </div>

              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <button className="btn"><FileUp size={16} /> Attach</button>
              </div>
            </div>

            <div style={{ padding: 14, flex: 1, overflow: 'auto' }}>
              {!selected ? (
                <div className="small">Select a conversation or create a new one.</div>
              ) : selected.messages.length === 0 ? (
                <div className="grid" style={{ gap: 12 }}>
                  <span className="badge badgeEmerald" style={{ width: 'fit-content' }}>Suggested prompts</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {SUGGESTED_PROMPTS.map(p => (
                      <button key={p} className="btn" onClick={() => setInput(p)} disabled={loading}>{p}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selected.messages.map(m => (
                    <div
                      key={m.id}
                      className="card"
                      style={{
                        boxShadow: 'none',
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '92%',
                        borderColor: m.role === 'user' ? 'rgba(16,185,129,0.40)' : 'var(--border)',
                        background: m.role === 'user' ? 'rgba(16,185,129,0.10)' : undefined,
                      }}
                    >
                      <div className="cardBody" style={{ padding: 12 }}>
                        {m.role === 'assistant' ? (
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{m.content}</div>
                        )}
                        <div className="small" style={{ marginTop: 8 }}>{new Date(m.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  className="textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask a question about the attached document…"
                  style={{ minHeight: 60, maxHeight: 140 }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <button className="btn btnPrimary" disabled={loading || !input.trim()} onClick={() => send(input)}>
                  <Sparkles size={16} /> Send
                </button>
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Press <span className="mono">Ctrl</span> + <span className="mono">Enter</span> to send.
              </div>
            </div>
          </div>
        </div>

        <style>{`@media (max-width: 980px){ .chatLayout{ grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </div>
  );
}

/* ===================== Library ===================== */

function LibraryPage({
  analyses,
  setAnalyses,
}: {
  analyses: AnalysisLog[];
  setAnalyses: (next: AnalysisLog[] | ((prev: AnalysisLog[]) => AnalysisLog[])) => void;
}) {
  const [selected, setSelected] = useState<AnalysisLog | null>(null);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p className="cardTitle" style={{ margin: 0 }}>Document Library</p>
              <p className="cardSub">Local AI analysis history</p>
            </div>
            <button className="btn" onClick={() => { setAnalyses([]); setSelected(null); }}>
              <Trash2 size={16} /> Clear
            </button>
          </div>

          <hr className="hr" />

          {analyses.length === 0 ? (
            <div className="small">No analyses yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Status</th>
                  <th>Question</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {analyses.slice(0, 150).map(a => (
                  <tr key={a.id}>
                    <td className="mono">{a.filename}</td>
                    <td><span className={`badge ${a.status === 'processed' ? 'badgeEmerald' : ''}`}>{a.status}</span></td>
                    <td style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.question}</td>
                    <td className="small">{new Date(a.created_at).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn" onClick={() => setSelected(a)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="cardBody">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="mono" style={{ fontWeight: 950 }}>{selected.filename}</div>
                <div className="small" style={{ marginTop: 6 }}>{new Date(selected.created_at).toLocaleString()}</div>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>

            <hr className="hr" />

            <div className="small" style={{ fontWeight: 850 }}>Question</div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{selected.question}</div>

            <hr className="hr" />

            <div className="small" style={{ fontWeight: 850 }}>Answer</div>
            <div style={{ marginTop: 10, lineHeight: 1.75 }}>
              <ReactMarkdown>{selected.answer || '(No answer saved)'}</ReactMarkdown>
            </div>

            <hr className="hr" />

            <div className="small" style={{ fontWeight: 850 }}>Extracted fields</div>
            <pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              {JSON.stringify(selected.extracted_fields || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Insights ===================== */

function InsightsPage({ apiBaseUrl, analyses }: { apiBaseUrl: string; analyses: AnalysisLog[] }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [tx, setTx] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txErr, setTxErr] = useState<ApiErr | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTx(true);
      setTxErr(null);
      try {
        const res = await api.get('/transactions', { params: { limit: 1000, sort: 'date_asc' } });
        if (!cancelled) setTx(res.data.items || []);
      } catch (e: any) {
        if (!cancelled) setTxErr(axiosToApiErr(e));
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const derived = useMemo(() => {
    // AI derived totals
    const rows = analyses
      .filter(a => a.status === 'processed')
      .map(a => {
        const f = a.extracted_fields || {};
        const vendor = String(f.vendor_name || f.vendor || 'Unknown');
        const docType = String(f.document_type || 'unknown');
        const amt = numFromMoneyLike(f.total_amount ?? f.total ?? f.amount) || 0;

        const dateStr = f.billing_date || f.date || a.created_at;
        const d = new Date(String(dateStr));
        const month = isNaN(d.getTime())
          ? String(a.created_at).slice(0, 7)
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        return { vendor, docType, amt, month };
      })
      .filter(r => r.amt > 0);

    const byVendor = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const r of rows) {
      byVendor.set(r.vendor, (byVendor.get(r.vendor) || 0) + r.amt);
      byMonth.set(r.month, (byMonth.get(r.month) || 0) + r.amt);
      byType.set(r.docType, (byType.get(r.docType) || 0) + r.amt);
    }

    const vendorData = Array.from(byVendor.entries()).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    const monthData = Array.from(byMonth.entries()).map(([month, spend]) => ({ month, spend: Math.round(spend) }))
      .sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const typeData = Array.from(byType.entries()).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    // Transactions derived
    const txByMonth = new Map<string, { month: string; income: number; expense: number }>();
    for (const t of tx) {
      const d = new Date(t.occurred_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = txByMonth.get(key) || { month: key, income: 0, expense: 0 };
      if (t.type === 'income') row.income += t.amount;
      else row.expense += t.amount;
      txByMonth.set(key, row);
    }
    const txMonth = Array.from(txByMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    return { vendorData, monthData, typeData, txMonth };
  }, [analyses, tx]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      {txErr && <ApiErrorBox err={txErr} />}

      <div className="grid grid2">
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Spend by vendor (AI)</p>
            <p className="cardSub">From extracted fields</p>
          </div>
          <div className="cardBody" style={{ height: 320 }}>
            {derived.vendorData.length === 0 ? (
              <div className="small">Analyze a few documents first.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie data={derived.vendorData} dataKey="value" nameKey="name" outerRadius={110} fill="#10B981" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Monthly spend trend (AI)</p>
            <p className="cardSub">Totals grouped by month</p>
          </div>
          <div className="cardBody" style={{ height: 320 }}>
            {derived.monthData.length === 0 ? (
              <div className="small">No monthly trend yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={derived.monthData}>
                  <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="spend" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Document type breakdown (AI)</p>
            <p className="cardSub">From extracted_fields.document_type</p>
          </div>
          <div className="cardBody" style={{ height: 300 }}>
            {derived.typeData.length === 0 ? (
              <div className="small">No type data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={derived.typeData} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Income vs Expense (DB)</p>
            <p className="cardSub">From transactions</p>
          </div>
          <div className="cardBody" style={{ height: 300 }}>
            {loadingTx ? (
              <div className="small">Loading…</div>
            ) : derived.txMonth.length === 0 ? (
              <div className="small">No transactions yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={derived.txMonth}>
                  <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="#60A5FA" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Personal Pages ===================== */

function PersonalDashboardPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);
  const [frm, setFrm] = useState(() => isoDate(startOfMonth(new Date())));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [overview, setOverview] = useState<PersonalOverview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get('/personal/overview', { params: { frm, to, currency: 'BDT' } });
      setOverview(res.data);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [api, frm, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p className="cardTitle" style={{ margin: 0 }}>Personal Dashboard</p>
              <p className="cardSub">Income, expenses, savings + trends</p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { setFrm(isoDate(daysAgo(6))); setTo(isoDate(new Date())); }}>This week</button>
              <button className="btn" onClick={() => { setFrm(isoDate(startOfMonth(new Date()))); setTo(isoDate(new Date())); }}>This month</button>

              <div style={{ minWidth: 160 }}>
                <div className="small">From</div>
                <input className="input" type="date" value={frm} onChange={(e) => setFrm(e.target.value)} />
              </div>
              <div style={{ minWidth: 160 }}>
                <div className="small">To</div>
                <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>

              <button className="btn btnPrimary" onClick={load}>Refresh</button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="small">Loading…</div>}
      {err && <ApiErrorBox err={err} />}

      {overview && !loading && !err && (
        <>
          <div className="grid grid4">
            <KpiCard title="Balance" value={formatMoneyBDT(overview.balance)} hint="Income - Expenses" />
            <KpiCard title="Income" value={formatMoneyBDT(overview.total_income)} hint="Range total" />
            <KpiCard title="Expenses" value={formatMoneyBDT(overview.total_expenses)} hint="Range total" />
            <KpiCard title="Savings" value={formatMoneyBDT(overview.savings)} hint="Income - Expenses" />
          </div>

          <div className="grid grid2">
            <div className="card">
              <div className="cardHeader">
                <p className="cardTitle">Trend</p>
                <p className="cardSub">Daily income vs expense</p>
              </div>
              <div className="cardBody" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.trend}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2.4} dot={false} />
                    <Line type="monotone" dataKey="expense" stroke="#60A5FA" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="cardHeader">
                <p className="cardTitle">Top categories</p>
                <p className="cardSub">Top 8</p>
              </div>
              <div className="cardBody" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Pie
                      data={overview.top_categories.map(x => ({ name: `${x.icon || ''} ${x.category}`.trim(), value: x.total }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      fill="#10B981"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PersonalTransactionsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catsErr, setCatsErr] = useState<ApiErr | null>(null);
  const [loadingCats, setLoadingCats] = useState(true);

  const [items, setItems] = useState<Transaction[]>([]);
  const [txErr, setTxErr] = useState<ApiErr | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocalValue(new Date()));

  const loadAll = useCallback(async () => {
    setLoadingCats(true);
    setCatsErr(null);
    setLoading(true);
    setTxErr(null);

    try {
      const [cats, txs] = await Promise.all([
        api.get('/categories'),
        api.get('/transactions', { params: { sort: 'date_desc', limit: 200 } }),
      ]);
      setCategories(cats.data.items || []);
      setItems(txs.data.items || []);
    } catch (e: any) {
      const ae = axiosToApiErr(e);
      // Could be either endpoint; show once
      setCatsErr(ae);
      setTxErr(ae);
      setCategories([]);
      setItems([]);
    } finally {
      setLoadingCats(false);
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createTx = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('Enter a valid amount');

    try {
      await api.post('/transactions', {
        type,
        amount: amt,
        currency: 'BDT',
        category_id: categoryId || null,
        payment_method: paymentMethod,
        description: description || null,
        occurred_at: new Date(occurredAt).toISOString(),
      });
      setAmount('');
      setDescription('');
      await loadAll();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  const removeTx = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      await loadAll();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Add transaction</p>
          <p className="cardSub">Income/Expense · category · payment · date</p>

          {catsErr && <ApiErrorBox err={catsErr} />}

          <div className="grid grid3" style={{ marginTop: 12 }}>
            <div>
              <div className="small">Type</div>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <div className="small">Amount (৳)</div>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 250" />
            </div>
            <div>
              <div className="small">Date & time</div>
              <input className="input" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div>
              <div className="small">Category</div>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={loadingCats}>
                <option value="">Uncategorized</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {(c.icon ? `${c.icon} ` : '') + c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="small">Payment method</div>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option>Cash</option>
                <option>bKash</option>
                <option>Nagad</option>
                <option>Card</option>
                <option>Bank</option>
                <option>Document</option>
              </select>
            </div>
            <div>
              <div className="small">Description</div>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn btnPrimary" onClick={createTx}>
              <PlusCircle size={16} /> Save
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>History</p>
          <p className="cardSub">Latest 200</p>

          {loading && <div className="small" style={{ marginTop: 12 }}>Loading…</div>}
          {txErr && <div style={{ marginTop: 12 }}><ApiErrorBox err={txErr} /></div>}

          {!loading && !txErr && (
            <div style={{ marginTop: 12, overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Payment</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(tx => {
                    const c = tx.category_id ? catById.get(tx.category_id) : null;
                    return (
                      <tr key={tx.id}>
                        <td className="mono">{new Date(tx.occurred_at).toLocaleString()}</td>
                        <td><span className={`badge ${tx.type === 'income' ? 'badgeEmerald' : ''}`}>{tx.type}</span></td>
                        <td>{c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : 'Uncategorized'}</td>
                        <td className="mono">{tx.payment_method}</td>
                        <td style={{ maxWidth: 340 }}>{tx.description || ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 850 }}>{formatMoneyBDT(tx.amount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn" onClick={() => removeTx(tx.id)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && <tr><td colSpan={7} className="small">No transactions.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalReportsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [frm, setFrm] = useState(() => isoDate(startOfMonth(new Date())));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [overview, setOverview] = useState<PersonalOverview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get('/personal/overview', { params: { frm, to, currency: 'BDT' } });
      setOverview(res.data);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [api, frm, to]);

  useEffect(() => { load(); }, [load]);

  const barData = useMemo(() => {
    if (!overview) return [];
    return overview.top_categories.map(c => ({
      name: `${c.icon || ''} ${c.category}`.trim(),
      total: Math.round(c.total),
    }));
  }, [overview]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Reports</p>
          <p className="cardSub">Category breakdown + trends</p>

          <div className="grid grid3" style={{ marginTop: 12 }}>
            <div>
              <div className="small">From</div>
              <input className="input" type="date" value={frm} onChange={(e) => setFrm(e.target.value)} />
            </div>
            <div>
              <div className="small">To</div>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btnPrimary" onClick={load}>Refresh</button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="small">Loading…</div>}
      {err && <ApiErrorBox err={err} />}

      {overview && !loading && !err && (
        <div className="grid grid2">
          <div className="card">
            <div className="cardHeader">
              <p className="cardTitle">Income vs expense trend</p>
              <p className="cardSub">{overview.range.from} → {overview.range.to}</p>
            </div>
            <div className="cardBody" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.trend}>
                  <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="#60A5FA" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <p className="cardTitle">Top categories</p>
              <p className="cardSub">Top 8</p>
            </div>
            <div className="cardBody" style={{ height: 320 }}>
              {barData.length === 0 ? (
                <div className="small">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonalCategoriesPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get('/categories');
      setItems(res.data.items || []);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const n = name.trim();
    if (!n) return alert('Enter name');
    try {
      await api.post('/categories', { name: n, icon: icon.trim() || null });
      setName('');
      setIcon('');
      await load();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      await load();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Categories</p>
          <p className="cardSub">Create and manage categories</p>

          <div className="grid grid3" style={{ marginTop: 12 }}>
            <div>
              <div className="small">Name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile Recharge" />
            </div>
            <div>
              <div className="small">Icon (optional)</div>
              <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. 📱" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btnPrimary" onClick={create}>
                <Tags size={16} /> Add
              </button>
            </div>
          </div>

          {err && <div style={{ marginTop: 12 }}><ApiErrorBox err={err} /></div>}
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>All categories</p>
          <p className="cardSub">Click delete to remove</p>

          {loading ? (
            <div className="small" style={{ marginTop: 12 }}>Loading…</div>
          ) : (
            <div style={{ marginTop: 12, overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>Name</th>
                    <th className="small">Updated</th>
                    <th style={{ textAlign: 'right' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.id}>
                      <td style={{ width: 70, fontSize: 18 }}>{c.icon || '—'}</td>
                      <td style={{ fontWeight: 850 }}>{c.name}</td>
                      <td className="small">{new Date(c.updated_at).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn" onClick={() => remove(c.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={4} className="small">No categories.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalBudgetsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [items, setItems] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [limitByCat, setLimitByCat] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [cats, buds] = await Promise.all([
        api.get('/categories'),
        api.get('/budgets', { params: { month, currency: 'BDT' } }),
      ]);
      setCategories(cats.data.items || []);
      setItems(buds.data.items || []);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
      setCategories([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, month]);

  useEffect(() => { load(); }, [load]);

  const upsert = async (category_id: string) => {
    const raw = limitByCat[category_id];
    const val = Number(raw);
    if (!val || val <= 0) return alert('Enter a valid monthly limit');
    try {
      await api.put('/budgets', { month, category_id, currency: 'BDT', monthly_limit: val });
      await load();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  const byCat = new Map(items.map(b => [b.category_id, b]));

  return (
    <div className="card">
      <div className="cardBody">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className="cardTitle" style={{ margin: 0 }}>Budgets</p>
            <p className="cardSub">Monthly budgets + progress</p>
          </div>
          <div style={{ minWidth: 200 }}>
            <div className="small">Month</div>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>

        {loading && <div className="small" style={{ marginTop: 12 }}>Loading…</div>}
        {err && <div style={{ marginTop: 12 }}><ApiErrorBox err={err} /></div>}

        {!loading && !err && (
          <div style={{ marginTop: 12, overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Limit</th>
                  <th>Spent</th>
                  <th>Remaining</th>
                  <th>Progress</th>
                  <th>Set/Update</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => {
                  const b = byCat.get(c.id);
                  const limit = b?.monthly_limit || 0;
                  const spent = b?.spent || 0;
                  const remaining = b?.remaining ?? 0;
                  const progress = limit > 0 ? spent / limit : 0;

                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 850 }}>{c.icon ? `${c.icon} ` : ''}{c.name}</td>
                      <td className="mono">{limit ? formatMoneyBDT(limit) : '—'}</td>
                      <td className="mono">{formatMoneyBDT(spent)}</td>
                      <td className="mono" style={{ color: remaining < 0 ? '#ef4444' : 'var(--emerald)', fontWeight: 850 }}>
                        {limit ? formatMoneyBDT(remaining) : '—'}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        {limit ? <ProgressBar value01={progress} /> : <span className="small">No budget</span>}
                      </td>
                      <td style={{ minWidth: 240 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            className="input"
                            placeholder="Monthly limit ৳"
                            value={limitByCat[c.id] ?? ''}
                            onChange={(e) => setLimitByCat(prev => ({ ...prev, [c.id]: e.target.value }))}
                          />
                          <button className="btn btnPrimary" onClick={() => upsert(c.id)}>Save</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {categories.length === 0 && <tr><td colSpan={6} className="small">No categories.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonalGoalsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);

  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get('/goals', { params: { currency: 'BDT' } });
      setItems(res.data.items || []);
    } catch (e: any) {
      setErr(axiosToApiErr(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const t = Number(target);
    const s = saved ? Number(saved) : 0;
    if (!title.trim()) return alert('Enter goal title');
    if (!t || t <= 0) return alert('Enter valid target');
    if (s < 0) return alert('Saved must be >= 0');

    try {
      await api.post('/goals', { title, currency: 'BDT', target_amount: t, saved_amount: s, deadline: deadline || null });
      setTitle('');
      setTarget('');
      setSaved('');
      setDeadline('');
      await load();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goals/${id}`);
      await load();
    } catch (e: any) {
      alert(axiosToApiErr(e).message);
    }
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Savings goals</p>
          <p className="cardSub">Create goals and track progress</p>

          <div className="grid grid3" style={{ marginTop: 12 }}>
            <div>
              <div className="small">Title</div>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Laptop" />
            </div>
            <div>
              <div className="small">Target (৳)</div>
              <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 120000" />
            </div>
            <div>
              <div className="small">Already saved (৳)</div>
              <input className="input" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="e.g. 25000" />
            </div>
            <div>
              <div className="small">Deadline</div>
              <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btnPrimary" onClick={create}>
                <Target size={16} /> Create
              </button>
            </div>
          </div>

          {err && <div style={{ marginTop: 12 }}><ApiErrorBox err={err} /></div>}
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Your goals</p>
          <p className="cardSub">List</p>

          {loading && <div className="small" style={{ marginTop: 12 }}>Loading…</div>}

          {!loading && !err && (
            <div className="grid grid2" style={{ marginTop: 12 }}>
              {items.map(g => {
                const progress = g.target_amount > 0 ? g.saved_amount / g.target_amount : 0;
                return (
                  <div key={g.id} className="card" style={{ boxShadow: 'none' }}>
                    <div className="cardBody">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 950 }}>{g.title}</div>
                        <span className="badge badgeEmerald">{pct(progress)}</span>
                      </div>

                      <div className="small" style={{ marginTop: 6 }}>
                        Target: <span className="mono">{formatMoneyBDT(g.target_amount)}</span> · Saved:{' '}
                        <span className="mono">{formatMoneyBDT(g.saved_amount)}</span>
                        {g.deadline ? <> · Deadline: <span className="mono">{g.deadline}</span></> : null}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <ProgressBar value01={progress} />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <button className="btn" onClick={() => remove(g.id)}>
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="small">No goals yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== Settings ===================== */

function SettingsPage({
  settings,
  setSettings,
  clearLocalAi,
}: {
  settings: AppSettings;
  setSettings: (next: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  clearLocalAi: () => void;
}) {
  const [api, setApi] = useState(settings.apiBaseUrl);
  const [testMsg, setTestMsg] = useState('');

  const test = async () => {
    setTestMsg('Testing…');
    const ok = await healthOk(api.trim());
    setTestMsg(ok ? 'OK ✅' : 'Failed ❌');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardBody">
          <p className="cardTitle" style={{ margin: 0 }}>Settings</p>
          <p className="cardSub">API URL, theme, local AI data</p>

          <hr className="hr" />

          <label className="small" style={{ display: 'block', marginBottom: 6 }}>API Base URL</label>
          <input className="input" value={api} onChange={e => setApi(e.target.value)} />
          <div className="small" style={{ marginTop: 8 }}>
            Docker: <span className="mono">http://localhost:8000</span> · Local: <span className="mono">http://127.0.0.1:8000</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btnPrimary" onClick={() => setSettings(s => ({ ...s, apiBaseUrl: api.trim() || DEFAULT_API }))}>Save</button>
            <button className="btn" onClick={() => { setApi(DEFAULT_API); setSettings(s => ({ ...s, apiBaseUrl: DEFAULT_API })); }}>Reset</button>
            <button className="btn" onClick={test}>Test</button>
          </div>

          {testMsg && <div className="small" style={{ marginTop: 10 }}>{testMsg}</div>}

          <hr className="hr" />

          <div className="small" style={{ marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className={`btn ${settings.theme === 'dark' ? 'btnPrimary' : ''}`} onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}>Dark</button>
            <button className={`btn ${settings.theme === 'light' ? 'btnPrimary' : ''}`} onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}>Light</button>
          </div>

          <hr className="hr" />

          <button className="btn" onClick={clearLocalAi}>
            <Trash2 size={16} /> Clear local AI data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Shared UI ===================== */

function ProgressBar({ value01 }: { value01: number }) {
  const w = clamp(Math.round(value01 * 100), 0, 100);
  return (
    <div style={{ height: 10, borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg,#34d399,#10B981)' }} />
    </div>
  );
}

function ApiErrorBox({ err }: { err: ApiErr }) {
  const nav = useNavigate();
  const isBad = err.kind === 'network' || err.status === 404;

  return (
    <div className="card" style={{ boxShadow: 'none', borderColor: isBad ? 'rgba(239,68,68,0.35)' : undefined }}>
      <div className="cardBody">
        <div style={{ fontWeight: 950, color: isBad ? '#ef4444' : 'var(--text)' }}>
          {err.kind === 'network' ? 'Network Error' : err.status ? `API Error (${err.status})` : 'API Error'}
        </div>
        <div className="small" style={{ marginTop: 6 }}>{err.message}</div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" onClick={() => nav('/settings')}>Open Settings</button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const nav = useNavigate();
  return (
    <div className="card">
      <div className="cardBody">
        <div style={{ fontWeight: 950, fontSize: 18 }}>Page not found</div>
        <p className="small" style={{ marginTop: 8 }}>This route doesn’t exist.</p>
        <button className="btn btnPrimary" onClick={() => nav('/')}>Go to Landing</button>
      </div>
    </div>
  );
}