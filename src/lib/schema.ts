import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(), // Polar subscription ID
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  polarCustomerId: text("polar_customer_id").notNull(),
  productId: text("product_id").notNull(),
  priceId: text("price_id"),
  planType: text("plan_type").notNull(), // 'basic' | 'pro'
  status: text("status").notNull().default("incomplete"), // 'active' | 'canceled' | 'past_due' | 'revoked' | 'incomplete'
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const instance = pgTable("instance", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  model: text("model").notNull(),
  modelApiKey: text("model_api_key"),
  channel: text("channel").notNull(),
  botToken: text("bot_token").notNull(),
  status: text("status").notNull().default("deploying"),
  provider: text("provider").notNull().default("hetzner"),
  providerServerId: integer("provider_server_id"),
  providerServerIp: text("provider_server_ip"),
  providerSshKeyId: integer("provider_ssh_key_id"),
  callbackSecret: text("callback_secret"),
  sshPrivateKey: text("ssh_private_key"),
  cfTunnelId: text("cf_tunnel_id"),
  cfDnsRecordId: text("cf_dns_record_id"),
  cfTunnelHostname: text("cf_tunnel_hostname"),
  subscriptionId: text("subscription_id").references(() => subscription.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
