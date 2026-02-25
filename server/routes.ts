import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { accountManager } from "./accounts";
import { sendAccountEmail, sendPasswordResetEmail } from "./email";
import { sendTelegramMessage, notifyNewOrder, notifyNewCustomer, notifyPaymentFailed, isTelegramConfigured } from "./telegram";
import { getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp, isWhatsAppWebConnected, broadcastNewOrder, sendWhatsAppNotification } from "./whatsapp-web";
import { subscriptionPlans } from "./plans";
import { promoManager } from "./promo";
import { planOverridesManager } from "./plan-overrides";
import {
  getAdminCredentials,
  isSetupComplete,
  generateSetup,
  saveSecret,
  verifyTotp,
  verifyTotpWithSecret,
  createAdminToken,
  validateAdminToken,
  adminAuthMiddleware,
} from "./auth";
import { getPaystackSecretKey, getPaystackPublicKey, getSecretsStatus } from "./secrets";
import nodemailer from "nodemailer";
import { getEmailUser, getEmailPass } from "./secrets";
import { getAppConfig, saveAppConfig } from "./app-config";
import { getCredentialsOverride, saveCredentialsOverride } from "./credentials-store";
import { logAdminAction, getAdminLogs } from "./admin-logger";
import { logDelivery, getDeliveryProof, getDeliveryLogs } from "./delivery-log";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email: string, code: string, name?: string): Promise<void> {
  const user = getEmailUser();
  const pass = getEmailPass();
  if (!user || !pass) return;
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transporter.sendMail({
    from: `"Chege Tech" <${user}>`,
    to: email,
    subject: "Your Chege Tech Verification Code",
    html: `
      <div style="background:#0b1020;color:#fff;padding:32px;font-family:sans-serif;border-radius:12px;max-width:480px;margin:0 auto">
        <h2 style="color:#818cf8;margin-bottom:8px">Email Verification</h2>
        <p>Hi ${name || "there"}, welcome to <b>Chege Tech</b>!</p>
        <p>Your verification code is:</p>
        <div style="background:#1e1b4b;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#a5b4fc">${code}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px">This code expires in 15 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

async function customerAuthMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.replace("Bearer ", "");
  const session = await storage.getCustomerSession(token);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (new Date(session.expiresAt) < new Date()) {
    await storage.deleteCustomerSession(token);
    return res.status(401).json({ error: "Session expired" });
  }
  const customer = await storage.getCustomerById(session.customerId);
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
  req.customer = customer;
  next();
}

function buildPlansResponse() {
  const overrides = planOverridesManager.getOverrides();
  const customPlans = planOverridesManager.getCustomPlans();

  const enriched = Object.entries(subscriptionPlans).reduce((acc, [key, cat]) => {
    const plans = Object.entries(cat.plans).reduce((pa, [planId, plan]) => {
      const override = overrides[planId] || {};
      if (override.disabled) return pa;
      const avail = accountManager.checkAvailability(planId);
      const effectivePrice = override.priceOverride ?? plan.price;
      pa[planId] = {
        ...plan,
        planId,
        categoryKey: key,
        inStock: avail.available,
        price: effectivePrice,
        originalPrice: override.priceOverride ? plan.price : undefined,
        offerLabel: override.offerLabel,
      };
      return pa;
    }, {} as Record<string, any>);

    const customForCat = customPlans.filter((cp) => cp.categoryKey === key);
    customForCat.forEach((cp) => {
      const override = overrides[cp.id] || {};
      if (!override.disabled) {
        const avail = accountManager.checkAvailability(cp.id);
        plans[cp.id] = {
          name: cp.name,
          price: override.priceOverride ?? cp.price,
          originalPrice: override.priceOverride ? cp.price : undefined,
          duration: cp.duration,
          features: cp.features,
          shared: true,
          maxUsers: cp.maxUsers,
          planId: cp.id,
          categoryKey: key,
          inStock: avail.available,
          isCustom: true,
          offerLabel: override.offerLabel,
        };
      }
    });

    if (Object.keys(plans).length > 0) {
      acc[key] = { ...cat, plans };
    }
    return acc;
  }, {} as Record<string, any>);

  const uncategorizedCustom = customPlans.filter(
    (cp) => !Object.keys(subscriptionPlans).includes(cp.categoryKey)
  );
  if (uncategorizedCustom.length > 0) {
    const customCat: Record<string, any> = {};
    uncategorizedCustom.forEach((cp) => {
      const override = overrides[cp.id] || {};
      if (!override.disabled) {
        const avail = accountManager.checkAvailability(cp.id);
        customCat[cp.id] = {
          name: cp.name,
          price: override.priceOverride ?? cp.price,
          originalPrice: override.priceOverride ? cp.price : undefined,
          duration: cp.duration,
          features: cp.features,
          shared: true,
          maxUsers: cp.maxUsers,
          planId: cp.id,
          categoryKey: "custom",
          inStock: avail.available,
          isCustom: true,
          offerLabel: override.offerLabel,
        };
      }
    });
    if (Object.keys(customCat).length > 0) {
      enriched["custom"] = {
        category: "Other Services",
        icon: "Sparkles",
        color: "#6366F1",
        plans: customCat,
      };
    }
  }

  return enriched;
}

async function verifyPaystackPayment(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  configured: boolean;
}> {
  const secret = getPaystackSecretKey();
  if (!secret) return { success: false, status: "not_configured", configured: false };
  try {
    const res = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const d = res.data.data;
    return { success: d.status === "success", status: d.status, amount: d.amount / 100, configured: true };
  } catch (err: any) {
    console.error("Paystack verify error:", err.message);
    return { success: false, status: "error", configured: true };
  }
}

async function deliverAccount(transaction: any): Promise<{ success: boolean; error?: string }> {
  const logBase = {
    reference: transaction.reference,
    customerEmail: transaction.customerEmail,
    customerName: transaction.customerName || "Customer",
    planName: transaction.planName,
    planId: transaction.planId,
  };

  const account = accountManager.assignAccount(
    transaction.planId,
    transaction.customerEmail,
    transaction.customerName || "Customer"
  );
  if (!account) {
    logDelivery({ ...logBase, method: "account_assignment", status: "failed", details: "No account available in stock" });
    await storage.updateTransaction(transaction.reference, { status: "failed" });
    return { success: false, error: "No account available - contact support for refund" };
  }

  logDelivery({
    ...logBase,
    method: "account_assignment",
    status: "success",
    details: `Account assigned — ID: ${account.id}`,
    metadata: { accountId: account.id, accountEmail: account.email },
  });

  const emailResult = await sendAccountEmail(
    transaction.customerEmail,
    transaction.planName,
    account,
    transaction.customerName || "Customer"
  );

  logDelivery({
    ...logBase,
    method: "email",
    status: emailResult.success ? "success" : "failed",
    details: emailResult.success
      ? `Credentials email sent to ${transaction.customerEmail}`
      : `Email delivery failed: ${emailResult.error || "unknown error"}`,
    metadata: { recipientEmail: transaction.customerEmail },
  });

  await storage.updateTransaction(transaction.reference, {
    status: "success",
    accountAssigned: true,
    emailSent: emailResult.success,
    paystackReference: transaction.reference,
  });
  const orderOpts = {
    customerName: transaction.customerName || "Customer",
    customerEmail: transaction.customerEmail,
    planName: transaction.planName,
    amount: transaction.amount,
    reference: transaction.reference,
  };
  notifyNewOrder(orderOpts).then(() => {
    logDelivery({ ...logBase, method: "telegram_notification", status: "success", details: "Admin notified via Telegram" });
  }).catch(() => {
    logDelivery({ ...logBase, method: "telegram_notification", status: "failed", details: "Telegram notification failed" });
  });
  const override = getCredentialsOverride();
  if (override.whatsappAdminPhone) {
    broadcastNewOrder({ adminPhone: override.whatsappAdminPhone, ...orderOpts }).catch(() => {});
  }
  return { success: true };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ─── Public: Config ───────────────────────────────────────────────────────
  app.get("/api/config", (_req, res) => {
    const pub = getPaystackPublicKey();
    const sec = getPaystackSecretKey();
    res.json({
      paystackPublicKey: pub || null,
      paystackConfigured: !!(pub && sec),
    });
  });

  // ─── Public: Plans ────────────────────────────────────────────────────────
  app.get("/api/plans", (_req, res) => {
    res.json({ success: true, categories: buildPlansResponse() });
  });

  // ─── Public: Validate promo code ─────────────────────────────────────────
  app.post("/api/payment/validate-promo", (req, res) => {
    const { code, planId, amount } = req.body;
    const result = promoManager.validate(code, planId);
    if (!result.valid) return res.status(400).json({ success: false, error: result.error });

    const promo = result.promo!;
    let discountAmount = 0;
    if (promo.discountType === "percent") {
      discountAmount = Math.round((amount * promo.discountValue) / 100);
    } else {
      discountAmount = promo.discountValue;
    }
    const finalAmount = Math.max(0, amount - discountAmount);
    res.json({ success: true, promo, discountAmount, finalAmount, originalAmount: amount });
  });

  // ─── Public: Initialize payment ──────────────────────────────────────────
  app.post("/api/payment/initialize", async (req, res) => {
    try {
      const { planId, customerName, email, promoCode } = req.body;
      if (!email || !planId) return res.status(400).json({ success: false, error: "Email and planId are required" });

      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

      const avail = accountManager.checkAvailability(planId);
      if (!avail.available) {
        return res.status(400).json({ success: false, error: "This plan is currently out of stock", outOfStock: true });
      }

      let finalAmount = plan.price;
      let promoUsed: string | null = null;
      if (promoCode) {
        const promoResult = promoManager.validate(promoCode, planId);
        if (promoResult.valid && promoResult.promo) {
          const p = promoResult.promo;
          if (p.discountType === "percent") {
            finalAmount = Math.max(0, finalAmount - Math.round((finalAmount * p.discountValue) / 100));
          } else {
            finalAmount = Math.max(0, finalAmount - p.discountValue);
          }
          promoUsed = promoCode.toUpperCase();
        }
      }

      const reference = `SUB-${planId.toUpperCase()}-${Date.now()}`;
      await storage.createTransaction({
        reference,
        planId,
        planName: plan.name,
        customerEmail: email,
        customerName: customerName || "Customer",
        amount: finalAmount,
        status: "pending",
        emailSent: false,
        accountAssigned: false,
      });

      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) {
        return res.json({
          success: true,
          reference,
          authorizationUrl: null,
          paystackConfigured: false,
          plan: plan.name,
          amount: finalAmount,
        });
      }

      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: finalAmount * 100,
          reference,
          metadata: { planId, planName: plan.name, customerName, promoCode: promoUsed },
          callback_url: `${req.protocol}://${req.get("host")}/payment/success?ref=${reference}`,
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );

      if (promoUsed) promoManager.use(promoUsed);

      res.json({
        success: true,
        reference,
        authorizationUrl: psRes.data.data.authorization_url,
        accessCode: psRes.data.data.access_code,
        paystackConfigured: true,
        plan: plan.name,
        amount: finalAmount,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Verify payment ───────────────────────────────────────────────
  app.post("/api/payment/verify", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

      const transaction = await storage.getTransaction(reference);
      if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });

      if (transaction.status === "success") {
        return res.json({ success: true, status: "success", alreadyProcessed: true, planName: transaction.planName });
      }
      if (transaction.status === "failed") {
        return res.json({ success: false, status: "failed", error: "This transaction has already failed" });
      }

      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) {
        return res.status(503).json({ success: false, error: "Payment gateway not configured", notConfigured: true });
      }
      if (!verify.success) {
        await storage.updateTransaction(reference, { status: "failed" });
        return res.json({ success: false, status: "failed", error: "Payment was not successful" });
      }

      const delivery = await deliverAccount(transaction);
      if (!delivery.success) return res.json({ success: false, error: delivery.error });

      res.json({ success: true, status: "success", planName: transaction.planName });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Initialize cart payment ──────────────────────────────────────
  app.post("/api/payment/initialize-cart", async (req, res) => {
    try {
      const { items, customerName, email } = req.body;
      if (!email || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "Email and items are required" });
      }
      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) {
        return res.json({ success: true, paystackConfigured: false, reference: "", authorizationUrl: "" });
      }
      const categories = buildPlansResponse();
      const expandedItems: Array<{ planId: string; planName: string; amount: number; categoryName: string }> = [];
      for (const item of items) {
        let plan: any = null;
        for (const cat of Object.values(categories) as any[]) {
          if (cat.plans[item.planId]) { plan = { ...cat.plans[item.planId], categoryName: cat.category }; break; }
        }
        if (!plan) return res.status(400).json({ success: false, error: `Invalid plan: ${item.planId}` });
        const avail = accountManager.checkAvailability(item.planId);
        const qty = Math.max(1, item.qty || 1);
        if (!avail.available) return res.status(400).json({ success: false, error: `${plan.name} is currently out of stock`, outOfStock: true, planName: plan.name });
        for (let q = 0; q < qty; q++) {
          expandedItems.push({ planId: item.planId, planName: plan.name, amount: plan.price, categoryName: plan.categoryName });
        }
      }
      const totalAmount = expandedItems.reduce((s, i) => s + i.amount, 0);
      const reference = `ct-cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      for (const item of expandedItems) {
        await storage.createTransaction({
          reference: `${reference}-${expandedItems.indexOf(item)}`,
          planId: item.planId, planName: item.planName, amount: item.amount,
          customerEmail: email, customerName: customerName || "Customer",
          status: "pending", accountAssigned: false, emailSent: false, paystackReference: reference,
        });
      }
      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        { email, amount: totalAmount * 100, reference, currency: "KES",
          metadata: { cartRef: reference, items: expandedItems.length, customerName } },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );
      res.json({ success: true, reference, authorizationUrl: psRes.data.data.authorization_url, accessCode: psRes.data.data.access_code, paystackConfigured: true, totalAmount, itemCount: expandedItems.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Verify cart payment ──────────────────────────────────────────
  app.post("/api/payment/verify-cart", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });
      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) return res.status(503).json({ success: false, error: "Payment gateway not configured" });
      if (!verify.success) return res.json({ success: false, error: "Payment was not successful" });
      const allTx = await storage.getAllTransactions();
      const cartTxs = allTx.filter((t) => t.paystackReference === reference && t.status === "pending");
      if (cartTxs.length === 0) {
        const done = allTx.filter((t) => t.paystackReference === reference && t.status === "success");
        if (done.length > 0) return res.json({ success: true, alreadyProcessed: true, planNames: done.map((t) => t.planName) });
        return res.status(404).json({ success: false, error: "Cart transactions not found" });
      }
      const results: string[] = [];
      for (const tx of cartTxs) {
        const delivery = await deliverAccount(tx);
        if (delivery.success) results.push(tx.planName);
        else await storage.updateTransaction(tx.reference, { status: "failed" });
      }
      res.json({ success: true, planNames: results, delivered: results.length, total: cartTxs.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Paystack redirect callback ───────────────────────────────────────────
  app.get("/api/payment/callback", async (req, res) => {
    const ref = ((req.query.reference || req.query.trxref) as string) || "";
    if (!ref) return res.redirect("/");
    try {
      const transaction = await storage.getTransaction(ref);
      if (!transaction || transaction.status === "success") {
        return res.redirect(`/payment/success?ref=${ref}&plan=${encodeURIComponent(transaction?.planName || "")}`);
      }
      const verify = await verifyPaystackPayment(ref);
      if (verify.success && verify.configured) {
        const delivery = await deliverAccount(transaction);
        if (delivery.success) {
          return res.redirect(`/payment/success?ref=${ref}&plan=${encodeURIComponent(transaction.planName)}&email=${encodeURIComponent(transaction.customerEmail)}`);
        }
      }
      res.redirect(`/checkout?planId=${transaction.planId}&error=payment_failed`);
    } catch {
      res.redirect("/");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: 2FA Setup Status ──────────────────────────────────────────────
  app.get("/api/admin/2fa-status", (_req, res) => {
    res.json({ setupComplete: isSetupComplete() });
  });

  // ─── Admin: Generate 2FA setup QR ────────────────────────────────────────
  app.post("/api/admin/2fa-setup", async (req, res) => {
    try {
      const { email, password } = req.body;
      const creds = getAdminCredentials();
      if (email !== creds.email || password !== creds.password) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }
      const setup = await generateSetup();
      res.json({ success: true, ...setup });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Complete 2FA Setup ────────────────────────────────────────────
  app.post("/api/admin/2fa-complete", (req, res) => {
    const { email, password, secret, totpCode } = req.body;
    const creds = getAdminCredentials();
    if (email !== creds.email || password !== creds.password) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    const valid = verifyTotpWithSecret(totpCode, secret);
    if (!valid) return res.status(400).json({ success: false, error: "Invalid authenticator code - check your app" });
    saveSecret(secret);
    const token = createAdminToken();
    res.json({ success: true, token });
  });

  // ─── Admin: Login ─────────────────────────────────────────────────────────
  app.post("/api/admin/login", (req, res) => {
    const { email, password, totpCode } = req.body;
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "unknown";
    const creds = getAdminCredentials();
    if (email !== creds.email || password !== creds.password) {
      logAdminAction({ action: "Login failed — wrong credentials", category: "auth", details: `Email: ${email}`, ip, status: "error" });
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    if (isSetupComplete()) {
      if (!totpCode) {
        return res.status(403).json({ success: false, error: "2FA code required", requiresTotp: true });
      }
      if (!verifyTotp(totpCode)) {
        logAdminAction({ action: "Login failed — wrong 2FA code", category: "auth", details: `Email: ${email}`, ip, status: "error" });
        return res.status(401).json({ success: false, error: "Invalid 2FA code" });
      }
    }
    const token = createAdminToken();
    logAdminAction({ action: "Admin logged in", category: "auth", details: `Email: ${email}`, ip, status: "success" });
    res.json({ success: true, token });
  });

  // ─── Admin: Get secrets status ────────────────────────────────────────────
  app.get("/api/admin/secrets", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, secrets: getSecretsStatus() });
  });

  // ─── Admin: Stats ─────────────────────────────────────────────────────────
  app.get("/api/admin/stats", adminAuthMiddleware, async (_req, res) => {
    try {
      const [txStats, accStats] = await Promise.all([
        storage.getStats(),
        Promise.resolve(accountManager.getStats()),
      ]);
      res.json({ success: true, transactions: txStats, accounts: accStats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Transactions ──────────────────────────────────────────────────
  app.get("/api/admin/transactions", adminAuthMiddleware, async (_req, res) => {
    try {
      const txs = await storage.getAllTransactions();
      res.json({ success: true, transactions: txs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Get all accounts ──────────────────────────────────────────────
  app.get("/api/admin/accounts", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, accounts: accountManager.getAllAccounts() });
  });

  // ─── Admin: Add account ───────────────────────────────────────────────────
  app.post("/api/admin/accounts", adminAuthMiddleware, (req, res) => {
    try {
      const { planId, email, username, password, activationCode, redeemLink, instructions, maxUsers } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: "planId is required" });
      const account = accountManager.addAccount(planId, {
        email, username, password, activationCode, redeemLink, instructions,
        maxUsers: parseInt(maxUsers) || 5,
      });
      res.json({ success: true, account });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update account ────────────────────────────────────────────────
  app.put("/api/admin/accounts/:id", adminAuthMiddleware, (req, res) => {
    const updated = accountManager.updateAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: "Account not found" });
    res.json({ success: true, account: updated });
  });

  // ─── Admin: Toggle account disabled ──────────────────────────────────────
  app.patch("/api/admin/accounts/:id/toggle", adminAuthMiddleware, (req, res) => {
    const acc = accountManager.toggleAccountDisabled(req.params.id);
    if (!acc) return res.status(404).json({ success: false, error: "Account not found" });
    res.json({ success: true, account: acc });
  });

  // ─── Admin: Delete account ────────────────────────────────────────────────
  app.delete("/api/admin/accounts/:id", adminAuthMiddleware, (req, res) => {
    const result = accountManager.removeAccount(req.params.id);
    if (result.removed) res.json({ success: true });
    else res.status(404).json({ success: false, error: "Account not found" });
  });

  // ─── Admin: Bulk add accounts ─────────────────────────────────────────────
  app.post("/api/admin/accounts/bulk", adminAuthMiddleware, (req, res) => {
    try {
      const { planId, accounts: rows } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: "planId is required" });
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, error: "accounts array is required" });
      const added: any[] = [];
      const errors: string[] = [];
      rows.forEach((row: any, i: number) => {
        try {
          if (!row.email && !row.username && !row.password) { errors.push(`Row ${i + 1}: at least email or password required`); return; }
          const acc = accountManager.addAccount(planId, {
            email: row.email || "",
            username: row.username || "",
            password: row.password || "",
            activationCode: row.activationCode || "",
            redeemLink: row.redeemLink || "",
            instructions: row.instructions || "",
            maxUsers: parseInt(row.maxUsers) || 5,
          });
          added.push(acc);
        } catch (e: any) {
          errors.push(`Row ${i + 1}: ${e.message}`);
        }
      });
      logAdminAction({ action: `Bulk upload: ${added.length} accounts added to ${planId}`, category: "accounts", details: `${added.length} added, ${errors.length} errors`, status: "success" });
      res.json({ success: true, added: added.length, errors });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Resend credentials ────────────────────────────────────────────
  app.post("/api/admin/transactions/:reference/resend", adminAuthMiddleware, async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
      if (tx.status !== "success") return res.status(400).json({ success: false, error: "Can only resend for completed transactions" });
      const account = accountManager.findAccountByCustomer(tx.planId, tx.customerEmail);
      if (!account) return res.status(404).json({ success: false, error: "No assigned account found for this order" });
      const emailResult = await sendAccountEmail(tx.customerEmail, tx.planName, account, tx.customerName || "Customer");
      logDelivery({
        reference: tx.reference,
        customerEmail: tx.customerEmail,
        customerName: tx.customerName || "Customer",
        planName: tx.planName,
        planId: tx.planId,
        method: "resend_email",
        status: emailResult.success ? "success" : "failed",
        details: emailResult.success
          ? `Credentials re-sent to ${tx.customerEmail} (admin action)`
          : `Resend failed: ${emailResult.error || "unknown error"}`,
        metadata: { recipientEmail: tx.customerEmail, triggeredBy: "admin" },
      });
      logAdminAction({ action: `Credentials resent to ${tx.customerEmail} for ${tx.planName}`, category: "transactions", status: "success" });
      res.json({ success: true, emailSent: emailResult.success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delivery Proof ──────────────────────────────────────────────
  app.get("/api/admin/delivery-proof/:reference", adminAuthMiddleware, (req, res) => {
    try {
      const proof = getDeliveryProof(req.params.reference);
      res.json({ success: true, proof });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/delivery-logs", adminAuthMiddleware, (req, res) => {
    try {
      const email = req.query.email as string | undefined;
      const reference = req.query.reference as string | undefined;
      const logs = getDeliveryLogs(reference, email);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Analytics ─────────────────────────────────────────────────────
  app.get("/api/admin/analytics", adminAuthMiddleware, async (_req, res) => {
    try {
      const all = await storage.getAllTransactions();
      const successful = all.filter((t) => t.status === "success");
      const now = new Date();
      const daily: Record<string, { date: string; revenue: number; orders: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        daily[key] = { date: key, revenue: 0, orders: 0 };
      }
      successful.forEach((t) => {
        if (t.createdAt) {
          const key = new Date(t.createdAt).toISOString().split("T")[0];
          if (daily[key]) { daily[key].revenue += t.amount; daily[key].orders += 1; }
        }
      });
      const planRevenue: Record<string, { planName: string; revenue: number; orders: number }> = {};
      successful.forEach((t) => {
        if (!planRevenue[t.planId]) planRevenue[t.planId] = { planName: t.planName, revenue: 0, orders: 0 };
        planRevenue[t.planId].revenue += t.amount;
        planRevenue[t.planId].orders += 1;
      });
      const topPlans = Object.values(planRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      res.json({ success: true, daily: Object.values(daily), topPlans });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Get plan overrides ────────────────────────────────────────────
  app.get("/api/admin/plan-overrides", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, overrides: planOverridesManager.getOverrides() });
  });

  // ─── Admin: Update plan override ─────────────────────────────────────────
  app.put("/api/admin/plans/:planId", adminAuthMiddleware, (req, res) => {
    planOverridesManager.setOverride(req.params.planId, req.body);
    res.json({ success: true });
  });

  // ─── Admin: Reset plan override ───────────────────────────────────────────
  app.delete("/api/admin/plans/:planId/override", adminAuthMiddleware, (req, res) => {
    planOverridesManager.deleteOverride(req.params.planId);
    res.json({ success: true });
  });

  // ─── Admin: Get custom plans ──────────────────────────────────────────────
  app.get("/api/admin/custom-plans", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, plans: planOverridesManager.getCustomPlans() });
  });

  // ─── Admin: Add custom plan ───────────────────────────────────────────────
  app.post("/api/admin/custom-plans", adminAuthMiddleware, (req, res) => {
    try {
      const plan = planOverridesManager.addCustomPlan(req.body);
      res.json({ success: true, plan });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update custom plan ────────────────────────────────────────────
  app.put("/api/admin/custom-plans/:id", adminAuthMiddleware, (req, res) => {
    const plan = planOverridesManager.updateCustomPlan(req.params.id, req.body);
    if (!plan) return res.status(404).json({ success: false, error: "Custom plan not found" });
    res.json({ success: true, plan });
  });

  // ─── Admin: Delete custom plan ────────────────────────────────────────────
  app.delete("/api/admin/custom-plans/:id", adminAuthMiddleware, (req, res) => {
    const ok = planOverridesManager.deleteCustomPlan(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Custom plan not found" });
    res.json({ success: true });
  });

  // ─── Admin: Get promo codes ───────────────────────────────────────────────
  app.get("/api/admin/promo-codes", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, codes: promoManager.getAll() });
  });

  // ─── Admin: Create promo code ─────────────────────────────────────────────
  app.post("/api/admin/promo-codes", adminAuthMiddleware, (req, res) => {
    try {
      const code = promoManager.create(req.body);
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update promo code ─────────────────────────────────────────────
  app.put("/api/admin/promo-codes/:code", adminAuthMiddleware, (req, res) => {
    const updated = promoManager.update(req.params.code, req.body);
    if (!updated) return res.status(404).json({ success: false, error: "Promo code not found" });
    res.json({ success: true, code: updated });
  });

  // ─── Admin: Delete promo code ─────────────────────────────────────────────
  app.delete("/api/admin/promo-codes/:code", adminAuthMiddleware, (req, res) => {
    const ok = promoManager.delete(req.params.code);
    if (!ok) return res.status(404).json({ success: false, error: "Promo code not found" });
    res.json({ success: true });
  });

  // ─── Admin: Get all API keys ──────────────────────────────────────────────
  app.get("/api/admin/api-keys", adminAuthMiddleware, async (_req, res) => {
    try {
      const keys = await storage.getAllApiKeys();
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Generate API key ──────────────────────────────────────────────
  app.post("/api/admin/api-keys", adminAuthMiddleware, async (req, res) => {
    try {
      const { label, customerId } = req.body;
      if (!label) return res.status(400).json({ success: false, error: "Label is required" });
      const key = `ct_${uuidv4().replace(/-/g, "")}`;
      const apiKey = await storage.createApiKey({ key, label, customerId: customerId || undefined });
      res.json({ success: true, apiKey });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delete API key ────────────────────────────────────────────────
  app.delete("/api/admin/api-keys/:id", adminAuthMiddleware, async (req, res) => {
    try {
      await storage.deleteApiKey(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Revoke API key ────────────────────────────────────────────────
  app.patch("/api/admin/api-keys/:id/revoke", adminAuthMiddleware, async (req, res) => {
    try {
      await storage.revokeApiKey(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Customer: Register ───────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
      if (password.length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });

      const existing = await storage.getCustomerByEmail(email);
      if (existing && existing.emailVerified) {
        return res.status(409).json({ success: false, error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationCode = generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

      if (existing && !existing.emailVerified) {
        await storage.updateCustomer(existing.id, { passwordHash, verificationCode, verificationExpires, name });
      } else {
        await storage.createCustomer({ email, name, passwordHash, verificationCode, verificationExpires });
      }

      res.json({ success: true, message: "Verification code sent to your email" });
      sendVerificationEmail(email, verificationCode, name).catch(() => {});
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Verify email ───────────────────────────────────────────────
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      const customer = await storage.getCustomerByEmail(email);
      if (!customer) return res.status(404).json({ success: false, error: "Account not found" });
      if (customer.emailVerified) return res.status(400).json({ success: false, error: "Email already verified" });
      if (customer.verificationCode !== code) return res.status(400).json({ success: false, error: "Invalid verification code" });
      if (customer.verificationExpires && new Date(customer.verificationExpires) < new Date()) {
        return res.status(400).json({ success: false, error: "Verification code has expired. Please register again." });
      }

      await storage.updateCustomer(customer.id, { emailVerified: true, verificationCode: null, verificationExpires: null });

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      notifyNewCustomer({ name: customer.name || "", email: customer.email }).catch(() => {});

      res.json({ success: true, token, customer: { id: customer.id, email: customer.email, name: customer.name } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Login ──────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

      const customer = await storage.getCustomerByEmail(email);
      if (!customer) return res.status(401).json({ success: false, error: "Invalid email or password" });
      if (!customer.emailVerified) return res.status(403).json({ success: false, error: "Please verify your email first", needsVerification: true, email });
      if (!customer.passwordHash) return res.status(401).json({ success: false, error: "Invalid account" });

      const valid = await bcrypt.compare(password, customer.passwordHash);
      if (!valid) return res.status(401).json({ success: false, error: "Invalid email or password" });

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      res.json({ success: true, token, customer: { id: customer.id, email: customer.email, name: customer.name } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Forgot Password ────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email is required" });

      const customer = await storage.getCustomerByEmail(email);
      if (!customer || !customer.emailVerified) {
        return res.json({ success: true, message: "If this email exists, a reset code has been sent" });
      }

      const code = generateVerificationCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateCustomer(customer.id, { passwordResetCode: code, passwordResetExpires: expires });
      res.json({ success: true, message: "Reset code sent to your email" });
      sendPasswordResetEmail(email, code, customer.name || undefined).catch(() => {});
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Reset Password ─────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, error: "Email, code, and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
      }

      const customer = await storage.getCustomerByEmail(email);
      if (!customer || !customer.passwordResetCode) {
        return res.status(400).json({ success: false, error: "Invalid or expired reset code" });
      }
      if (customer.passwordResetCode !== code) {
        return res.status(400).json({ success: false, error: "Invalid reset code" });
      }
      if (customer.passwordResetExpires && new Date(customer.passwordResetExpires) < new Date()) {
        return res.status(400).json({ success: false, error: "Reset code has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateCustomer(customer.id, {
        passwordHash,
        passwordResetCode: null,
        passwordResetExpires: null,
      });
      res.json({ success: true, message: "Password reset successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Logout ─────────────────────────────────────────────────────
  app.post("/api/auth/logout", async (req, res) => {
    const auth = req.headers.authorization;
    if (auth) await storage.deleteCustomerSession(auth.replace("Bearer ", "")).catch(() => {});
    res.json({ success: true });
  });

  // ─── Customer: Me ─────────────────────────────────────────────────────────
  app.get("/api/auth/me", customerAuthMiddleware, (req: any, res) => {
    const c = req.customer;
    res.json({ success: true, customer: { id: c.id, email: c.email, name: c.name } });
  });

  // ─── Customer: Order history ──────────────────────────────────────────────
  app.get("/api/customer/orders", customerAuthMiddleware, async (req: any, res) => {
    try {
      const orders = await storage.getTransactionsByEmail(req.customer.email);
      res.json({ success: true, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Get my API keys ────────────────────────────────────────────
  app.get("/api/customer/api-keys", customerAuthMiddleware, async (req: any, res) => {
    try {
      const keys = await storage.getApiKeysByCustomer(req.customer.id);
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Generate API key ───────────────────────────────────────────
  app.post("/api/customer/api-keys", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { label } = req.body;
      if (!label) return res.status(400).json({ success: false, error: "Label is required" });
      const existing = await storage.getApiKeysByCustomer(req.customer.id);
      if (existing.length >= 5) return res.status(400).json({ success: false, error: "Maximum 5 API keys allowed" });
      const key = `ct_${uuidv4().replace(/-/g, "")}`;
      const apiKey = await storage.createApiKey({ key, label, customerId: req.customer.id });
      res.json({ success: true, apiKey });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Delete API key ─────────────────────────────────────────────
  app.delete("/api/customer/api-keys/:id", customerAuthMiddleware, async (req: any, res) => {
    try {
      const keys = await storage.getApiKeysByCustomer(req.customer.id);
      const key = keys.find((k) => k.id === parseInt(req.params.id));
      if (!key) return res.status(404).json({ success: false, error: "API key not found" });
      await storage.deleteApiKey(key.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Update profile ─────────────────────────────────────────────
  app.put("/api/customer/profile", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { name, currentPassword, newPassword } = req.body;
      const customer = req.customer;
      const updates: any = {};
      if (name && name.trim()) updates.name = name.trim();
      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ success: false, error: "Current password is required to set a new password" });
        const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
        if (!valid) return res.status(400).json({ success: false, error: "Current password is incorrect" });
        if (newPassword.length < 6) return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
        updates.passwordHash = await bcrypt.hash(newPassword, 10);
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: "No changes provided" });
      const updated = await storage.updateCustomer(customer.id, updates);
      res.json({ success: true, customer: { id: updated?.id, email: updated?.email, name: updated?.name } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: View order credentials ────────────────────────────────────
  app.get("/api/customer/orders/:reference/credentials", customerAuthMiddleware, async (req: any, res) => {
    try {
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Order not found" });
      if (tx.customerEmail !== req.customer.email) return res.status(403).json({ success: false, error: "Access denied" });
      if (tx.status !== "success") return res.status(400).json({ success: false, error: "No credentials for this order" });
      const account = accountManager.findAccountByCustomer(tx.planId, req.customer.email);
      if (!account) return res.status(404).json({ success: false, error: "Account credentials not found. Please contact support." });
      res.json({ success: true, account: {
        email: account.email || "",
        username: account.username || "",
        password: account.password || "",
        activationCode: account.activationCode || "",
        redeemLink: account.redeemLink || "",
        instructions: account.instructions || "",
      }});
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Setup TOTP (generate QR) ──────────────────────────────────
  app.post("/api/customer/setup-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      const secret = speakeasy.generateSecret({ name: `Chege Tech (${req.customer.email})`, length: 20 });
      const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
      res.json({ success: true, secret: secret.base32, qrCodeDataUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Verify and save TOTP ──────────────────────────────────────
  app.post("/api/customer/verify-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { secret, code } = req.body;
      if (!secret || !code) return res.status(400).json({ success: false, error: "Secret and code required" });
      const valid = speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 2 });
      if (!valid) return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
      await storage.updateCustomer(req.customer.id, { totpSecret: secret, totpEnabled: true });
      res.json({ success: true, message: "2FA enabled successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Disable TOTP ───────────────────────────────────────────────
  app.delete("/api/customer/disable-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      await storage.updateCustomer(req.customer.id, { totpSecret: null, totpEnabled: false });
      res.json({ success: true, message: "2FA disabled" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: TOTP status ────────────────────────────────────────────────
  app.get("/api/customer/totp-status", customerAuthMiddleware, async (req: any, res) => {
    res.json({ success: true, totpEnabled: req.customer.totpEnabled ?? false });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APP CONFIG ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Public: Get app config (non-sensitive) ───────────────────────────────
  app.get("/api/app-config", (_req, res) => {
    const config = getAppConfig();
    res.json({ success: true, config: {
      siteName: config.siteName,
      whatsappNumber: config.whatsappNumber,
      whatsappChannel: config.whatsappChannel,
      supportEmail: config.supportEmail,
      chatAssistantEnabled: config.chatAssistantEnabled,
    }});
  });

  // ─── Admin: Get full app config ───────────────────────────────────────────
  app.get("/api/admin/app-config", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, config: getAppConfig() });
  });

  // ─── Admin: Save app config ───────────────────────────────────────────────
  app.put("/api/admin/app-config", adminAuthMiddleware, (req, res) => {
    try {
      const updated = saveAppConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN CUSTOMER MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get all customers ─────────────────────────────────────────────
  app.get("/api/admin/customers", adminAuthMiddleware, async (_req, res) => {
    try {
      const all = await storage.getAllCustomers();
      const safeList = all.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        emailVerified: c.emailVerified,
        suspended: c.suspended,
        totpEnabled: c.totpEnabled,
        createdAt: c.createdAt,
      }));
      res.json({ success: true, customers: safeList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Suspend / unsuspend customer ──────────────────────────────────
  app.patch("/api/admin/customers/:id/suspend", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { suspended } = req.body;
      await storage.updateCustomer(id, { suspended: !!suspended });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delete customer ───────────────────────────────────────────────
  app.delete("/api/admin/customers/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateCustomer(id, { suspended: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDENTIALS OVERRIDE ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get credentials (masked) ─────────────────────────────────────
  app.get("/api/admin/credentials", adminAuthMiddleware, (_req, res) => {
    const override = getCredentialsOverride();
    const status = getSecretsStatus();
    res.json({
      success: true,
      credentials: {
        paystackPublicKey: override.paystackPublicKey || "",
        paystackSecretKey: override.paystackSecretKey ? "••••••••••••••••" : "",
        paystackSecretKeySet: !!override.paystackSecretKey,
        emailUser: override.emailUser || "",
        emailPass: override.emailPass ? "••••••••••••••••" : "",
        emailPassSet: !!override.emailPass,
        adminEmail: override.adminEmail || "",
        adminPassword: override.adminPassword ? "••••••••••••••••" : "",
        adminPasswordSet: !!override.adminPassword,
        telegramBotToken: override.telegramBotToken ? "••••••••••••••••" : "",
        telegramBotTokenSet: !!override.telegramBotToken,
        telegramChatId: override.telegramChatId || "",
        whatsappAccessToken: override.whatsappAccessToken ? "••••••••••••••••" : "",
        whatsappAccessTokenSet: !!override.whatsappAccessToken,
        whatsappPhoneId: override.whatsappPhoneId || "",
        whatsappVerifyToken: override.whatsappVerifyToken || "",
        whatsappAdminPhone: override.whatsappAdminPhone || "",
      },
      effective: {
        paystackPublicKey: status.paystackPublicKey,
        paystackConfigured: status.paystackConfigured,
        emailUser: status.emailUser,
        emailConfigured: status.emailConfigured,
        telegramConfigured: isTelegramConfigured(),
        whatsappConfigured: isWhatsAppWebConnected(),
      },
      sourceOverride: {
        ...status.sourceOverride,
        telegramBotToken: !!override.telegramBotToken,
        telegramChatId: !!override.telegramChatId,
        whatsappAccessToken: !!override.whatsappAccessToken,
        whatsappPhoneId: !!override.whatsappPhoneId,
      },
      envVarSet: {
        paystackPublicKey: !!process.env.PAYSTACK_PUBLIC_KEY,
        paystackSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
        emailUser: !!process.env.EMAIL_USER,
        emailPass: !!process.env.EMAIL_PASS,
        adminEmail: !!process.env.ADMIN_EMAIL,
        adminPassword: !!process.env.ADMIN_PASSWORD,
        telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: !!process.env.TELEGRAM_CHAT_ID,
        whatsappAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
        whatsappPhoneId: !!process.env.WHATSAPP_PHONE_ID,
      },
    });
  });

  // ─── Admin: Save credentials ──────────────────────────────────────────────
  app.put("/api/admin/credentials", adminAuthMiddleware, (req, res) => {
    try {
      const { paystackPublicKey, paystackSecretKey, emailUser, emailPass, adminEmail, adminPassword, telegramBotToken, telegramChatId,
        whatsappAccessToken, whatsappPhoneId, whatsappVerifyToken, whatsappAdminPhone } = req.body;
      const toSave: Record<string, string | undefined> = {};
      if (paystackPublicKey !== undefined) toSave.paystackPublicKey = paystackPublicKey || undefined;
      if (paystackSecretKey !== undefined && paystackSecretKey !== "••••••••••••••••") toSave.paystackSecretKey = paystackSecretKey || undefined;
      if (emailUser !== undefined) toSave.emailUser = emailUser || undefined;
      if (emailPass !== undefined && emailPass !== "••••••••••••••••") toSave.emailPass = emailPass || undefined;
      if (adminEmail !== undefined) toSave.adminEmail = adminEmail || undefined;
      if (adminPassword !== undefined && adminPassword !== "••••••••••••••••") toSave.adminPassword = adminPassword || undefined;
      if (telegramBotToken !== undefined && telegramBotToken !== "••••••••••••••••") toSave.telegramBotToken = telegramBotToken || undefined;
      if (telegramChatId !== undefined) toSave.telegramChatId = telegramChatId || undefined;
      if (whatsappAccessToken !== undefined && whatsappAccessToken !== "••••••••••••••••") toSave.whatsappAccessToken = whatsappAccessToken || undefined;
      if (whatsappPhoneId !== undefined) toSave.whatsappPhoneId = whatsappPhoneId || undefined;
      if (whatsappVerifyToken !== undefined) toSave.whatsappVerifyToken = whatsappVerifyToken || undefined;
      if (whatsappAdminPhone !== undefined) toSave.whatsappAdminPhone = whatsappAdminPhone || undefined;

      saveCredentialsOverride(toSave);
      logAdminAction({ action: "Credentials updated", category: "settings", details: `Updated: ${Object.keys(toSave).join(", ")}`, status: "success" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Status ───────────────────────────────────────────
  app.get("/api/admin/whatsapp/status", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, ...getWhatsAppStatus() });
  });

  // ─── Admin: WhatsApp Web Connect ──────────────────────────────────────────
  app.post("/api/admin/whatsapp/connect", adminAuthMiddleware, async (req, res) => {
    const { phoneNumber } = req.body;
    try {
      await connectWhatsApp(phoneNumber);
      logAdminAction({ action: "WhatsApp connection initiated", category: "settings", status: "success" });
      res.json({ success: true, message: "Connecting... scan the QR code or use the pairing code." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Disconnect ──────────────────────────────────────
  app.post("/api/admin/whatsapp/disconnect", adminAuthMiddleware, async (_req, res) => {
    try {
      await disconnectWhatsApp();
      logAdminAction({ action: "WhatsApp disconnected", category: "settings", status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Send Test ───────────────────────────────────────
  app.post("/api/admin/whatsapp/test", adminAuthMiddleware, async (_req, res) => {
    if (!isWhatsAppWebConnected()) {
      return res.status(400).json({ success: false, error: "WhatsApp not connected — scan QR code first" });
    }
    const override = getCredentialsOverride();
    const adminPhone = override.whatsappAdminPhone || "";
    if (!adminPhone) {
      return res.status(400).json({ success: false, error: "Set your admin WhatsApp number first" });
    }
    try {
      await sendWhatsAppNotification(adminPhone, "✅ *Chege Tech WhatsApp Bot is active!*\n\nYou will receive order notifications here.");
      logAdminAction({ action: "WhatsApp test message sent", category: "settings", status: "success" });
      res.json({ success: true, message: "Test message sent! Check your WhatsApp." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Test Telegram ─────────────────────────────────────────────────
  app.post("/api/admin/telegram/test", adminAuthMiddleware, async (_req, res) => {
    if (!isTelegramConfigured()) {
      return res.status(400).json({ success: false, error: "Telegram not configured — add Bot Token and Chat ID first" });
    }
    const result = await sendTelegramMessage(`✅ <b>Chege Tech Telegram Connected!</b>\n\nAdmin notifications are now active. You'll receive alerts for new orders, registrations, and low stock.`);
    if (result.success) {
      logAdminAction({ action: "Telegram test message sent", category: "settings", status: "success" });
      res.json({ success: true, message: "Test message sent! Check your Telegram." });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN LOGS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get logs ──────────────────────────────────────────────────────
  app.get("/api/admin/logs", adminAuthMiddleware, (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const category = req.query.category as string | undefined;
    const logs = getAdminLogs(limit, category);
    res.json({ success: true, logs });
  });

  // ─── Admin: Clear logs ────────────────────────────────────────────────────
  app.delete("/api/admin/logs", adminAuthMiddleware, (req, res) => {
    try {
      const fs = require("fs");
      const path = require("path");
      const LOG_FILE = path.join(process.cwd(), "admin-logs.json");
      fs.writeFileSync(LOG_FILE, "[]");
      logAdminAction({ action: "Admin logs cleared", category: "settings", details: "All logs deleted", status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return httpServer;
}
