import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const shelfLocations = mysqlTable("shelf_locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShelfLocation = typeof shelfLocations.$inferSelect;
export type InsertShelfLocation = typeof shelfLocations.$inferInsert;

export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  isbn: varchar("isbn", { length: 20 }),
  title: varchar("title", { length: 512 }).notNull(),
  authors: text("authors"), // JSON array stored as string
  coverUrl: text("coverUrl"),
  publisher: varchar("publisher", { length: 255 }),
  publishedYear: varchar("publishedYear", { length: 10 }),
  genre: varchar("genre", { length: 128 }),
  description: text("description"),
  pageCount: int("pageCount"),
  language: varchar("language", { length: 64 }),
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }),
  shelfLocationId: int("shelfLocationId").references(() => shelfLocations.id, {
    onDelete: "set null",
  }),
  dateAdded: timestamp("dateAdded").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;
