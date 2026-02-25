import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Play, Music, Briefcase, Shield, Gamepad2, Search, Star,
  CheckCircle, Zap, ShoppingCart, X, ChevronRight, Package,
  Sparkles, Plus, Minus, Trash2, User, LogIn
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS: Record<string, any> = { Play, Music, Briefcase, Shield, Gamepad2 };

interface Plan {
  name: string;
  price: number;
  originalPrice?: number;
  offerLabel?: string;
  duration: string;
  features: string[];
  popular?: boolean;
  inStock: boolean;
  planId: string;
  categoryKey: string;
  isCustom?: boolean;
}

interface Category {
  category: string;
  icon: string;
  color: string;
  plans: Record<string, Plan>;
}

interface CartItem {
  planId: string;
  name: string;
  price: number;
  duration: string;
  categoryKey: string;
  qty: number;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  streaming: "from-blue-500 to-indigo-600",
  music: "from-amber-400 to-orange-500",
  productivity: "from-cyan-400 to-teal-500",
  vpn: "from-teal-400 to-emerald-500",
  gaming: "from-violet-500 to-purple-600",
  custom: "from-indigo-400 to-violet-500",
};

const CATEGORY_GLOW: Record<string, string> = {
  streaming: "rgba(99,102,241,0.3)",
  music: "rgba(251,191,36,0.3)",
  productivity: "rgba(34,211,238,0.3)",
  vpn: "rgba(52,211,153,0.3)",
  gaming: "rgba(167,139,250,0.3)",
  custom: "rgba(129,140,248,0.3)",
};

function getCartFromStorage(): CartItem[] {
  try { return JSON.parse(localStorage.getItem("ct_cart") || "[]"); } catch { return []; }
}
function saveCartToStorage(cart: CartItem[]) {
  localStorage.setItem("ct_cart", JSON.stringify(cart));
}
function getCustomerData() {
  try { return JSON.parse(localStorage.getItem("customer_data") || "null"); } catch { return null; }
}

export default function Store() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => getCartFromStorage());
  const [cartOpen, setCartOpen] = useState(false);

  const customer = getCustomerData();

  useEffect(() => { saveCartToStorage(cart); }, [cart]);

  const { data, isLoading } = useQuery<{ categories: Record<string, Category> }>({
    queryKey: ["/api/plans"],
  });

  const categories = data?.categories ?? {};
  const allPlans = useMemo(() => {
    const result: Plan[] = [];
    for (const [catKey, cat] of Object.entries(categories)) {
      for (const plan of Object.values(cat.plans)) {
        result.push({ ...plan, categoryKey: catKey });
      }
    }
    return result;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!search && !activeCategory) return categories;
    const filtered: Record<string, Category> = {};
    for (const [key, cat] of Object.entries(categories)) {
      if (activeCategory && key !== activeCategory) continue;
      const matchingPlans = Object.entries(cat.plans).filter(([, plan]) =>
        plan.name.toLowerCase().includes(search.toLowerCase())
      );
      if (matchingPlans.length > 0) {
        filtered[key] = { ...cat, plans: Object.fromEntries(matchingPlans) };
      }
    }
    return filtered;
  }, [categories, search, activeCategory]);

  const popularPlans = allPlans.filter((p) => p.popular && p.inStock).slice(0, 4);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addToCart(plan: Plan) {
    setCart((prev) => {
      const existing = prev.find((i) => i.planId === plan.planId);
      if (existing) {
        return prev.map((i) => i.planId === plan.planId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { planId: plan.planId, name: plan.name, price: plan.price ?? 0, duration: plan.duration, categoryKey: plan.categoryKey, qty: 1 }];
    });
    setCartOpen(true);
  }

  function removeFromCart(planId: string) {
    setCart((prev) => prev.filter((i) => i.planId !== planId));
  }

  function changeQty(planId: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.planId !== planId) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean) as CartItem[]);
  }

  function checkoutItem(planId: string) {
    setCartOpen(false);
    setLocation(`/checkout?planId=${planId}`);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="bg-orb w-[600px] h-[600px] bg-indigo-600 top-[-200px] left-[-100px]" />
        <div className="bg-orb w-[500px] h-[500px] bg-violet-600 bottom-[-100px] right-[-100px]" style={{ animationDelay: "2s" }} />
        <div className="bg-orb w-[400px] h-[400px] bg-blue-600 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.15 }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="Chege Tech" className="w-9 h-9 rounded-xl shadow-lg" style={{ boxShadow: "0 0 14px rgba(99,102,241,0.3)" }} />
            <span className="font-bold text-lg hidden sm:block bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Chege Tech
            </span>
            <span className="font-bold text-lg sm:hidden text-white">CT</span>
          </div>
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-9 glass border-white/10 bg-white/5 placeholder:text-white/30 text-white focus:border-primary/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/254114291301"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-whatsapp-support"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/15 border border-green-500/25 text-green-400 text-sm font-medium hover:bg-green-600/25 transition-colors shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>Support</span>
            </a>

            {/* Cart button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all"
              data-testid="button-cart"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid="text-cart-count">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth / Dashboard */}
            {customer ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                  data-testid="link-my-products"
                  className="glass border-white/10 text-white/80 hover:text-white hover:border-white/20"
                >
                  <Package className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">My Products</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation("/dashboard?tab=profile")}
                  data-testid="link-account"
                  className="glass border-white/10 text-white/80 hover:text-white hover:border-white/20"
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Account</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation("/auth")}
                data-testid="link-signin"
                className="glass border-white/10 text-white/80 hover:text-white hover:border-white/20"
              >
                <LogIn className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/admin")}
              data-testid="link-admin"
              className="glass border-white/10 text-white/80 hover:text-white hover:border-white/20 hidden sm:flex"
            >
              Admin
            </Button>
          </div>
        </div>
      </header>

      {/* Cart Drawer */}
      {cartOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div
            className="fixed right-0 top-0 h-full w-full max-w-sm z-50 flex flex-col border-l border-white/10"
            style={{ background: "linear-gradient(180deg, rgba(13,7,36,.97), rgba(11,16,32,.97))", backdropFilter: "blur(20px)" }}
            data-testid="panel-cart"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-400" />
                <h2 className="font-bold text-white">Your Cart</h2>
                {cartCount > 0 && <Badge className="bg-indigo-600/80 text-white border-0">{cartCount}</Badge>}
              </div>
              <button onClick={() => setCartOpen(false)} className="text-white/40 hover:text-white transition-colors" data-testid="button-close-cart">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <ShoppingCart className="w-10 h-10 text-white/15 mb-3" />
                  <p className="text-white/40 font-medium">Your cart is empty</p>
                  <p className="text-white/25 text-sm mt-1">Add plans to get started</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.planId}
                    data-testid={`cart-item-${item.planId}`}
                    className="rounded-xl p-3 border border-white/8"
                    style={{ background: "rgba(255,255,255,.04)" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{item.name}</p>
                        <p className="text-xs text-white/40">{item.duration}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.planId)}
                        className="text-white/25 hover:text-red-400 transition-colors shrink-0"
                        data-testid={`button-remove-cart-${item.planId}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => changeQty(item.planId, -1)}
                          className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                          data-testid={`button-qty-dec-${item.planId}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white text-sm font-semibold w-5 text-center" data-testid={`text-qty-${item.planId}`}>{item.qty}</span>
                        <button
                          onClick={() => changeQty(item.planId, 1)}
                          className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                          data-testid={`button-qty-inc-${item.planId}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="font-bold text-indigo-300 text-sm" data-testid={`text-cart-price-${item.planId}`}>
                        KES {(item.price * item.qty).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7"
                      onClick={() => checkoutItem(item.planId)}
                      data-testid={`button-checkout-cart-${item.planId}`}
                    >
                      Buy Now <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">Total ({cartCount} item{cartCount !== 1 ? "s" : ""})</span>
                  <span className="text-xl font-black text-white" data-testid="text-cart-total">KES {cartTotal.toLocaleString()}</span>
                </div>
                <Button
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-bold shadow-xl hover:opacity-90"
                  style={{ boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}
                  onClick={() => { setCartOpen(false); setLocation("/cart-checkout"); }}
                  data-testid="button-checkout-all"
                >
                  Buy All · KES {cartTotal.toLocaleString()}
                </Button>
                <p className="text-xs text-white/30 text-center">One payment for all selected plans</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-violet-900/20 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6 text-sm text-white/80 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Instant Email Delivery · Verified Accounts
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Premium Accounts at<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Unbeatable Prices
            </span>
          </h1>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Get shared premium subscriptions for Netflix, Spotify, Canva, NordVPN and 30+ more services.
            Account details sent directly to your email.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { icon: CheckCircle, text: "Instant Delivery" },
              { icon: Star, text: "Verified Accounts" },
              { icon: Zap, text: "Paystack Secured" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 glass px-4 py-2.5 rounded-full text-white/80 text-sm font-medium">
                <Icon className="w-4 h-4 text-indigo-400" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular picks */}
      {!search && !activeCategory && popularPlans.length > 0 && (
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-xl font-bold text-white">Popular Picks</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {popularPlans.map((plan) => {
              const Icon = ICONS[categories[plan.categoryKey]?.icon] ?? Play;
              return (
                <button
                  key={plan.planId}
                  data-testid={`card-popular-${plan.planId}`}
                  onClick={() => addToCart(plan)}
                  className="group text-left p-4 rounded-2xl glass-card hover:border-white/20 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity"
                    style={{ background: `linear-gradient(135deg, ${CATEGORY_GLOW[plan.categoryKey]}, transparent)` }} />
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CATEGORY_GRADIENTS[plan.categoryKey]} flex items-center justify-center mb-3 shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-sm leading-tight mb-1 text-white">{plan.name}</p>
                  <p className="text-xs text-white/40 mb-2">{plan.duration}</p>
                  <p className="font-bold text-indigo-400">KES {(plan.price ?? 0).toLocaleString()}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Filters */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeCategory === null ? "default" : "outline"}
            onClick={() => setActiveCategory(null)}
            data-testid="filter-all"
            className={activeCategory === null ? "glow-primary-sm" : "glass border-white/10 text-white/70 hover:text-white hover:border-white/20"}
          >
            All Categories
          </Button>
          {Object.entries(categories).map(([key, cat]) => {
            const Icon = ICONS[cat.icon] ?? Play;
            return (
              <Button
                key={key}
                size="sm"
                variant={activeCategory === key ? "default" : "outline"}
                onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                data-testid={`filter-${key}`}
                className={activeCategory === key ? "glow-primary-sm" : "glass border-white/10 text-white/70 hover:text-white hover:border-white/20"}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {cat.category}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Plans by Category */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-16 pb-24">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-8 w-48 mb-6 bg-white/5" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-52 rounded-2xl bg-white/5" />
                ))}
              </div>
            </div>
          ))
        ) : Object.keys(filteredCategories).length === 0 ? (
          <div className="text-center py-20">
            <div className="glass-card w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-xl font-semibold text-white mb-1">No plans found</p>
            <p className="text-white/50">Try a different search term or category</p>
          </div>
        ) : (
          Object.entries(filteredCategories).map(([catKey, cat]) => {
            const Icon = ICONS[cat.icon] ?? Play;
            const planList = Object.values(cat.plans);
            return (
              <section key={catKey} data-testid={`section-${catKey}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${CATEGORY_GRADIENTS[catKey] ?? "from-indigo-500 to-violet-600"} flex items-center justify-center shadow-lg`}
                    style={{ boxShadow: `0 0 20px ${CATEGORY_GLOW[catKey] ?? "rgba(99,102,241,0.3)"}` }}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{cat.category}</h2>
                    <p className="text-sm text-white/40">{planList.length} plans available</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {planList.map((plan) => (
                    <PlanCard
                      key={plan.planId}
                      plan={plan}
                      catKey={catKey}
                      onBuyNow={() => setLocation(`/checkout?planId=${plan.planId}`)}
                      onAddToCart={() => addToCart(plan)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass-nav border-t border-white/8 mt-8 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/favicon.png" alt="Chege Tech" className="w-8 h-8 rounded-xl" />
            <span className="font-bold text-white">Chege Tech</span>
          </div>
          <p className="text-sm text-white/40 mb-3">Affordable shared premium accounts with instant email delivery</p>
          <a
            href="https://wa.me/254114291301"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-600/30 transition-colors mb-4"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Support: +254114291301
          </a>
          <p className="text-xs text-white/25">&copy; {new Date().getFullYear()} Chege Tech. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({ plan, catKey, onBuyNow, onAddToCart }: {
  plan: Plan;
  catKey: string;
  onBuyNow: () => void;
  onAddToCart: () => void;
}) {
  const gradient = CATEGORY_GRADIENTS[catKey] ?? "from-indigo-500 to-violet-600";
  const glow = CATEGORY_GLOW[catKey] ?? "rgba(99,102,241,0.3)";

  return (
    <div
      data-testid={`card-plan-${plan.planId}`}
      className={`relative rounded-2xl glass-card flex flex-col overflow-hidden transition-all duration-300 ${
        plan.inStock ? "hover:border-white/20 hover:shadow-xl hover:-translate-y-1" : "opacity-50"
      }`}
    >
      {/* Offer / Popular badge */}
      {(plan.offerLabel || plan.popular) && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-amber-500/90 text-white border-0 text-xs px-2 shadow-lg backdrop-blur-sm">
            <Star className="w-2.5 h-2.5 mr-1 fill-white" />
            {plan.offerLabel ?? "Popular"}
          </Badge>
        </div>
      )}

      {/* Out of stock overlay */}
      {!plan.inStock && (
        <div className="absolute inset-0 z-20 flex items-center justify-center glass">
          <Badge variant="secondary" className="text-xs glass">Out of Stock</Badge>
        </div>
      )}

      {/* Card header */}
      <div className={`relative p-5 pb-4 bg-gradient-to-br ${gradient} overflow-hidden`}>
        <div className="absolute inset-0 opacity-30" style={{
          background: "radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent 70%)"
        }} />
        <div className="relative">
          <div className="flex items-start justify-between gap-1 mb-1">
            <h3 className="font-semibold text-sm leading-tight text-white">{plan.name}</h3>
            {plan.isCustom && <Sparkles className="w-3 h-3 text-white/70 shrink-0 mt-0.5" />}
          </div>
          <p className="text-xs text-white/60">{plan.duration}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">KES {(plan.price ?? 0).toLocaleString()}</span>
            {plan.originalPrice && (
              <span className="text-sm text-white/50 line-through">KES {(plan.originalPrice ?? 0).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="p-4 flex-1 flex flex-col">
        <ul className="space-y-1.5 flex-1 mb-4">
          {plan.features.map((feat) => (
            <li key={feat} className="flex items-center gap-2 text-xs text-white/50">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              {feat}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button
            size="sm"
            className={`flex-1 bg-gradient-to-r ${gradient} border-0 text-white font-semibold shadow-lg hover:opacity-90 transition-opacity`}
            disabled={!plan.inStock}
            onClick={plan.inStock ? onBuyNow : undefined}
            data-testid={`button-buy-${plan.planId}`}
          >
            Buy Now
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="glass border-white/10 text-white/60 hover:text-white hover:border-white/20 px-2.5"
            disabled={!plan.inStock}
            onClick={plan.inStock ? onAddToCart : undefined}
            data-testid={`button-add-cart-${plan.planId}`}
            title="Add to cart"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
