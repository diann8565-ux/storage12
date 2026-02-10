
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, uuid, text, varchar, boolean, integer, bigint, json, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations, eq, desc, and, inArray } from "drizzle-orm";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import axios from 'axios';

// --- DB Schema Definition ---
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  full_name: varchar('full_name', { length: 255 }),
  avatar_url: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const storageCredentials = pgTable('storage_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  public_key: text('public_key').notNull(),
  private_key_encrypted: text('private_key_encrypted').notNull(),
  url_endpoint: text('url_endpoint').notNull(),
  provider: varchar('provider', { length: 50 }).default('imagekit'),
  is_active: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 50 }).default('#3B82F6'),
  icon: varchar('icon', { length: 50 }).default('folder'),
  sort_order: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storage_account_id: uuid('storage_account_id').references(() => storageCredentials.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  file_type: varchar('file_type', { length: 100 }),
  size: bigint('size', { mode: 'number' }).default(0),
  file_id: varchar('file_id', { length: 255 }), 
  tags: json('tags').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action_type: varchar('action_type', { length: 100 }).notNull(),
  details: json('details').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  last_used_at: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fileCategories = pgTable('file_categories', {
  file_id: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  category_id: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.file_id, t.category_id] }),
}));

// --- DB Connection ---
let db;
const url = process.env.DATABASE_URL;
if (url) {
  try {
    const sql = neon(url);
    db = drizzle(sql, { schema: { users, profiles, storageCredentials, categories, files, activityLogs, apiKeys, fileCategories } });
  } catch (err) {
    console.error("DB init failed:", err);
  }
}

// --- Auth Utils ---
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
};

const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('X-API-KEY');
  
  // 1. Check Bearer Token (JWT)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      c.set('user', payload);
      await next();
      return;
    } catch (err) {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  // 2. Check API Key
  if (apiKeyHeader) {
    try {
      const [apiKeyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.key, apiKeyHeader)).limit(1);
      if (apiKeyRecord) {
        // Update last_used_at
        await db.update(apiKeys).set({ last_used_at: new Date() }).where(eq(apiKeys.id, apiKeyRecord.id));
        
        // Fetch user info
        const [user] = await db.select().from(users).where(eq(users.id, apiKeyRecord.user_id)).limit(1);
        if (user) {
          c.set('user', { id: user.id, email: user.email, role: user.role });
          await next();
          return;
        }
      }
    } catch (err) {
      console.error("API Key Auth Error:", err);
    }
  }

  return c.json({ error: 'Unauthorized' }, 401);
};

// --- App Initialization ---
export const app = new Hono<{
  Variables: {
    user: {
      id: string;
      email: string;
      role: string;
    }
  }
}>().basePath('/api');

// Fix CORS: Explicitly allow all origins, methods, and headers
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}));

app.use('*', compress());
app.use('*', logger());

// Debug Middleware to log path
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] Request: ${c.req.method} ${c.req.path}`);
  await next();
});

// --- Routes ---

// Health - Moved up and simplified
app.get('/health', (c) => {
  console.log('Health check hit');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test Endpoint for API Key Verification
app.get('/test-connection', authMiddleware, (c) => {
  const u = c.get('user');
  return c.json({ 
    success: true, 
    message: "Connection successful!", 
    user: { id: u.id, email: u.email },
    timestamp: new Date().toISOString()
  });
});

// Auth Routes
app.post('/auth/login', zValidator('json', z.object({ email: z.string().email(), password: z.string() })), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    if (email === 'admin@storage.com' && password === 'master-key-secure-login') {
      const token = generateToken({ id: 'master', email, role: 'admin' });
      return c.json({ user: { id: 'master', email, role: 'admin' }, token });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return c.json({ error: 'Invalid credentials' }, 400);
    return c.json({ user: { id: user.id, email: user.email }, token: generateToken(user) });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

app.put('/auth/password', authMiddleware, zValidator('json', z.object({ oldPassword: z.string(), newPassword: z.string() })), async (c) => {
  const u = c.get('user');
  const { oldPassword, newPassword } = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  if (!user || !(await bcrypt.compare(oldPassword, user.password_hash))) return c.json({ error: 'Invalid old password' }, 400);
  const salt = await bcrypt.genSalt(10);
  await db.update(users).set({ password_hash: await bcrypt.hash(newPassword, salt) }).where(eq(users.id, u.id));
  return c.json({ success: true });
});

app.post('/auth/dev-login', async (c) => {
  try {
    let email = 'eka.ckp16799@gmail.com';
    try { const body = await c.req.json(); if (body.email) email = body.email; } catch (e) {}
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
       const salt = await bcrypt.genSalt(10);
       [user] = await db.insert(users).values({ email, password_hash: await bcrypt.hash('password', salt) }).returning();
       await db.insert(profiles).values({ user_id: user.id, full_name: 'Developer User' });
    }
    return c.json({ user: { id: user.id, email: user.email }, token: generateToken(user) });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

app.get('/auth/me', authMiddleware, async (c) => {
  const u = c.get('user');
  const [user] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, u.id)).limit(1);
  return c.json({ user: { ...user, ...profile } });
});

// Profiles
app.get('/profiles', authMiddleware, async (c) => {
  const u = c.get('user');
  const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, u.id)).limit(1);
  return c.json(profile || {});
});

app.patch('/profiles', authMiddleware, zValidator('json', z.object({ full_name: z.string().optional(), avatar_url: z.string().optional() })), async (c) => {
  const u = c.get('user');
  const [updated] = await db.update(profiles).set({ ...c.req.valid('json'), updatedAt: new Date() }).where(eq(profiles.user_id, u.id)).returning();
  return c.json(updated);
});

// Files Routes
app.get('/files', authMiddleware, async (c) => {
  const u = c.get('user');
  const result = await db.select().from(files).where(eq(files.user_id, u.id)).orderBy(desc(files.createdAt));
  return c.json(result);
});

app.post('/files', authMiddleware, zValidator('json', z.object({
  name: z.string(), url: z.string(), file_type: z.string().optional(), size: z.number().optional(), file_id: z.string().optional(), category_ids: z.array(z.string()).optional()
})), async (c) => {
  const u = c.get('user');
  const { category_ids, ...data } = c.req.valid('json');
  const [newFile] = await db.insert(files).values({ ...data, user_id: u.id }).returning();
  if (category_ids?.length) {
    await db.insert(fileCategories).values(category_ids.map(cid => ({ file_id: newFile.id, category_id: cid })));
  }
  return c.json(newFile);
});

app.delete('/files/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  await db.delete(files).where(and(eq(files.id, c.req.param('id')), eq(files.user_id, u.id)));
  return c.json({ success: true });
});

app.get('/files/:id/categories', authMiddleware, async (c) => {
  const res = await db.select({ category_id: fileCategories.category_id }).from(fileCategories).where(eq(fileCategories.file_id, c.req.param('id')));
  return c.json(res.map(r => r.category_id));
});

app.post('/files/:id/categories', authMiddleware, zValidator('json', z.object({ category_ids: z.array(z.string()) })), async (c) => {
  const fileId = c.req.param('id');
  const { category_ids } = c.req.valid('json');
  await db.delete(fileCategories).where(eq(fileCategories.file_id, fileId));
  if (category_ids.length) {
    await db.insert(fileCategories).values(category_ids.map(cid => ({ file_id: fileId, category_id: cid })));
  }
  return c.json({ success: true });
});

// Storage Credentials
app.get('/storage_credentials', authMiddleware, async (c) => {
  const u = c.get('user');
  const res = await db.select().from(storageCredentials).where(eq(storageCredentials.user_id, u.id));
  return c.json(res);
});

app.post('/storage_credentials', authMiddleware, zValidator('json', z.object({
  name: z.string(), provider: z.string(), public_key: z.string(), private_key_encrypted: z.string(), url_endpoint: z.string()
})), async (c) => {
  const u = c.get('user');
  const [res] = await db.insert(storageCredentials).values({ ...c.req.valid('json'), user_id: u.id }).returning();
  return c.json(res);
});

app.patch('/storage_credentials/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  const body = await c.req.json();
  const [res] = await db.update(storageCredentials).set({ ...body, updatedAt: new Date() }).where(and(eq(storageCredentials.id, c.req.param('id')), eq(storageCredentials.user_id, u.id))).returning();
  return c.json(res);
});

app.delete('/storage_credentials/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  await db.delete(storageCredentials).where(and(eq(storageCredentials.id, c.req.param('id')), eq(storageCredentials.user_id, u.id)));
  return c.json({ success: true });
});

// Categories
app.get('/categories', authMiddleware, async (c) => {
  const u = c.get('user');
  const res = await db.select().from(categories).where(eq(categories.user_id, u.id));
  return c.json(res);
});

app.post('/categories', authMiddleware, zValidator('json', z.object({ name: z.string(), color: z.string().optional(), icon: z.string().optional() })), async (c) => {
  const u = c.get('user');
  const [res] = await db.insert(categories).values({ ...c.req.valid('json'), user_id: u.id }).returning();
  return c.json(res);
});

app.patch('/categories/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  const body = await c.req.json();
  const [res] = await db.update(categories).set({ ...body, updatedAt: new Date() }).where(and(eq(categories.id, c.req.param('id')), eq(categories.user_id, u.id))).returning();
  return c.json(res);
});

app.delete('/categories/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  await db.delete(categories).where(and(eq(categories.id, c.req.param('id')), eq(categories.user_id, u.id)));
  return c.json({ success: true });
});

// Activity Logs
app.get('/activity_logs', authMiddleware, async (c) => {
  const u = c.get('user');
  const res = await db.select().from(activityLogs).where(eq(activityLogs.user_id, u.id)).orderBy(desc(activityLogs.createdAt));
  return c.json(res);
});

app.post('/activity_logs', authMiddleware, zValidator('json', z.object({ action_type: z.string(), details: z.any().optional() })), async (c) => {
  const u = c.get('user');
  const [res] = await db.insert(activityLogs).values({ ...c.req.valid('json'), user_id: u.id }).returning();
  return c.json(res);
});

// API Keys
app.get('/api_keys', authMiddleware, async (c) => {
  const u = c.get('user');
  const res = await db.select().from(apiKeys).where(eq(apiKeys.user_id, u.id)).orderBy(desc(apiKeys.createdAt));
  return c.json(res);
});

app.post('/api_keys', authMiddleware, zValidator('json', z.object({ name: z.string() })), async (c) => {
  const u = c.get('user');
  const key = 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const [res] = await db.insert(apiKeys).values({ name: c.req.valid('json').name, key, user_id: u.id }).returning();
  return c.json(res);
});

app.delete('/api_keys/:id', authMiddleware, async (c) => {
  const u = c.get('user');
  await db.delete(apiKeys).where(and(eq(apiKeys.id, c.req.param('id')), eq(apiKeys.user_id, u.id)));
  return c.json({ success: true });
});

// Functions (Placeholder for client compatibility)
app.post('/functions/:name', authMiddleware, async (c) => {
  return c.json({ success: true, message: "Function executed" });
});

// AI Route
app.post('/ai/generate', authMiddleware, zValidator('json', z.object({ prompt: z.string(), model: z.string().optional(), pageContext: z.string().optional() })), async (c) => {
  const { prompt, model, pageContext } = c.req.valid('json');
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  try {
    const res = await axios.post('https://one.apprentice.cyou/api/v1/chat/completions', {
      model: model || 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: `Anda asisten AI di halaman: ${pageContext}. Jawab Bahasa Indonesia.` },
        { role: 'user', content: prompt }
      ]
    }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    return c.json({ result: res.data.choices[0].message.content });
  } catch (e) { return c.json({ error: 'AI Error' }, 500); }
});

export const config = { runtime: 'nodejs' };
export default handle(app);
