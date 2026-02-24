import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").unique().notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  amount: integer("amount").notNull(),
  status: text("status").default("pending"),
  emailSent: integer("email_sent", { mode: "boolean" }).default(false),
  accountAssigned: integer("account_assigned", { mode: "boolean" }).default(false),
  paystackReference: text("paystack_reference"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").unique().notNull(),
  name: text("name"),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  verificationCode: text("verification_code"),
  verificationExpires: text("verification_expires"),
  suspended: integer("suspended", { mode: "boolean" }).default(false),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).default(false),
  passwordResetCode: text("password_reset_code"),
  passwordResetExpires: text("password_reset_expires"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const customerSessions = sqliteTable("customer_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  token: text("token").unique().notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id"),
  key: text("key").unique().notNull(),
  label: text("label").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Customer = typeof customers.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;

export interface SubscriptionPlan {
  name: string;
  price: number;
  duration: string;
  features: string[];
  shared: boolean;
  maxUsers: number;
  popular?: boolean;
  category?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface PlanCategory {
  category: string;
  icon: string;
  color: string;
  plans: Record<string, SubscriptionPlan>;
}

export interface AccountEntry {
  id: string;
  email?: string;
  username?: string;
  password?: string;
  activationCode?: string;
  redeemLink?: string;
  instructions?: string;
  currentUsers: number;
  maxUsers: number;
  fullyUsed: boolean;
  disabled?: boolean;
  usedBy: Array<{
    customerEmail: string;
    customerName: string;
    assignedAt: string;
  }>;
  addedAt: string;
}

export interface AccountsData {
  [planId: string]: AccountEntry[];
}
