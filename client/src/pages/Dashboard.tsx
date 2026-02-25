import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Key, LogOut, User, Plus, Trash2, Copy,
  CheckCircle, Clock, XCircle, Shield, Eye, EyeOff,
  Loader2, ArrowLeft, QrCode, Lock, AlertTriangle,
  ChevronDown, ChevronUp, AlertCircle, Save, Package
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getToken() { return localStorage.getItem("customer_token") || ""; }
function getCustomerData() {
  try { return JSON.parse(localStorage.getItem("customer_data") || "null"); } catch { return null; }
}
function clearAuth() { localStorage.removeItem("customer_token"); localStorage.removeItem("customer_data"); }

function customerHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

async function customerFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, headers: { ...customerHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) { clearAuth(); window.location.href = "/auth"; }
  return res.json();
}

type DashTab = "orders" | "apikeys" | "security" | "profile";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  success: { label: "Completed", color: "text-emerald-400", icon: CheckCircle },
  pending: { label: "Pending", color: "text-amber-400", icon: Clock },
  failed: { label: "Failed", color: "text-red-400", icon: XCircle },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as DashTab) || "orders";
  const [tab, setTab] = useState<DashTab>(initialTab);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Credentials viewer state
  const [expandedCreds, setExpandedCreds] = useState<Set<string>>(new Set());
  const [credentialsData, setCredentialsData] = useState<Record<string, any>>({});
  const [loadingCreds, setLoadingCreds] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // TOTP state
  const [totpStep, setTotpStep] = useState<"idle" | "qr" | "verify">("idle");
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState("");

  const customer = getCustomerData();
  const isAuthenticated = !!getToken() && !!customer;

  useEffect(() => {
    if (!isAuthenticated) { setLocation("/auth"); }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(140deg, #0b1020, #0d0724)" }}>
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const { data: ordersData, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ["/api/customer/orders"],
    queryFn: () => customerFetch("/api/customer/orders"),
    enabled: tab === "orders",
  });

  const { data: keysData, isLoading: keysLoading } = useQuery<any>({
    queryKey: ["/api/customer/api-keys"],
    queryFn: () => customerFetch("/api/customer/api-keys"),
    enabled: tab === "apikeys",
  });

  const { data: totpStatus, refetch: refetchTotpStatus } = useQuery<any>({
    queryKey: ["/api/customer/totp-status"],
    queryFn: () => customerFetch("/api/customer/totp-status"),
    enabled: tab === "security",
  });

  const generateKeyMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/api-keys", {
      method: "POST",
      body: JSON.stringify({ label: newKeyLabel.trim() }),
    }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "API key generated!", description: "Copy it now — it won't be shown in full again" });
        setNewKeyLabel("");
        queryClient.invalidateQueries({ queryKey: ["/api/customer/api-keys"] });
        if (data.apiKey) setRevealedKeys((prev) => new Set([...prev, data.apiKey.id]));
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: number) => customerFetch(`/api/customer/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "API key deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/api-keys"] });
    },
  });

  const disableTotpMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/disable-totp", { method: "DELETE" }),
    onSuccess: (data) => {
      if (data.success) { toast({ title: "2FA disabled" }); refetchTotpStatus(); }
      else toast({ title: "Failed", description: data.error, variant: "destructive" });
    },
  });

  function copyKey(key: string, id: number) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleReveal(id: number) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const profileMutation = useMutation({
    mutationFn: (data: any) => customerFetch("/api/customer/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Profile updated successfully" });
        if (data.customer?.name) {
          const stored = getCustomerData();
          localStorage.setItem("customer_data", JSON.stringify({ ...stored, name: data.customer.name }));
        }
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  async function toggleCredentials(reference: string) {
    if (expandedCreds.has(reference)) {
      setExpandedCreds((prev) => { const n = new Set(prev); n.delete(reference); return n; });
      return;
    }
    if (credentialsData[reference]) {
      setExpandedCreds((prev) => new Set([...prev, reference]));
      return;
    }
    setLoadingCreds((prev) => new Set([...prev, reference]));
    try {
      const data = await customerFetch(`/api/customer/orders/${reference}/credentials`);
      if (data.success) {
        setCredentialsData((prev) => ({ ...prev, [reference]: data.account }));
        setExpandedCreds((prev) => new Set([...prev, reference]));
      } else {
        toast({ title: "Credentials unavailable", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load credentials", variant: "destructive" });
    } finally {
      setLoadingCreds((prev) => { const n = new Set(prev); n.delete(reference); return n; });
    }
  }

  function copyCredField(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleProfileSave() {
    if (newPassword && newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    const updates: any = {};
    if (profileName.trim()) updates.name = profileName.trim();
    if (newPassword) { updates.currentPassword = currentPassword; updates.newPassword = newPassword; }
    if (!Object.keys(updates).length) {
      toast({ title: "No changes to save", variant: "destructive" }); return;
    }
    profileMutation.mutate(updates);
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST", headers: customerHeaders() }).catch(() => {});
    clearAuth();
    setLocation("/");
    toast({ title: "Logged out successfully" });
  }

  async function startTotpSetup() {
    setTotpLoading(true); setTotpError("");
    try {
      const data = await customerFetch("/api/customer/setup-totp", { method: "POST" });
      if (data.success) { setTotpSetupData({ secret: data.secret, qrCodeDataUrl: data.qrCodeDataUrl }); setTotpStep("qr"); }
      else setTotpError(data.error || "Failed to generate QR code");
    } catch { setTotpError("Connection error"); }
    finally { setTotpLoading(false); }
  }

  async function verifyTotpSetup() {
    if (totpCode.length !== 6) { setTotpError("Enter the 6-digit code"); return; }
    setTotpLoading(true); setTotpError("");
    try {
      const data = await customerFetch("/api/customer/verify-totp", {
        method: "POST",
        body: JSON.stringify({ secret: totpSetupData?.secret, code: totpCode }),
      });
      if (data.success) {
        toast({ title: "2FA enabled!", description: "Your account is now protected" });
        setTotpStep("idle"); setTotpSetupData(null); setTotpCode("");
        refetchTotpStatus();
      } else setTotpError(data.error || "Invalid code");
    } catch { setTotpError("Connection error"); }
    finally { setTotpLoading(false); }
  }

  const orders = ordersData?.orders ?? [];
  const apiKeys = keysData?.keys ?? [];
  const totpEnabled = totpStatus?.totpEnabled ?? false;

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: "radial-gradient(900px 700px at 15% 25%, rgba(99,102,241,.15), transparent 55%), radial-gradient(700px 600px at 85% 80%, rgba(168,85,247,.12), transparent 55%), linear-gradient(140deg, #0b1020, #0d0724)"
    }}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 500, height: 500, top: -150, left: -100, background: "radial-gradient(circle, rgba(99,102,241,.25), transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ width: 400, height: 400, bottom: -100, right: -80, background: "radial-gradient(circle, rgba(168,85,247,.2), transparent 70%)", filter: "blur(40px)" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-white/40 hover:text-white transition-colors mr-1" data-testid="link-back-home">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))",
              boxShadow: "0 0 20px rgba(99,102,241,.3)",
            }}>
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">{customer?.name || customer?.email}</p>
              <p className="text-xs text-white/40">{customer?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white/40 hover:text-white hover:bg-white/5"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-1.5" />Logout
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1.5 rounded-xl border border-white/10 w-fit flex-wrap" style={{ background: "rgba(255,255,255,.04)" }}>
          {([
            { id: "orders", label: "My Products", icon: Package },
            { id: "apikeys", label: "API Keys", icon: Key },
            { id: "security", label: "Security", icon: Shield },
            { id: "profile", label: "Profile", icon: User },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`tab-${id}`}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === id ? {
                background: "linear-gradient(90deg, rgba(99,102,241,.5), rgba(168,85,247,.4))",
                color: "rgba(255,255,255,.95)",
                boxShadow: "0 6px 20px rgba(0,0,0,.25)",
              } : { color: "rgba(255,255,255,.45)" }}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Purchase History</h2>
              <Badge className="bg-white/10 text-white/60 border-white/10">{orders.length} orders</Badge>
            </div>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                <ShoppingBag className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 font-medium">No orders yet</p>
                <p className="text-white/25 text-sm mt-1">Your subscription purchases will appear here</p>
                <Button onClick={() => setLocation("/")} size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white" data-testid="button-shop-now">
                  Browse Plans
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => {
                  const statusConf = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  const isExpanded = expandedCreds.has(order.reference);
                  const creds = credentialsData[order.reference];
                  const isLoadingCreds = loadingCreds.has(order.reference);
                  return (
                    <div
                      key={order.id}
                      data-testid={`card-order-${order.id}`}
                      className="rounded-xl border border-white/8 overflow-hidden"
                      style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}
                    >
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,.2)" }}>
                            <ShoppingBag className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate" data-testid={`text-order-plan-${order.id}`}>{order.planName}</p>
                            <p className="text-xs text-white/40 font-mono">{order.reference?.split("-").slice(-1)[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-indigo-300" data-testid={`text-order-amount-${order.id}`}>KES {order.amount?.toLocaleString()}</p>
                            <p className="text-xs text-white/30">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-semibold ${statusConf.color}`} data-testid={`status-order-${order.id}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConf.label}
                          </div>
                          {order.status === "success" && (
                            <button
                              onClick={() => toggleCredentials(order.reference)}
                              disabled={isLoadingCreds}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10 transition-all"
                              data-testid={`button-view-creds-${order.id}`}
                            >
                              {isLoadingCreds ? <Loader2 className="w-3 h-3 animate-spin" /> : isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {isExpanded ? "Hide" : "Credentials"}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && creds && (
                        <div className="border-t border-white/8 p-4 space-y-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            <p className="text-xs text-amber-400/80">Keep these safe — do not share with anyone</p>
                          </div>
                          {[
                            { key: "email", label: "Email" },
                            { key: "password", label: "Password" },
                            { key: "username", label: "Username" },
                            { key: "activationCode", label: "Activation Code" },
                            { key: "redeemLink", label: "Redeem Link" },
                            { key: "instructions", label: "Instructions" },
                          ].filter(({ key }) => creds[key]).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                              <div className="min-w-0">
                                <p className="text-xs text-white/40">{label}</p>
                                <p className="text-sm text-white font-mono break-all">{creds[key]}</p>
                              </div>
                              <button
                                onClick={() => copyCredField(`${order.reference}-${key}`, creds[key])}
                                className="shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                                data-testid={`button-copy-${key}-${order.id}`}
                              >
                                {copiedField === `${order.reference}-${key}` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* API KEYS TAB */}
        {tab === "apikeys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">API Keys</h2>
                <p className="text-xs text-white/40 mt-0.5">Use these keys to access the Chege Tech API</p>
              </div>
              <Badge className="bg-white/10 text-white/60 border-white/10">{apiKeys.length}/5 keys</Badge>
            </div>

            <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.04)" }}>
              <p className="text-sm font-semibold text-white mb-3">Generate New Key</p>
              <div className="flex gap-2">
                <Input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label (e.g. My App)"
                  className={`flex-1 ${inputCls}`}
                  data-testid="input-key-label"
                  onKeyDown={(e) => { if (e.key === "Enter" && newKeyLabel.trim()) generateKeyMutation.mutate(); }}
                />
                <Button
                  onClick={() => generateKeyMutation.mutate()}
                  disabled={!newKeyLabel.trim() || generateKeyMutation.isPending || apiKeys.length >= 5}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                  data-testid="button-generate-key"
                >
                  {generateKeyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Generate</>}
                </Button>
              </div>
            </div>

            {keysLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                <Key className="w-9 h-9 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 font-medium">No API keys yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey: any) => {
                  const revealed = revealedKeys.has(apiKey.id);
                  const masked = apiKey.key.slice(0, 6) + "•".repeat(26) + apiKey.key.slice(-4);
                  return (
                    <div key={apiKey.id} data-testid={`card-apikey-${apiKey.id}`}
                      className="rounded-xl p-4 border border-white/8"
                      style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-semibold text-white text-sm">{apiKey.label}</span>
                          <Badge className={`text-xs border-0 ${apiKey.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {apiKey.active ? "Active" : "Revoked"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleReveal(apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                            data-testid={`button-reveal-key-${apiKey.id}`}>
                            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => copyKey(apiKey.key, apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                            data-testid={`button-copy-key-${apiKey.id}`}>
                            {copiedId === apiKey.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteKeyMutation.mutate(apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            data-testid={`button-delete-key-${apiKey.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <code className="text-xs font-mono text-white/50 bg-white/5 rounded-lg px-3 py-2 block break-all" data-testid={`text-apikey-${apiKey.id}`}>
                        {revealed ? apiKey.key : masked}
                      </code>
                      <p className="text-xs text-white/25 mt-2">Created {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === "security" && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Account Security</h2>
              <p className="text-xs text-white/40 mt-0.5">Protect your account with Two-Factor Authentication</p>
            </div>

            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                    <Shield className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Two-Factor Authentication</p>
                    <p className="text-xs text-white/40">Require a code from your authenticator app at login</p>
                  </div>
                </div>
                {totpEnabled
                  ? <Badge className="bg-emerald-600/80 text-white border-0 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                  : <Badge className="bg-white/10 text-white/50 border-0 text-xs">Not Set Up</Badge>}
              </div>

              <div className="p-5">
                {totpEnabled && totpStep === "idle" ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-emerald-300" style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)" }}>
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      2FA is active. Your account is protected by an authenticator app.
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={startTotpSetup} disabled={totpLoading} size="sm"
                        className="bg-indigo-600/80 hover:bg-indigo-600 text-white border-0" data-testid="button-reconfigure-totp">
                        <QrCode className="w-3.5 h-3.5 mr-1.5" />Reconfigure 2FA
                      </Button>
                      <Button onClick={() => disableTotpMutation.mutate()} disabled={disableTotpMutation.isPending} size="sm"
                        variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" data-testid="button-disable-totp">
                        <Lock className="w-3.5 h-3.5 mr-1.5" />Disable 2FA
                      </Button>
                    </div>
                  </div>
                ) : !totpEnabled && totpStep === "idle" ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-amber-300" style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)" }}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      2FA is not enabled. We strongly recommend protecting your account.
                    </div>
                    <Button onClick={startTotpSetup} disabled={totpLoading}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white" data-testid="button-setup-totp">
                      <QrCode className="w-4 h-4 mr-2" />{totpLoading ? "Generating..." : "Set Up 2FA"}
                    </Button>
                  </div>
                ) : null}

                {totpStep === "qr" && totpSetupData && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-white">Scan this QR code with your authenticator app</p>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        <img src={totpSetupData.qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg" />
                      </div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <p className="text-xs text-white/40">Works with Google Authenticator, Authy, Microsoft Authenticator, or any TOTP app.</p>
                        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.06)" }}>
                          <p className="text-xs text-white/30 mb-1">Or enter this code manually:</p>
                          <p className="font-mono text-xs text-indigo-300 break-all">{totpSetupData.secret}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => setTotpStep("verify")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white hover:opacity-90" data-testid="button-next-verify">
                        I've Scanned It → Verify
                      </Button>
                      <Button variant="outline" className="border-white/10 text-white/60 hover:text-white" onClick={() => { setTotpStep("idle"); setTotpSetupData(null); setTotpError(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {totpStep === "verify" && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/70">Enter the 6-digit code from your authenticator app:</p>
                    <Input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      className={`${inputCls} text-center font-mono text-3xl tracking-[0.5em] h-16`}
                      data-testid="input-totp-code"
                    />
                    {totpError && <p className="text-xs text-red-400">{totpError}</p>}
                    <div className="flex gap-3">
                      <Button onClick={verifyTotpSetup} disabled={totpCode.length !== 6 || totpLoading}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 border-0 text-white hover:opacity-90" data-testid="button-enable-totp">
                        {totpLoading ? "Verifying..." : "Enable 2FA"}
                      </Button>
                      <Button variant="outline" className="border-white/10 text-white/60 hover:text-white" onClick={() => setTotpStep("qr")}>
                        Back to QR
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Profile Settings</h2>
              <p className="text-xs text-white/40 mt-0.5">Update your name or change your password</p>
            </div>

            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <User className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Personal Information</p>
                  <p className="text-xs text-white/40">Update your display name</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Full Name</label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={customer?.name || "Your name"}
                    className={inputCls}
                    data-testid="input-profile-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Email Address</label>
                  <Input value={customer?.email || ""} disabled className={inputCls + " opacity-50 cursor-not-allowed"} data-testid="input-profile-email" />
                  <p className="text-xs text-white/25 mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <Lock className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Change Password</p>
                  <p className="text-xs text-white/40">Leave blank if you don't want to change it</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className={inputCls + " pr-9"}
                      data-testid="input-current-password"
                    />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={inputCls + " pr-9"}
                      data-testid="input-new-password"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Confirm New Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className={inputCls + (newPassword && confirmPassword && newPassword !== confirmPassword ? " border-red-500/50" : "")}
                    data-testid="input-confirm-password"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleProfileSave}
              disabled={profileMutation.isPending}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-bold hover:opacity-90"
              data-testid="button-save-profile"
            >
              {profileMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
