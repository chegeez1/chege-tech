import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  LayoutDashboard, Package, ArrowLeftRight, Tags,
  LogOut, TrendingUp, CheckCircle, Clock, XCircle, Mail,
  Plus, Trash2, Edit2, Eye, EyeOff, RefreshCw, Users,
  Shield, QrCode, Key, Power, ChevronDown, ChevronUp,
  Save, X, BadgePercent, Star, RotateCcw, Zap, Settings,
  CreditCard, AlertTriangle, Lock, Unlock, Copy, Activity,
  Terminal, Info, TriangleAlert, Filter, Upload, Download,
  Search, BarChart2, Loader2, FileCheck, ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

type Tab = "dashboard" | "plans" | "accounts" | "promos" | "transactions" | "apikeys" | "customers" | "logs" | "settings";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  success: { label: "Completed", icon: CheckCircle, color: "text-emerald-400" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-400" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-400" },
};

function getToken() { return localStorage.getItem("admin_token"); }
function setToken(t: string) { localStorage.setItem("admin_token", t); }
function clearToken() { localStorage.removeItem("admin_token"); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// authFetch: for authenticated admin API calls (auto-logout on 401)
async function authFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  return res.json();
}

// plainFetch: for login and pre-auth flows (never auto-logout)
async function plainFetch(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN
// ═══════════════════════════════════════════════════════════════
export default function Admin() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [, setLocation] = useLocation();

  function login(t: string) { setToken(t); setTokenState(t); }
  function logout() { clearToken(); setTokenState(null); }

  if (!token) return <LoginFlow onLogin={login} />;

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.3 }} />
        <div className="bg-orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.25 }} />
      </div>

      {/* Sidebar */}
      <aside className="relative z-10 w-56 shrink-0 glass-nav border-r border-white/8 flex flex-col">
        <div className="p-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="Chege Tech" className="w-9 h-9 rounded-xl shadow-lg" style={{ boxShadow: "0 0 14px rgba(99,102,241,0.4)" }} />
            <div>
              <p className="font-bold text-sm text-white">Admin Panel</p>
              <p className="text-xs text-white/40">Premium Subs</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {([
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "plans", label: "Plans & Offers", icon: Tags },
            { id: "accounts", label: "Accounts", icon: Package },
            { id: "promos", label: "Promo Codes", icon: BadgePercent },
            { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
            { id: "apikeys", label: "API Keys", icon: Key },
            { id: "customers", label: "Customers", icon: Users },
            { id: "logs", label: "Activity Logs", icon: Activity },
            { id: "settings", label: "Settings", icon: Settings },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`nav-${id}`}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-gradient-to-r from-indigo-600/80 to-violet-600/80 text-white shadow-lg border border-white/10"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/8 space-y-1">
          <button
            onClick={() => setLocation("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all"
            data-testid="button-view-store"
          >
            <Zap className="w-4 h-4" />View Store
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "plans" && <PlansTab />}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "promos" && <PromosTab />}
          {activeTab === "transactions" && <TransactionsTab />}
          {activeTab === "apikeys" && <ApiKeysTab />}
          {activeTab === "customers" && <CustomersTab />}
          {activeTab === "logs" && <LogsTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGIN FLOW  (pre-auth - uses plainFetch only)
// ═══════════════════════════════════════════════════════════════
function LoginFlow({ onLogin }: { onLogin: (token: string) => void }) {
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const { data: statusData } = useQuery<{ setupComplete: boolean }>({
    queryKey: ["/api/admin/2fa-status"],
  });
  const setupComplete = statusData?.setupComplete ?? false;

  const form = useForm({
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  async function handleLogin(values: { email: string; password: string; totpCode: string }) {
    setIsLoading(true);
    setLoginError("");
    try {
      const data = await plainFetch("/api/admin/login", {
        email: values.email,
        password: values.password,
        totpCode: values.totpCode || undefined,
      });
      if (data.success) {
        onLogin(data.token);
      } else {
        setLoginError(data.error || "Login failed. Check your credentials.");
      }
    } catch {
      setLoginError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="bg-orb w-[600px] h-[600px] bg-indigo-600 top-[-200px] left-[-150px]" style={{ opacity: 0.35 }} />
        <div className="bg-orb w-[500px] h-[500px] bg-violet-700 bottom-[-150px] right-[-100px]" style={{ opacity: 0.30 }} />
        <div className="bg-orb w-[300px] h-[300px] bg-blue-500 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.15 }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-5 shadow-2xl" style={{ boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Login</h1>
          <p className="text-white/40 text-sm">Secure admin access</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="admin@example.com" autoComplete="email"
                      className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50"
                      data-testid="input-admin-email" />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type={showPwd ? "text" : "password"} placeholder="••••••••" autoComplete="current-password"
                        className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50 pr-10"
                        data-testid="input-admin-password" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                </FormItem>
              )} />

              {setupComplete && (
                <FormField control={form.control} name="totpCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3 h-3" />Authenticator Code
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="000000" maxLength={6} inputMode="numeric"
                        className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 text-center font-mono text-xl tracking-[0.5em] focus:border-indigo-500/50"
                        data-testid="input-totp" />
                    </FormControl>
                  </FormItem>
                )} />
              )}

              {loginError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <Button type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-semibold h-11 shadow-lg hover:opacity-90 transition-opacity mt-2"
                style={{ boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}
                data-testid="button-login">
                {isLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Logging in...</>
                ) : "Login"}
              </Button>
            </form>
          </Form>

          {!setupComplete && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <p className="text-xs text-white/30 text-center">
                2FA not set up — configure it inside the admin panel after logging in
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-white/30 hover:text-white/60">
            Back to Store
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB  (2FA setup + Paystack config)
// ═══════════════════════════════════════════════════════════════
function SettingsTab() {
  const { toast } = useToast();
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  const { data: secretsData } = useQuery<{ secrets: any }>({
    queryKey: ["/api/admin/secrets"],
    queryFn: () => authFetch("/api/admin/secrets"),
  });
  const s = secretsData?.secrets;

  // ─── App Config state ────────────────────────────────────────
  const { data: configData, refetch: refetchConfig } = useQuery<any>({
    queryKey: ["/api/admin/app-config"],
    queryFn: () => authFetch("/api/admin/app-config"),
  });
  const [appCfg, setAppCfg] = useState<any>(null);
  const [cfgDirty, setCfgDirty] = useState(false);
  if (configData?.config && !appCfg) setAppCfg(configData.config);

  const saveCfgMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/app-config", { method: "PUT", body: JSON.stringify(appCfg) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "Settings saved" }); setCfgDirty(false); refetchConfig(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  function updateCfg(key: string, value: any) {
    setAppCfg((prev: any) => ({ ...prev, [key]: value }));
    setCfgDirty(true);
  }

  // ─── 2FA state ──────────────────────────────────────────────
  const [tfaStep, setTfaStep] = useState<"idle" | "qr" | "verify">("idle");
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoadingTfa, setIsLoadingTfa] = useState(false);
  const [tfaError, setTfaError] = useState("");
  const [tfaCreds, setTfaCreds] = useState({ email: "", password: "" });
  const [showTfaPwd, setShowTfaPwd] = useState(false);

  const { data: statusData, refetch: refetchStatus } = useQuery<{ setupComplete: boolean }>({
    queryKey: ["/api/admin/2fa-status"],
  });
  const setupComplete = statusData?.setupComplete ?? false;

  async function startSetup() {
    if (!tfaCreds.email || !tfaCreds.password) { setTfaError("Enter your admin credentials first"); return; }
    setIsLoadingTfa(true); setTfaError("");
    try {
      const data = await plainFetch("/api/admin/2fa-setup", tfaCreds);
      if (data.success) { setSetupData({ secret: data.secret, qrCodeDataUrl: data.qrCodeDataUrl }); setTfaStep("qr"); }
      else setTfaError(data.error || "Failed to generate QR code");
    } catch { setTfaError("Connection error"); }
    finally { setIsLoadingTfa(false); }
  }

  async function verifySetup() {
    if (verifyCode.length !== 6) { setTfaError("Enter the 6-digit code"); return; }
    setIsLoadingTfa(true); setTfaError("");
    try {
      const data = await plainFetch("/api/admin/2fa-complete", { ...tfaCreds, secret: setupData?.secret, totpCode: verifyCode });
      if (data.success) {
        toast({ title: "2FA enabled!" });
        setTfaStep("idle"); setSetupData(null); setVerifyCode(""); setTfaCreds({ email: "", password: "" });
        refetchStatus();
      } else setTfaError(data.error || "Invalid code");
    } catch { setTfaError("Connection error"); }
    finally { setIsLoadingTfa(false); }
  }


  return (
    <>
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
      <div className="space-y-5 max-w-2xl">

        {/* ─── App Config (Editable) ───────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-white">App Settings</p>
                <p className="text-xs text-white/40">Site name, WhatsApp, domains, support email</p>
              </div>
            </div>
            {cfgDirty && (
              <Button onClick={() => saveCfgMutation.mutate()} disabled={saveCfgMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 border-0 text-white text-xs h-8 px-3"
                data-testid="button-save-config">
                <Save className="w-3.5 h-3.5 mr-1.5" />{saveCfgMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
          {appCfg ? (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Site Name</label>
                  <Input value={appCfg.siteName || ""} onChange={(e) => updateCfg("siteName", e.target.value)}
                    placeholder="Chege Tech" className={inputCls} data-testid="input-site-name" />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Support Email</label>
                  <Input value={appCfg.supportEmail || ""} onChange={(e) => updateCfg("supportEmail", e.target.value)}
                    placeholder="support@example.com" type="email" className={inputCls} data-testid="input-support-email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">WhatsApp Number</label>
                  <Input value={appCfg.whatsappNumber || ""} onChange={(e) => updateCfg("whatsappNumber", e.target.value)}
                    placeholder="+254114291301" className={inputCls} data-testid="input-whatsapp-number" />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Custom Domain</label>
                  <Input value={appCfg.customDomain || ""} onChange={(e) => updateCfg("customDomain", e.target.value)}
                    placeholder="chegetech.com" className={inputCls} data-testid="input-custom-domain" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">WhatsApp Channel URL</label>
                <Input value={appCfg.whatsappChannel || ""} onChange={(e) => updateCfg("whatsappChannel", e.target.value)}
                  placeholder="https://whatsapp.com/channel/..." className={inputCls} data-testid="input-whatsapp-channel" />
                <p className="text-[10px] text-white/25 mt-1">Customers are redirected here after a successful purchase</p>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-xl">
                <div>
                  <p className="text-sm text-white">Chat Assistant</p>
                  <p className="text-xs text-white/40">Show floating WhatsApp chat button on all pages</p>
                </div>
                <Switch checked={!!appCfg.chatAssistantEnabled} onCheckedChange={(v) => updateCfg("chatAssistantEnabled", v)} data-testid="toggle-chat-assistant" />
              </div>
            </div>
          ) : (
            <div className="p-5 text-center text-white/30 text-sm">Loading...</div>
          )}
        </div>

        {/* ─── Credentials Editor ─────────────────────────── */}
        <CredentialsEditor inputCls={inputCls} />

        {/* ─── 2FA ─────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Two-Factor Authentication (2FA)</p>
                  <p className="text-xs text-white/40">Require an authenticator app code on every login</p>
                </div>
              </div>
              {setupComplete
                ? <Badge className="bg-emerald-600/80 text-white border-0 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                : <Badge className="glass border-white/10 text-white/50 text-xs">Not Set Up</Badge>}
            </div>
          </div>
          <div className="p-5">
            {tfaStep === "idle" && (
              <div className="space-y-4">
                {setupComplete ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-xs text-emerald-300">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    2FA is active. Enter your credentials below to reconfigure.
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    2FA is not set up. Protect your account by enabling it below.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Your Admin Email</label>
                    <Input value={tfaCreds.email} onChange={(e) => setTfaCreds(p => ({ ...p, email: e.target.value }))} type="email" placeholder="admin@example.com" className={inputCls} data-testid="input-2fa-email" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Your Admin Password</label>
                    <div className="relative">
                      <Input value={tfaCreds.password} onChange={(e) => setTfaCreds(p => ({ ...p, password: e.target.value }))} type={showTfaPwd ? "text" : "password"} placeholder="••••••••" className={inputCls + " pr-9"} data-testid="input-2fa-password" />
                      <button type="button" onClick={() => setShowTfaPwd(!showTfaPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showTfaPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
                <Button onClick={startSetup} disabled={isLoadingTfa} data-testid="button-start-2fa"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90">
                  <QrCode className="w-4 h-4 mr-2" />
                  {isLoadingTfa ? "Generating..." : `${setupComplete ? "Reconfigure" : "Set Up"} 2FA`}
                </Button>
              </div>
            )}
            {tfaStep === "qr" && setupData && (
              <div className="space-y-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg" />
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    <p className="text-sm font-semibold text-white">Scan with your authenticator app</p>
                    <p className="text-xs text-white/40">Works with Google Authenticator, Authy, Microsoft Authenticator, or any TOTP app.</p>
                    <div className="glass rounded-xl p-3">
                      <p className="text-xs text-white/30 mb-1">Or enter this code manually:</p>
                      <p className="font-mono text-xs text-indigo-300 break-all">{setupData.secret}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setTfaStep("verify")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white hover:opacity-90" data-testid="button-next-verify">
                    I've Scanned It → Verify
                  </Button>
                  <Button variant="outline" className="glass border-white/10 text-white/60 hover:text-white" onClick={() => { setTfaStep("idle"); setSetupData(null); setTfaError(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {tfaStep === "verify" && (
              <div className="space-y-4">
                <p className="text-sm text-white/70">Enter the 6-digit code from your authenticator app:</p>
                <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6} inputMode="numeric"
                  className={inputCls + " text-center font-mono text-3xl tracking-[0.5em] h-16"}
                  data-testid="input-verify-code" />
                {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
                <div className="flex gap-3">
                  <Button onClick={verifySetup} disabled={verifyCode.length !== 6 || isLoadingTfa}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 border-0 text-white hover:opacity-90" data-testid="button-enable-2fa">
                    {isLoadingTfa ? "Verifying..." : "Enable 2FA"}
                  </Button>
                  <Button variant="outline" className="glass border-white/10 text-white/60 hover:text-white" onClick={() => setTfaStep("qr")}>
                    Back to QR
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

function SettingsSection({ icon: Icon, iconBg, iconColor, title, subtitle, badge, children }: {
  icon: any; iconBg: string; iconColor: string; title: string; subtitle: string; badge?: any; children: any;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-xs text-white/40">{subtitle}</p>
            </div>
          </div>
          {badge}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab() {
  const { data: statsData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => authFetch("/api/admin/stats"),
    refetchInterval: 30000,
  });
  const { data: analyticsData } = useQuery<any>({
    queryKey: ["/api/admin/analytics"],
    queryFn: () => authFetch("/api/admin/analytics"),
    refetchInterval: 60000,
  });
  const stats = statsData?.transactions;
  const accStats = statsData?.accounts;
  const daily: Array<{ date: string; revenue: number; orders: number }> = analyticsData?.daily ?? [];
  const topPlans: Array<{ planName: string; revenue: number; orders: number }> = analyticsData?.topPlans ?? [];
  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const maxPlanRev = Math.max(...topPlans.map((p) => p.revenue), 1);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <Button size="sm" variant="outline" onClick={() => refetch()}
          className="glass border-white/10 text-white/60 hover:text-white" data-testid="button-refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl glass animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <GlassStatCard title="Total Revenue" value={`KES ${(stats?.revenue || 0).toLocaleString()}`} icon={TrendingUp} gradient="from-emerald-500 to-teal-600" glow="rgba(16,185,129,0.3)" />
            <GlassStatCard title="Total Orders" value={stats?.total ?? 0} icon={ArrowLeftRight} gradient="from-indigo-500 to-blue-600" glow="rgba(99,102,241,0.3)" />
            <GlassStatCard title="Emails Sent" value={stats?.emailsSent ?? 0} icon={Mail} gradient="from-violet-500 to-purple-600" glow="rgba(139,92,246,0.3)" />
            <GlassStatCard title="Active Accounts" value={accStats?.totalAccounts ?? 0} icon={Package} gradient="from-cyan-500 to-blue-500" glow="rgba(6,182,212,0.3)" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Completed", value: stats?.completed ?? 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Available Slots", value: accStats?.availableSlots ?? 0, icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${color}`} /></div>
                <div><p className="text-xs text-white/40">{label}</p><p className="text-xl font-bold text-white">{value}</p></div>
              </div>
            ))}
          </div>

          {daily.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-white text-sm">Revenue — Last 14 Days</h3>
                </div>
                <div className="flex items-end gap-1 h-24">
                  {daily.map((d) => {
                    const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                    const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${label}: KES ${d.revenue.toLocaleString()}`}>
                        <div
                          className="w-full rounded-t-sm bg-gradient-to-t from-indigo-600 to-violet-500 opacity-70 group-hover:opacity-100 transition-all min-h-[2px]"
                          style={{ height: `${Math.max(heightPct, d.revenue > 0 ? 8 : 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-white/25">{daily[0]?.date ? new Date(daily[0].date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                  <span className="text-xs text-white/25">Today</span>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-white text-sm">Top Plans by Revenue</h3>
                </div>
                {topPlans.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-6">No sales yet</p>
                ) : (
                  <div className="space-y-3">
                    {topPlans.map((plan, i) => (
                      <div key={plan.planName}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/70 font-medium truncate max-w-[60%]">{plan.planName}</span>
                          <span className="text-xs text-indigo-400 font-bold">KES {plan.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-indigo-500 to-violet-500" : i === 1 ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}
                            style={{ width: `${(plan.revenue / maxPlanRev) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">{plan.orders} order{plan.orders !== 1 ? "s" : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLANS TAB
// ═══════════════════════════════════════════════════════════════
function PlansTab() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ price: string; offerLabel: string }>({ price: "", offerLabel: "" });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({});

  const { data: plansData, refetch: refetchPlans } = useQuery<any>({ queryKey: ["/api/plans"] });
  const { data: overridesData, refetch: refetchOverrides } = useQuery<any>({
    queryKey: ["/api/admin/plan-overrides"],
    queryFn: () => authFetch("/api/admin/plan-overrides"),
  });
  const { data: customPlansData, refetch: refetchCustom } = useQuery<any>({
    queryKey: ["/api/admin/custom-plans"],
    queryFn: () => authFetch("/api/admin/custom-plans"),
  });

  const overrides: Record<string, any> = overridesData?.overrides ?? {};
  const categories = plansData?.categories ?? {};

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: any }) =>
      authFetch(`/api/admin/plans/${planId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Plan updated" }); refetchPlans(); refetchOverrides(); setEditingPlan(null); },
  });

  const toggleDisableMutation = useMutation({
    mutationFn: ({ planId, disabled }: { planId: string; disabled: boolean }) =>
      authFetch(`/api/admin/plans/${planId}`, { method: "PUT", body: JSON.stringify({ disabled }) }),
    onSuccess: () => { refetchPlans(); refetchOverrides(); },
  });

  const resetOverrideMutation = useMutation({
    mutationFn: (planId: string) => authFetch(`/api/admin/plans/${planId}/override`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Override removed" }); refetchPlans(); refetchOverrides(); },
  });

  const deleteCustomMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/custom-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Custom plan removed" }); refetchPlans(); refetchCustom(); },
  });

  const addCustomForm = useForm({
    defaultValues: { name: "", price: "", duration: "1 Month", features: "", categoryKey: "streaming", categoryName: "Streaming Services", maxUsers: "5" },
  });

  const addCustomMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/custom-plans", {
      method: "POST",
      body: JSON.stringify({ ...d, price: parseInt(d.price), maxUsers: parseInt(d.maxUsers), features: d.features.split(",").map((f: string) => f.trim()).filter(Boolean) }),
    }),
    onSuccess: () => { toast({ title: "Custom plan added" }); setShowAddCustom(false); addCustomForm.reset(); refetchPlans(); refetchCustom(); },
  });

  const allPlanEntries = Object.entries(categories).flatMap(([catKey, cat]: [string, any]) =>
    Object.entries(cat.plans).map(([planId, plan]: [string, any]) => ({ planId, plan, catKey, catName: cat.category }))
  );

  const grouped = allPlanEntries.reduce((acc, entry) => {
    if (!acc[entry.catKey]) acc[entry.catKey] = { name: entry.catName, plans: [] };
    acc[entry.catKey].plans.push(entry);
    return acc;
  }, {} as Record<string, { name: string; plans: typeof allPlanEntries }>);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Plans & Offers</h1>
        <Button size="sm" onClick={() => setShowAddCustom(!showAddCustom)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90"
          data-testid="button-add-custom-plan">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add Custom Plan
        </Button>
      </div>

      {showAddCustom && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Add Custom Plan</h3>
          <form onSubmit={addCustomForm.handleSubmit((d) => addCustomMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-white/50 block mb-1">Plan Name</label><Input {...addCustomForm.register("name")} placeholder="e.g. Disney+" className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Price (KES)</label><Input {...addCustomForm.register("price")} type="number" placeholder="250" className="glass border-white/10 bg-white/5 text-white" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Duration</label><Input {...addCustomForm.register("duration")} placeholder="1 Month" className="glass border-white/10 bg-white/5 text-white" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Max Users</label><Input {...addCustomForm.register("maxUsers")} type="number" placeholder="5" className="glass border-white/10 bg-white/5 text-white" /></div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Category</label>
                <select {...addCustomForm.register("categoryKey")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm">
                  <option value="streaming">Streaming</option>
                  <option value="music">Music</option>
                  <option value="productivity">Productivity</option>
                  <option value="vpn">VPN</option>
                  <option value="gaming">Gaming</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Category Display Name</label><Input {...addCustomForm.register("categoryName")} placeholder="Entertainment" className="glass border-white/10 bg-white/5 text-white" /></div>
            </div>
            <div><label className="text-xs text-white/50 block mb-1">Features (comma-separated)</label><Input {...addCustomForm.register("features")} placeholder="HD Streaming, Multiple Devices" className="glass border-white/10 bg-white/5 text-white" /></div>
            <div className="flex gap-3">
              <Button type="submit" disabled={addCustomMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">
                {addCustomMutation.isPending ? "Saving..." : "Save Plan"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => setShowAddCustom(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(grouped).map(([catKey, { name, plans }]) => {
          const isExpanded = expandedCat[catKey] !== false;
          return (
            <div key={catKey} className="glass-card rounded-2xl overflow-hidden">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => setExpandedCat((p) => ({ ...p, [catKey]: !isExpanded }))}>
                <span className="font-semibold text-white">{name}</span>
                <div className="flex items-center gap-2">
                  <Badge className="glass border-white/10 text-white/60 text-xs">{plans.length} plans</Badge>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {plans.map(({ planId, plan }) => {
                    const override = overrides[planId] || {};
                    const isDisabled = override.disabled;
                    const isEditing = editingPlan === planId;
                    const hasOverride = override.priceOverride !== undefined || override.offerLabel;
                    return (
                      <div key={planId} className={`p-4 ${isDisabled ? "opacity-50" : ""}`} data-testid={`plan-row-${planId}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-white">{plan.name}</span>
                              {plan.isCustom && <Badge className="glass border-white/10 text-white/50 text-xs">Custom</Badge>}
                              {override.offerLabel && <Badge className="bg-amber-500/80 text-white border-0 text-xs">{override.offerLabel}</Badge>}
                              {isDisabled && <Badge className="glass border-white/10 text-white/40 text-xs">Disabled</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {override.priceOverride ? (
                                <>
                                  <span className="text-sm font-bold text-indigo-400">KES {(override.priceOverride ?? 0).toLocaleString()}</span>
                                  <span className="text-xs text-white/30 line-through">KES {(plan.originalPrice ?? plan.price ?? 0).toLocaleString()}</span>
                                </>
                              ) : (
                                <span className="text-sm font-bold text-white/80">KES {(plan.price ?? 0).toLocaleString()}</span>
                              )}
                              <span className="text-xs text-white/30">· {plan.duration}</span>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input value={editValues.price} onChange={(e) => setEditValues((p) => ({ ...p, price: e.target.value }))} className="w-28 h-8 text-sm glass border-white/10 bg-white/5 text-white" placeholder="Price KES" />
                              <Input value={editValues.offerLabel} onChange={(e) => setEditValues((p) => ({ ...p, offerLabel: e.target.value }))} className="w-32 h-8 text-sm glass border-white/10 bg-white/5 text-white" placeholder="Offer label" />
                              <Button size="sm" onClick={() => {
                                const price = parseInt(editValues.price);
                                if (isNaN(price) || price <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
                                updatePlanMutation.mutate({ planId, data: { priceOverride: price, offerLabel: editValues.offerLabel || undefined } });
                              }} disabled={updatePlanMutation.isPending} className="bg-indigo-600 border-0 text-white h-8">
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-white/40 h-8" onClick={() => setEditingPlan(null)}><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" variant="outline" className="glass border-white/10 text-white/60 hover:text-white h-8"
                                onClick={() => { setEditingPlan(planId); setEditValues({ price: String(override.priceOverride ?? plan.price), offerLabel: override.offerLabel ?? "" }); }}>
                                <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                              {hasOverride && (
                                <Button size="sm" variant="ghost" className="text-white/30 hover:text-white/60 h-8" onClick={() => resetOverrideMutation.mutate(planId)} title="Reset to original">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <div className="flex items-center gap-1.5" title={isDisabled ? "Enable plan" : "Disable plan"}>
                                {isDisabled ? <Lock className="w-3 h-3 text-white/30" /> : <Unlock className="w-3 h-3 text-white/30" />}
                                <Switch checked={!isDisabled} onCheckedChange={(v) => toggleDisableMutation.mutate({ planId, disabled: !v })} />
                              </div>
                              {plan.isCustom && (
                                <Button size="icon" variant="ghost" className="text-red-400/60 hover:text-red-400 h-8 w-8" onClick={() => deleteCustomMutation.mutate(planId)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNTS TAB
// ═══════════════════════════════════════════════════════════════
function BulkUploadModal({ planOptions, onClose, onSuccess }: { planOptions: any[]; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [planId, setPlanId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const HEADERS = ["email", "password", "username", "activationCode", "redeemLink", "instructions", "maxUsers"];

  function parseCSV(text: string): any[] {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    const first = lines[0].toLowerCase();
    const hasHeader = HEADERS.some((h) => first.includes(h));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        email: cols[0] || "", password: cols[1] || "", username: cols[2] || "",
        activationCode: cols[3] || "", redeemLink: cols[4] || "", instructions: cols[5] || "",
        maxUsers: parseInt(cols[6]) || 5,
      };
    }).filter((r) => r.email || r.password);
  }

  const parsed = csvText ? parseCSV(csvText) : [];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || "");
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (!planId) { toast({ title: "Select a plan first", variant: "destructive" }); return; }
    if (!parsed.length) { toast({ title: "No valid rows found", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/admin/accounts/bulk", {
        method: "POST",
        body: JSON.stringify({ planId, accounts: parsed }),
      });
      if (res.success) {
        toast({ title: `${res.added} account${res.added !== 1 ? "s" : ""} added!`, description: res.errors?.length ? `${res.errors.length} row(s) had errors` : undefined });
        onSuccess();
        onClose();
      } else {
        toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl glass-card rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-lg">Bulk Account Upload</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-white/50 block mb-1">Plan *</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm"
              data-testid="select-bulk-plan">
              <option value="">Select a plan</option>
              {planOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name} ({opt.category})</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">CSV Data *</label>
              <label className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 flex items-center gap-1" data-testid="label-upload-file">
                <Upload className="w-3 h-3" />Upload .csv file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </label>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Paste CSV rows here. Supported format:\nemail,password,username,activationCode,redeemLink,instructions,maxUsers\n\nExample:\nuser@netflix.com,pass123,,,,,5\nuser2@netflix.com,pass456`}
              rows={8}
              className="w-full rounded-xl glass border border-white/10 bg-white/5 text-white placeholder:text-white/20 p-3 text-sm font-mono resize-none focus:outline-none focus:border-indigo-500/50"
              data-testid="textarea-csv"
            />
            <p className="text-xs text-white/30 mt-1">Header row is auto-detected and skipped. Minimum: email,password</p>
          </div>

          {parsed.length > 0 && (
            <div>
              <p className="text-xs text-white/50 mb-2">{parsed.length} row{parsed.length !== 1 ? "s" : ""} detected — preview:</p>
              <div className="rounded-xl overflow-hidden border border-white/8 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-white/5 text-white/40"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Password</th><th className="px-3 py-2 text-left">Slots</th></tr></thead>
                  <tbody>
                    {parsed.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/3" data-testid={`preview-row-${i}`}>
                        <td className="px-3 py-1.5 text-white/30">{i + 1}</td>
                        <td className="px-3 py-1.5 text-white/70 font-mono">{r.email || <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-white/50 font-mono">{r.password ? "••••••" : <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-white/50">{r.maxUsers}</td>
                      </tr>
                    ))}
                    {parsed.length > 20 && <tr><td colSpan={4} className="px-3 py-2 text-white/30 text-center">... and {parsed.length - 20} more</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting || !planId || !parsed.length}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white flex-1"
              data-testid="button-bulk-submit">
              {submitting ? "Uploading..." : `Upload ${parsed.length || ""} Account${parsed.length !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="outline" className="glass border-white/10 text-white/60" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

  const { data: accData, refetch } = useQuery<any>({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => authFetch("/api/admin/accounts"),
  });
  const { data: plansData } = useQuery<any>({ queryKey: ["/api/plans"] });

  const allPlanOptions = plansData?.categories
    ? Object.entries(plansData.categories).flatMap(([, cat]: [string, any]) =>
        Object.entries(cat.plans).map(([planId, plan]: [string, any]) => ({ id: planId, name: plan.name, category: cat.category }))
      )
    : [];

  const addForm = useForm({ defaultValues: { planId: "", email: "", username: "", password: "", activationCode: "", redeemLink: "", instructions: "", maxUsers: "5" } });

  const addMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/accounts", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (d: any) => {
      if (d.success) { toast({ title: "Account added" }); addForm.reset(); setShowAddForm(false); refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => authFetch(`/api/admin/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Account updated" }); setEditingId(null); refetch(); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/accounts/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Account removed" }); refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); },
  });

  const accounts: Record<string, any[]> = accData?.accounts ?? {};
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 h-8 text-sm";

  return (
    <>
      {showBulkUpload && (
        <BulkUploadModal
          planOptions={allPlanOptions}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => { refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Account Inventory</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBulkUpload(true)}
            className="glass border-white/10 text-white/60 hover:text-white"
            data-testid="button-bulk-upload">
            <Upload className="w-3.5 h-3.5 mr-1.5" />Bulk Upload
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90"
            data-testid="button-add-account">
            <Plus className="w-3.5 h-3.5 mr-1.5" />Add Account
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Add New Account</h3>
          <form onSubmit={addForm.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">Plan</label>
                <select {...addForm.register("planId")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm" data-testid="select-plan">
                  <option value="">Select a plan</option>
                  {allPlanOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name} ({opt.category})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Max Slots</label><Input {...addForm.register("maxUsers")} type="number" className={inputCls} data-testid="input-max-users" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Email</label><Input {...addForm.register("email")} placeholder="account@service.com" className={inputCls} data-testid="input-account-email" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Password</label><Input {...addForm.register("password")} className={inputCls} data-testid="input-account-password" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Username (optional)</label><Input {...addForm.register("username")} className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Activation Code (optional)</label><Input {...addForm.register("activationCode")} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className="text-xs text-white/50 block mb-1">Instructions (optional)</label><Input {...addForm.register("instructions")} className={inputCls} /></div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={addMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">
                {addMutation.isPending ? "Saving..." : "Save Account"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {Object.keys(accounts).length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <Package className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <p className="font-semibold text-white">No accounts yet</p>
          <p className="text-sm text-white/40">Click "Add Account" to add your first account</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(accounts).map(([planId, accs]) => {
            const planName = allPlanOptions.find((p) => p.id === planId)?.name ?? planId;
            const isExpanded = expandedPlans[planId] !== false;
            return (
              <div key={planId} className="glass-card rounded-2xl overflow-hidden" data-testid={`account-group-${planId}`}>
                <button className="w-full p-4 flex items-center justify-between gap-4 text-left" onClick={() => setExpandedPlans((p) => ({ ...p, [planId]: !isExpanded }))}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center"><Package className="w-4 h-4 text-indigo-400" /></div>
                    <div><p className="font-semibold text-sm text-white">{planName}</p><p className="text-xs text-white/40">{accs.length} account{accs.length !== 1 ? "s" : ""}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${accs.some((a) => !a.fullyUsed && !a.disabled) ? "bg-emerald-600/80 text-white border-0" : "glass border-white/10 text-white/50"}`}>
                      {accs.filter((a) => !a.fullyUsed && !a.disabled).length} available
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {accs.map((acc: any) => (
                      <div key={acc.id} className={`p-4 ${acc.disabled ? "opacity-50" : ""}`} data-testid={`account-row-${acc.id}`}>
                        {editingId === acc.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-xs text-white/40">Email</label><Input value={editValues.email ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, email: e.target.value }))} className={inputCls + " mt-1"} /></div>
                              <div><label className="text-xs text-white/40">Password</label><Input value={editValues.password ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, password: e.target.value }))} className={inputCls + " mt-1"} /></div>
                              <div><label className="text-xs text-white/40">Username</label><Input value={editValues.username ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, username: e.target.value }))} className={inputCls + " mt-1"} /></div>
                              <div><label className="text-xs text-white/40">Max Slots</label><Input type="number" value={editValues.maxUsers ?? 5} onChange={(e) => setEditValues((p: any) => ({ ...p, maxUsers: parseInt(e.target.value) }))} className={inputCls + " mt-1"} /></div>
                              <div className="col-span-2"><label className="text-xs text-white/40">Instructions</label><Input value={editValues.instructions ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, instructions: e.target.value }))} className={inputCls + " mt-1"} /></div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateMutation.mutate({ id: acc.id, data: editValues })} disabled={updateMutation.isPending} className="bg-indigo-600 border-0 text-white h-8">
                                <Save className="w-3.5 h-3.5 mr-1" />Save
                              </Button>
                              <Button size="sm" variant="ghost" className="text-white/40 h-8" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">{acc.email || acc.username || "No identifier"}</span>
                                {acc.disabled ? (
                                  <Badge className="glass border-white/10 text-white/40 text-xs">Disabled</Badge>
                                ) : acc.fullyUsed ? (
                                  <Badge className="glass border-white/10 text-white/40 text-xs">Full</Badge>
                                ) : (
                                  <Badge className="bg-emerald-600/70 text-white border-0 text-xs">{acc.currentUsers}/{acc.maxUsers} slots</Badge>
                                )}
                              </div>
                              <p className="text-xs text-white/30 mt-0.5">Added {new Date(acc.addedAt).toLocaleDateString()} · {acc.usedBy?.length ?? 0} assigned</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button size="sm" variant="outline" className="glass border-white/10 text-white/60 hover:text-white h-8"
                                onClick={() => { setEditingId(acc.id); setEditValues({ email: acc.email, password: acc.password, username: acc.username, maxUsers: acc.maxUsers, instructions: acc.instructions }); }}>
                                <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                              <Button size="sm" variant="outline"
                                className={`h-8 ${acc.disabled ? "bg-indigo-600/80 border-indigo-500/50 text-white" : "glass border-white/10 text-white/60 hover:text-white"}`}
                                onClick={() => toggleMutation.mutate(acc.id)}>
                                <Power className="w-3.5 h-3.5 mr-1" />{acc.disabled ? "Enable" : "Disable"}
                              </Button>
                              <Button size="icon" variant="ghost" className="text-red-400/50 hover:text-red-400 h-8 w-8" onClick={() => deleteMutation.mutate(acc.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROMO CODES TAB
// ═══════════════════════════════════════════════════════════════
function PromosTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => authFetch("/api/admin/promo-codes"),
  });
  const codes: any[] = data?.codes ?? [];

  const form = useForm({
    defaultValues: { code: "", label: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "" },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/promo-codes", {
      method: "POST",
      body: JSON.stringify({ ...d, discountValue: parseInt(d.discountValue), maxUses: d.maxUses ? parseInt(d.maxUses) : null, expiresAt: d.expiresAt || null, applicablePlans: null }),
    }),
    onSuccess: (d: any) => {
      if (d.success) { toast({ title: "Promo code created!" }); form.reset({ code: "", label: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "" }); setShowAdd(false); refetch(); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) =>
      authFetch(`/api/admin/promo-codes/${code}`, { method: "PUT", body: JSON.stringify({ active }) }),
    onSuccess: () => refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => authFetch(`/api/admin/promo-codes/${code}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Promo code deleted" }); refetch(); },
  });

  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Promo Codes</h1>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white shadow-lg hover:opacity-90"
          data-testid="button-add-promo">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Create Code
        </Button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Create Promo Code</h3>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-white/50 block mb-1">Code</label><Input {...form.register("code")} placeholder="SAVE20" className={inputCls + " uppercase font-mono"} data-testid="input-promo-code" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Label (optional)</label><Input {...form.register("label")} placeholder="20% off summer" className={inputCls} /></div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Discount Type</label>
                <select {...form.register("discountType")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm">
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (KES)</option>
                </select>
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Discount Value</label><Input {...form.register("discountValue")} type="number" placeholder="20" className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Max Uses (blank = unlimited)</label><Input {...form.register("maxUses")} type="number" placeholder="Unlimited" className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Expires At (optional)</label><Input {...form.register("expiresAt")} type="date" className={inputCls} /></div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white">
                {createMutation.isPending ? "Creating..." : "Create Code"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <BadgePercent className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-white">No promo codes yet</p>
          <p className="text-sm text-white/40">Create your first discount code above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map((promo: any) => (
            <div key={promo.code} className="glass-card rounded-2xl p-4" data-testid={`promo-row-${promo.code}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <BadgePercent className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold font-mono text-white">{promo.code}</span>
                      {!promo.active && <Badge className="glass border-white/10 text-white/40 text-xs">Inactive</Badge>}
                      {promo.expiresAt && new Date(promo.expiresAt) < new Date() && <Badge className="bg-red-600/70 text-white border-0 text-xs">Expired</Badge>}
                    </div>
                    <p className="text-xs text-white/40">
                      {promo.discountType === "percent" ? `${promo.discountValue}% off` : `KES ${promo.discountValue} off`}
                      {promo.label ? ` · ${promo.label}` : ""}
                      {" · "}Used {promo.uses}/{promo.maxUses ?? "∞"}
                      {promo.expiresAt ? ` · Expires ${new Date(promo.expiresAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={promo.active} onCheckedChange={(v) => toggleMutation.mutate({ code: promo.code, active: v })} />
                  <Button size="icon" variant="ghost" className="text-red-400/50 hover:text-red-400 h-8 w-8" onClick={() => deleteMutation.mutate(promo.code)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ═══════════════════════════════════════════════════════════════
function TransactionsTab() {
  const { toast } = useToast();
  const { data: txData, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/transactions"],
    queryFn: () => authFetch("/api/admin/transactions"),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [resendingRef, setResendingRef] = useState<string | null>(null);
  const [proofRef, setProofRef] = useState<string | null>(null);
  const [proofData, setProofData] = useState<any>(null);
  const [proofLoading, setProofLoading] = useState(false);

  async function loadDeliveryProof(reference: string) {
    setProofRef(reference);
    setProofLoading(true);
    setProofData(null);
    try {
      const res = await authFetch(`/api/admin/delivery-proof/${reference}`);
      if (res.success) setProofData(res.proof);
    } catch {}
    setProofLoading(false);
  }

  const allTxs: any[] = txData?.transactions ?? [];
  const filtered = allTxs.filter((tx) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || tx.customerEmail?.toLowerCase().includes(q) || tx.planName?.toLowerCase().includes(q) || tx.reference?.toLowerCase().includes(q) || tx.customerName?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function resendCredentials(reference: string) {
    setResendingRef(reference);
    try {
      const res = await authFetch(`/api/admin/transactions/${reference}/resend`, { method: "POST" });
      if (res.success) toast({ title: "Credentials resent", description: "Email sent to customer" });
      else toast({ title: "Resend failed", description: res.error, variant: "destructive" });
    } catch {
      toast({ title: "Resend failed", variant: "destructive" });
    } finally {
      setResendingRef(null);
    }
  }

  function exportCSV() {
    const rows = [["Reference", "Plan", "Customer Name", "Customer Email", "Amount (KES)", "Status", "Email Sent", "Date"]];
    filtered.forEach((tx) => {
      rows.push([
        tx.reference || "", tx.planName || "", tx.customerName || "", tx.customerEmail || "",
        String(tx.amount || 0), tx.status || "", tx.emailSent ? "Yes" : "No",
        tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "",
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chege-tech-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${filtered.length} transactions` });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Transactions</h1>
        <Button size="sm" variant="outline" onClick={exportCSV} className="glass border-white/10 text-white/60 hover:text-white" data-testid="button-export-csv">
          <Download className="w-3.5 h-3.5 mr-1.5" />Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, plan, or reference..."
            className="pl-9 glass border-white/10 bg-white/5 text-white placeholder:text-white/25 h-9 text-sm"
            data-testid="input-tx-search"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "success", "pending", "failed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-indigo-600 text-white" : "glass border border-white/10 text-white/50 hover:text-white"}`}
              data-testid={`filter-${s}`}>
              {s === "all" ? "All" : s === "success" ? "Completed" : s === "pending" ? "Pending" : "Failed"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl glass animate-pulse" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <ArrowLeftRight className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <p className="font-semibold text-white">{allTxs.length === 0 ? "No transactions yet" : "No results match your search"}</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 text-xs text-white/30">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableHead className="text-white/40 text-xs">Reference</TableHead>
                  <TableHead className="text-white/40 text-xs">Plan</TableHead>
                  <TableHead className="text-white/40 text-xs">Customer</TableHead>
                  <TableHead className="text-white/40 text-xs">Amount</TableHead>
                  <TableHead className="text-white/40 text-xs">Status</TableHead>
                  <TableHead className="text-white/40 text-xs">Email</TableHead>
                  <TableHead className="text-white/40 text-xs">Date</TableHead>
                  <TableHead className="text-white/40 text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx: any) => {
                  const status = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={tx.id} className="border-white/5 hover:bg-white/3" data-testid={`tx-row-${tx.id}`}>
                      <TableCell className="font-mono text-xs text-white/30">{tx.reference?.split("-").slice(-1)[0]}</TableCell>
                      <TableCell className="font-medium text-sm text-white">{tx.planName}</TableCell>
                      <TableCell>
                        <div className="text-sm text-white/80">{tx.customerName}</div>
                        <div className="text-xs text-white/30">{tx.customerEmail}</div>
                      </TableCell>
                      <TableCell className="font-semibold text-sm text-indigo-400">KES {tx.amount?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />{status.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.emailSent
                          ? <Badge className="bg-emerald-600/70 text-white border-0 text-xs">Sent</Badge>
                          : <Badge className="glass border-white/10 text-white/40 text-xs">Pending</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost"
                            className="h-7 px-2 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => loadDeliveryProof(tx.reference)}
                            title="View delivery proof"
                            data-testid={`button-proof-${tx.id}`}>
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </Button>
                          {tx.status === "success" && (
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10"
                              onClick={() => resendCredentials(tx.reference)}
                              disabled={resendingRef === tx.reference}
                              title="Resend credentials to customer"
                              data-testid={`button-resend-${tx.id}`}>
                              {resendingRef === tx.reference
                                ? <div className="w-3.5 h-3.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                                : <RotateCcw className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {proofRef && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setProofRef(null); setProofData(null); } }}>
          <div className="glass border border-white/10 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" data-testid="modal-delivery-proof">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Delivery Proof</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setProofRef(null); setProofData(null); }}
                className="text-white/40 hover:text-white" data-testid="button-close-proof">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {proofLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto" />
              </div>
            ) : proofData ? (
              <div className="p-4 space-y-4">
                <div className="text-xs text-white/40 font-mono mb-2">Ref: {proofRef}</div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{proofData.summary.totalAttempts}</div>
                    <div className="text-xs text-white/50">Total Attempts</div>
                  </div>
                  <div className="glass border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{proofData.summary.successfulDeliveries}</div>
                    <div className="text-xs text-white/50">Successful</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className={proofData.summary.accountAssigned
                    ? "bg-emerald-600/70 text-white border-0" : "bg-red-600/70 text-white border-0"}>
                    {proofData.summary.accountAssigned ? "✓ Account Assigned" : "✗ Not Assigned"}
                  </Badge>
                  <Badge className={proofData.summary.emailDelivered
                    ? "bg-emerald-600/70 text-white border-0" : "bg-red-600/70 text-white border-0"}>
                    {proofData.summary.emailDelivered ? "✓ Email Delivered" : "✗ Email Not Sent"}
                  </Badge>
                </div>

                {proofData.summary.methods.length > 0 && (
                  <div className="text-xs text-white/40">
                    Methods used: {proofData.summary.methods.map((m: string) => m.replace(/_/g, " ")).join(", ")}
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Delivery Timeline
                  </h3>
                  {proofData.logs.length === 0 ? (
                    <div className="text-center py-6 text-white/30 text-sm">
                      No delivery logs recorded for this transaction.
                      <br />
                      <span className="text-xs text-white/20">Logs are recorded for new orders going forward.</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {proofData.logs.map((log: any, i: number) => (
                        <div key={log.id || i}
                          className="glass border border-white/5 rounded-lg p-3"
                          data-testid={`delivery-log-${i}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              {log.status === "success"
                                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                              <span className="text-xs font-medium text-white/80">
                                {log.method === "email" && "Email Delivery"}
                                {log.method === "resend_email" && "Email Resend"}
                                {log.method === "account_assignment" && "Account Assignment"}
                                {log.method === "telegram_notification" && "Telegram Notification"}
                                {log.method === "whatsapp_notification" && "WhatsApp Notification"}
                              </span>
                            </div>
                            <Badge className={log.status === "success"
                              ? "bg-emerald-600/50 text-emerald-200 border-0 text-[10px]"
                              : "bg-red-600/50 text-red-200 border-0 text-[10px]"}>
                              {log.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-white/50 mb-1">{log.details}</p>
                          <div className="text-[10px] text-white/25 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {proofData.summary.firstAttempt && (
                  <div className="text-[11px] text-white/30 border-t border-white/5 pt-3 space-y-0.5">
                    <div>First attempt: {new Date(proofData.summary.firstAttempt).toLocaleString()}</div>
                    <div>Last attempt: {new Date(proofData.summary.lastAttempt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-white/30 text-sm">Failed to load delivery proof.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────
function ApiKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => authFetch("/api/admin/api-keys"),
  });

  const { data: custData } = useQuery<any>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => authFetch("/api/admin/customers"),
  });
  const custMap: Record<number, string> = {};
  (custData?.customers ?? []).forEach((c: any) => { custMap[c.id] = c.email; });

  const generateMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/api-keys", { method: "POST", body: JSON.stringify({ label: newLabel.trim() }) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "API key generated" }); setNewLabel(""); refetch(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "API key deleted" }); refetch(); },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/admin/api-keys/${id}/revoke`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "API key revoked" }); refetch(); },
  });

  function copyKey(key: string, id: number) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  }

  const keys = data?.keys ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">API Keys</h1>
        <Badge className="glass border-white/10 text-white/50">{keys.length} keys</Badge>
      </div>

      {/* Generate form */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-white mb-3">Generate New API Key</p>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Key label (e.g. Integration Key)"
            className="flex-1 glass border-white/10 bg-white/5 text-white placeholder:text-white/25"
            data-testid="input-apikey-label"
            onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) generateMutation.mutate(); }}
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!newLabel.trim() || generateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
            data-testid="button-generate-apikey"
          >
            <Plus className="w-4 h-4 mr-1" />Generate
          </Button>
        </div>
        <p className="text-xs text-white/30 mt-2">Keys are prefixed with <code className="bg-white/10 px-1 rounded">ct_</code></p>
      </div>

      {/* Keys list */}
      {isLoading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-2xl">
          <Key className="w-9 h-9 text-white/20 mx-auto mb-2" />
          <p className="text-white/40">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k: any) => (
            <div key={k.id} data-testid={`card-adminkey-${k.id}`} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Key className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-white text-sm">{k.label}</span>
                  <Badge className={`text-xs border-0 ${k.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {k.active ? "Active" : "Revoked"}
                  </Badge>
                  {k.customerId && (
                    <Badge className="text-xs bg-blue-500/20 text-blue-400 border-0">
                      {custMap[k.customerId] || `Customer #${k.customerId}`}
                    </Badge>
                  )}
                  {!k.customerId && (
                    <Badge className="text-xs bg-violet-500/20 text-violet-400 border-0">Admin</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyKey(k.key, k.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                    data-testid={`button-copy-adminkey-${k.id}`}
                    title="Copy key"
                  >
                    {copiedId === k.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {k.active && (
                    <button
                      onClick={() => revokeMutation.mutate(k.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      data-testid={`button-revoke-adminkey-${k.id}`}
                      title="Revoke key"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(k.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    data-testid={`button-delete-adminkey-${k.id}`}
                    title="Delete key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <code className="text-xs font-mono text-white/40 bg-white/5 rounded-lg px-3 py-1.5 block break-all" data-testid={`text-adminkey-${k.id}`}>
                {k.key}
              </code>
              <p className="text-xs text-white/25 mt-1.5">Created {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : ""}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Customers Tab ────────────────────────────────────────────
function CustomersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => authFetch("/api/admin/customers"),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: number; suspended: boolean }) =>
      authFetch(`/api/admin/customers/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
    onSuccess: (d, vars) => {
      if (d.success) {
        toast({ title: vars.suspended ? "Account suspended" : "Account unsuspended" });
        refetch();
      } else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const customers = (data?.customers ?? []).filter((c: any) =>
    !search || c.email.toLowerCase().includes(search.toLowerCase()) || (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Customers</h1>
          <p className="text-xs text-white/40 mt-0.5">Manage registered customer accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="glass border-white/10 text-white/50">{data?.customers?.length ?? 0} total</Badge>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 w-60"
            data-testid="input-search-customers"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-medium">{search ? "No matching customers" : "No customers yet"}</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8">
                <TableHead className="text-white/40 text-xs">Customer</TableHead>
                <TableHead className="text-white/40 text-xs">Status</TableHead>
                <TableHead className="text-white/40 text-xs">2FA</TableHead>
                <TableHead className="text-white/40 text-xs">Joined</TableHead>
                <TableHead className="text-white/40 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => (
                <TableRow key={c.id} className="border-white/5 hover:bg-white/3" data-testid={`row-customer-${c.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">
                        <span className="text-indigo-400 font-bold text-xs">{(c.email || "?")[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white" data-testid={`text-customer-email-${c.id}`}>{c.email}</p>
                        {c.name && <p className="text-xs text-white/40">{c.name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {c.suspended ? (
                        <Badge className="bg-red-500/20 text-red-400 border-0 text-xs w-fit">Suspended</Badge>
                      ) : c.emailVerified ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs w-fit">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs w-fit">Unverified</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.totpEnabled ? (
                      <Badge className="bg-indigo-500/20 text-indigo-400 border-0 text-xs">2FA On</Badge>
                    ) : (
                      <span className="text-white/25 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-white/40">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => suspendMutation.mutate({ id: c.id, suspended: !c.suspended })}
                      disabled={suspendMutation.isPending}
                      data-testid={`button-suspend-${c.id}`}
                      title={c.suspended ? "Unsuspend account" : "Suspend account"}
                      className={`p-1.5 rounded-lg transition-all text-xs font-medium px-3 py-1 ${
                        c.suspended
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      }`}
                    >
                      {c.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

// ─── WhatsApp Web Panel ────────────────────────────────────────
function WhatsAppWebPanel({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [method, setMethod] = useState<"qr" | "code">("code");

  const token = () => localStorage.getItem("admin_token") || "";
  const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/whatsapp/status"],
    queryFn: () => fetch("/api/admin/whatsapp/status", { headers: authHeader() }).then(r => r.json()),
    refetchInterval: (d) => {
      const s = d?.state?.data?.status;
      return (s === "connecting" || s === "qr_ready") ? 2000 : 5000;
    },
  });

  const status = data?.status ?? "disconnected";
  const qrCode = data?.qrCode;
  const pairingCode = data?.pairingCode;
  const blockError = data?.error;

  async function connect() {
    setConnecting(true);
    try {
      const phone = method === "code" ? phoneNumber.replace(/\D/g, "") : undefined;
      const res = await fetch("/api/admin/whatsapp/connect", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const d = await res.json();
      if (d.success) {
        toast({ title: "Connecting…", description: method === "code" ? "Your pairing code will appear below" : "Scan the QR code with WhatsApp" });
        refetch();
      } else {
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } catch { toast({ title: "Connection error", variant: "destructive" }); }
    finally { setConnecting(false); }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/admin/whatsapp/disconnect", { method: "POST", headers: authHeader() });
      toast({ title: "WhatsApp disconnected" });
      refetch();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setDisconnecting(false); }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/test", { method: "POST", headers: authHeader() });
      const d = await res.json();
      if (d.success) toast({ title: "Test sent!", description: d.message });
      else toast({ title: "Test failed", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setTesting(false); }
  }

  async function saveAdminPhone() {
    try {
      const t = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ whatsappAdminPhone: adminPhone }),
      });
      const d = await res.json();
      if (d.success) toast({ title: "Admin number saved" });
      else toast({ title: "Save failed", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    disconnected: { label: "Disconnected", color: "text-white/40", dot: "bg-white/20" },
    connecting:   { label: "Connecting…", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
    qr_ready:     { label: "Waiting for code entry", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
    connected:    { label: "Connected", color: "text-emerald-400", dot: "bg-emerald-400" },
    blocked:      { label: "Blocked by WhatsApp", color: "text-red-400", dot: "bg-red-400" },
  };
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#25D36622" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">WhatsApp Bot</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
        </div>
      </div>

      {/* Connected state */}
      {status === "connected" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.2)" }}>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">WhatsApp is linked and the bot is active. Customers can message you!</p>
          </div>
          <div className="flex gap-2">
            <button onClick={sendTest} disabled={testing} className="px-3 py-2 rounded-lg text-xs font-semibold transition-all" style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36644" }} data-testid="button-test-whatsapp">
              {testing ? "Sending…" : "Send Test Message"}
            </button>
            <button onClick={disconnect} disabled={disconnecting} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10" style={{ border: "1px solid rgba(239,68,68,.2)" }} data-testid="button-disconnect-whatsapp">
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1.5">Your WhatsApp number (for order notifications)</p>
            <div className="flex gap-2">
              <Input value={adminPhone} onChange={e => setAdminPhone(e.target.value)} placeholder="254712345678" className={inputCls} data-testid="input-admin-phone" />
              <button onClick={saveAdminPhone} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all shrink-0">Save</button>
            </div>
            <p className="text-[11px] text-white/25 mt-1">Country code + number, no + or spaces (e.g. 254712345678)</p>
          </div>
        </div>
      )}

      {/* Blocked by WhatsApp */}
      {status === "blocked" && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)" }}>
            <p className="text-xs font-semibold text-red-400 mb-1">Connection blocked by WhatsApp</p>
            <p className="text-[11px] text-white/40 leading-relaxed">WhatsApp detects and blocks connections from cloud servers like Replit. This is a WhatsApp restriction, not a code bug.</p>
          </div>
          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
            <p className="text-[11px] font-semibold text-white/50">What you can do:</p>
            <p className="text-[11px] text-white/35">✅ <strong className="text-white/50">Telegram</strong> — works perfectly and is already set up for order notifications</p>
            <p className="text-[11px] text-white/35">✅ <strong className="text-white/50">WhatsApp Channel</strong> — set your channel link in Site Settings for customers to follow</p>
          </div>
          <button onClick={disconnect} className="text-xs text-white/30 hover:text-white/50 transition-all">Reset</button>
        </div>
      )}

      {/* QR / Pairing code display */}
      {(status === "qr_ready" || status === "connecting") && (
        <div className="space-y-3">
          {pairingCode && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(37,211,102,.25)" }}>
              <div className="px-4 pt-4 pb-3 text-center" style={{ background: "rgba(37,211,102,.07)" }}>
                <p className="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-widest mb-3">Your Pairing Code</p>
                {/* Format as XXXX-XXXX */}
                <p className="text-4xl font-mono font-black tracking-[0.25em] text-emerald-300" data-testid="text-pairing-code">
                  {pairingCode.length === 8
                    ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`
                    : pairingCode}
                </p>
              </div>
              <div className="px-4 py-3 space-y-1.5" style={{ background: "rgba(0,0,0,.2)" }}>
                <p className="text-xs font-semibold text-white/60">How to link:</p>
                <ol className="text-[11px] text-white/35 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap ⋮ (3 dots) → <strong className="text-white/50">Linked Devices</strong></li>
                  <li>Tap <strong className="text-white/50">Link a Device</strong></li>
                  <li>Tap <strong className="text-white/50">"Link with phone number instead"</strong></li>
                  <li>Enter the code above</li>
                </ol>
              </div>
            </div>
          )}
          {qrCode && !pairingCode && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-white/40">Scan with WhatsApp → ⋮ → Linked Devices → Link a Device</p>
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52 rounded-lg" data-testid="img-whatsapp-qr" />
              </div>
            </div>
          )}
          {status === "connecting" && !qrCode && !pairingCode && (
            <div className="flex items-center gap-2 text-amber-400/70 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Requesting pairing code from WhatsApp…
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={disconnect} disabled={disconnecting} className="text-xs text-red-400/60 hover:text-red-400 transition-all">
              Cancel
            </button>
            <span className="text-white/10">·</span>
            <button onClick={connect} disabled={connecting} className="text-xs text-white/40 hover:text-white/60 transition-all">
              {connecting ? "Generating…" : "Generate new code"}
            </button>
          </div>
        </div>
      )}

      {/* Disconnected — show connect options */}
      {status === "disconnected" && (
        <div className="space-y-3">
          <div className="flex gap-2 p-1 rounded-lg" style={{ background: "rgba(255,255,255,.04)" }}>
            {(["code", "qr"] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={method === m ? { background: "rgba(37,211,102,.2)", color: "#25D366" } : { color: "rgba(255,255,255,.4)" }}>
                {m === "code" ? "📱 Pairing Code" : "📷 QR Code"}
              </button>
            ))}
          </div>

          {method === "code" && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Enter your WhatsApp number with country code</p>
              <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="254712345678" className={inputCls} data-testid="input-wa-phone" />
              <p className="text-[11px] text-white/25 mt-1">No + or spaces — e.g. 254712345678 for Kenya</p>
            </div>
          )}

          <button
            onClick={connect}
            disabled={connecting || (method === "code" && !phoneNumber.trim())}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, #25D366, #128C7E)", color: "#fff" }}
            data-testid="button-connect-whatsapp"
          >
            {connecting ? "Starting…" : method === "code" ? "Get Pairing Code" : "Show QR Code"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Test Button ─────────────────────────────────────
function TelegramTestButton({ telegramConfigured, dirty }: { telegramConfigured: boolean; dirty: boolean }) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) toast({ title: "Test sent!", description: data.message });
      else toast({ title: "Test failed", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setTesting(false); }
  }

  if (dirty) return <p className="text-[11px] text-amber-400/70 mt-1">Save credentials first, then test the connection.</p>;

  return (
    <button
      type="button"
      onClick={test}
      disabled={!telegramConfigured || testing}
      data-testid="button-test-telegram"
      className="mt-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: telegramConfigured ? "#2AABEE22" : "rgba(255,255,255,.05)", color: telegramConfigured ? "#2AABEE" : "rgba(255,255,255,.3)", border: `1px solid ${telegramConfigured ? "#2AABEE44" : "rgba(255,255,255,.08)"}` }}
    >
      {testing ? "Sending..." : telegramConfigured ? "Send Test Message" : "Configure above to test"}
    </button>
  );
}

// ─── Credentials Editor ───────────────────────────────────────
function CredentialsEditor({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/credentials"],
    queryFn: () => authFetch("/api/admin/credentials"),
  });
  const creds = data?.credentials ?? {};
  const effective = data?.effective ?? {};
  const sourceOverride = data?.sourceOverride ?? {};
  const envVarSet = data?.envVarSet ?? {};

  function val(key: string) {
    return form[key] !== undefined ? form[key] : creds[key] ?? "";
  }

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/credentials", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "Credentials saved", description: "Changes take effect immediately" }); setDirty(false); setForm({}); refetch(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const CredRow = ({ label, field, type = "text", placeholder, hint }: { label: string; field: string; type?: string; placeholder?: string; hint?: string }) => {
    const isSecret = type === "password";
    const revealed = show[field];
    const currentVal = val(field);
    const isMasked = currentVal === "••••••••••••••••";
    const fromOverride = !!sourceOverride[field];
    const fromEnv = !!envVarSet[field];
    const isSet = fromOverride || fromEnv || creds[`${field}Set`] || !!creds[field];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/50 font-medium">{label}</label>
          <div className="flex items-center gap-1.5">
            {fromOverride && <Badge className="text-[9px] bg-violet-500/20 text-violet-400 border-0 px-1.5 py-0">Admin Set</Badge>}
            {!fromOverride && fromEnv && <Badge className="text-[9px] bg-slate-500/20 text-slate-400 border-0 px-1.5 py-0">Env Var</Badge>}
            {!isSet && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0 px-1.5 py-0">Not Set</Badge>}
          </div>
        </div>
        <div className="relative">
          <Input
            value={isSecret && !revealed && isMasked ? "••••••••••••••••" : currentVal}
            onChange={(e) => update(field, e.target.value)}
            onFocus={() => { if (isMasked) update(field, ""); }}
            type={isSecret && !revealed ? "password" : "text"}
            placeholder={placeholder || `Enter ${label}`}
            className={inputCls + (isSecret ? " pr-9" : "")}
            data-testid={`input-cred-${field}`}
          />
          {isSecret && (
            <button type="button" onClick={() => setShow((p) => ({ ...p, [field]: !p[field] }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {hint && <p className="text-[10px] text-white/25">{hint}</p>}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white">API Credentials</p>
            <p className="text-xs text-white/40">Paystack keys, email config, admin login — override env vars here</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-600 border-0 text-white text-xs h-8 px-3" data-testid="button-save-credentials">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
      <div className="p-5 space-y-5">
        {/* Paystack */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Paystack</p>
            {effective.paystackConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Public Key" field="paystackPublicKey" placeholder="pk_live_..." hint="Used in the browser for Paystack popup" />
          <CredRow label="Secret Key" field="paystackSecretKey" type="password" placeholder="sk_live_..." hint="Used server-side to verify payments" />
        </div>
        {/* Email */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Email (Gmail)</p>
            {effective.emailConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Gmail Address" field="emailUser" placeholder="you@gmail.com" />
          <CredRow label="App Password" field="emailPass" type="password" placeholder="xxxx xxxx xxxx xxxx"
            hint="Generate at myaccount.google.com/apppasswords — not your regular password" />
        </div>
        {/* Admin Login */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Admin Login</p>
          </div>
          <CredRow label="Admin Email" field="adminEmail" placeholder="admin@example.com" />
          <CredRow label="Admin Password" field="adminPassword" type="password" placeholder="New password"
            hint="Leave blank to keep current password" />
        </div>
        {/* Telegram */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#2AABEE22" }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#2AABEE"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Telegram Bot</p>
            </div>
            {effective.telegramConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Bot Token" field="telegramBotToken" type="password" placeholder="123456789:ABC..."
            hint="Create a bot via @BotFather on Telegram, then copy the token" />
          <CredRow label="Chat ID" field="telegramChatId" placeholder="-1001234567890"
            hint="Your Telegram user/group/channel ID. Send a message to @userinfobot to find yours." />
          <TelegramTestButton telegramConfigured={!!effective.telegramConfigured} dirty={dirty} />
        </div>

        {/* WhatsApp Bot */}
        <WhatsAppWebPanel inputCls={inputCls} />

        <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.15)" }}>
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/40">Values set here override Replit environment variables. <strong className="text-indigo-300">Admin Set</strong> = saved here. <strong className="text-slate-300">Env Var</strong> = from Replit Secrets. Changes take effect immediately — no restart needed.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Logs Tab ──────────────────────────────────────────────────
function LogsTab() {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/logs", category],
    queryFn: () => authFetch(`/api/admin/logs?limit=200${category !== "all" ? `&category=${category}` : ""}`),
    refetchInterval: 15000,
  });

  const clearMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/logs", { method: "DELETE" }),
    onSuccess: (d) => { if (d.success) { toast({ title: "Logs cleared" }); refetch(); } },
  });

  const logs = data?.logs ?? [];

  const LOG_STATUS: Record<string, { color: string; bg: string; icon: any }> = {
    success: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
    warning: { color: "text-amber-400", bg: "bg-amber-500/10", icon: TriangleAlert },
    error: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  };

  const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "auth", label: "Auth" },
    { id: "settings", label: "Settings" },
    { id: "plans", label: "Plans" },
    { id: "accounts", label: "Accounts" },
    { id: "promos", label: "Promos" },
    { id: "customers", label: "Customers" },
    { id: "transactions", label: "Transactions" },
    { id: "apikeys", label: "API Keys" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Activity Logs</h1>
          <p className="text-xs text-white/40 mt-0.5">Admin actions and events — last 200 entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending || logs.length === 0}
            variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs" data-testid="button-clear-logs">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear Logs
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            data-testid={`filter-log-${c.id}`}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              category === c.id
                ? "bg-indigo-600/80 text-white"
                : "glass border-white/10 text-white/40 hover:text-white"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Terminal className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-medium">No logs yet</p>
          <p className="text-white/25 text-sm mt-1">Admin actions will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const conf = LOG_STATUS[log.status] ?? LOG_STATUS.success;
            const StatusIcon = conf.icon;
            return (
              <div key={log.id} data-testid={`log-entry-${log.id}`}
                className="glass-card rounded-xl px-4 py-3 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${conf.bg}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${conf.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{log.action}</p>
                    <Badge className="text-[9px] bg-white/8 text-white/40 border-0 px-1.5">{log.category}</Badge>
                  </div>
                  {log.details && <p className="text-xs text-white/40 mt-0.5">{log.details}</p>}
                  {log.ip && <p className="text-[10px] text-white/20 mt-0.5">IP: {log.ip}</p>}
                </div>
                <p className="text-[10px] text-white/25 shrink-0 mt-0.5">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Glass Stat Card ──────────────────────────────────────────
function GlassStatCard({ title, value, icon: Icon, gradient, glow }: { title: string; value: string | number; icon: any; gradient: string; glow: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow}, transparent)`, transform: "translate(30%, -30%)" }} />
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-white/40 font-medium">{title}</p>
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
          style={{ boxShadow: `0 0 12px ${glow}` }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
