import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import {
  transactions, customers, customerSessions, apiKeys,
  type Transaction, type InsertTransaction,
  type Customer, type CustomerSession, type ApiKey,
} from "@shared/schema";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "database.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_name TEXT,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      email_sent INTEGER DEFAULT 0,
      account_assigned INTEGER DEFAULT 0,
      paystack_reference TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_expires TEXT,
      suspended INTEGER DEFAULT 0,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      password_reset_code TEXT,
      password_reset_expires TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export interface IStorage {
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransaction(reference: string): Promise<Transaction | undefined>;
  updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getStats(): Promise<{ total: number; completed: number; pending: number; revenue: number; emailsSent: number }>;
  getTransactionsByEmail(email: string): Promise<Transaction[]>;

  createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerById(id: number): Promise<Customer | undefined>;
  updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined>;

  createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession>;
  getCustomerSession(token: string): Promise<CustomerSession | undefined>;
  deleteCustomerSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;

  createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey>;
  getApiKeysByCustomer(customerId: number): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;
}

export class DbStorage implements IStorage {
  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [result] = await db.insert(transactions).values(data).returning();
    return result;
  }

  async getTransaction(reference: string): Promise<Transaction | undefined> {
    const [result] = await db.select().from(transactions).where(eq(transactions.reference, reference));
    return result;
  }

  async updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const [result] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.reference, reference))
      .returning();
    return result;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByEmail(email: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.customerEmail, email))
      .orderBy(desc(transactions.createdAt));
  }

  async getStats() {
    const all = await db.select().from(transactions);
    const completed = all.filter((t) => t.status === "success");
    return {
      total: all.length,
      completed: completed.length,
      pending: all.filter((t) => t.status === "pending").length,
      revenue: completed.reduce((sum, t) => sum + t.amount, 0),
      emailsSent: all.filter((t) => t.emailSent).length,
    };
  }

  async createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer> {
    const [result] = await db.insert(customers).values({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: false,
      verificationCode: data.verificationCode,
      verificationExpires: data.verificationExpires.toISOString(),
    }).returning();
    return result;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.email, email));
    return result;
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.id, id));
    return result;
  }

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined> {
    const updateData: any = { ...data };
    if (updateData.verificationExpires instanceof Date) {
      updateData.verificationExpires = updateData.verificationExpires.toISOString();
    }
    if (updateData.passwordResetExpires instanceof Date) {
      updateData.passwordResetExpires = updateData.passwordResetExpires.toISOString();
    }
    const [result] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return result;
  }

  async createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession> {
    const [result] = await db.insert(customerSessions).values({
      customerId,
      token,
      expiresAt: expiresAt.toISOString(),
    }).returning();
    return result;
  }

  async getCustomerSession(token: string): Promise<CustomerSession | undefined> {
    const [result] = await db.select().from(customerSessions).where(eq(customerSessions.token, token));
    return result;
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(customerSessions);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey> {
    const [result] = await db.insert(apiKeys).values({
      customerId: data.customerId ?? null,
      key: data.key,
      label: data.label,
      active: true,
    }).returning();
    return result;
  }

  async getApiKeysByCustomer(customerId: number): Promise<ApiKey[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.customerId, customerId)).orderBy(desc(apiKeys.createdAt));
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async revokeApiKey(id: number): Promise<void> {
    await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: number): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
}

export const storage = new DbStorage();
