import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module to avoid real Supabase calls
vi.mock("./db", () => ({
  listLoans: vi.fn().mockResolvedValue([]),
  createLoan: vi.fn().mockResolvedValue({ id: 1, book_id: 1, borrower_name: "Alice", due_date: null, returned_date: null, notes: null, created_at: new Date() }),
  returnLoan: vi.fn().mockResolvedValue({ id: 1, returned_date: new Date() }),
  deleteLoan: vi.fn().mockResolvedValue(true),
  getBooksByGenre: vi.fn().mockResolvedValue([
    { genre: "Fiction", count: 5 },
    { genre: "Science", count: 3 },
  ]),
  getBooksByMonth: vi.fn().mockResolvedValue([
    { month: "2024-01", count: 2 },
    { month: "2024-02", count: 4 },
  ]),
  getAllBooks: vi.fn().mockResolvedValue([]),
  getBookById: vi.fn().mockResolvedValue(null),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  searchBooks: vi.fn().mockResolvedValue([]),
  filterBooks: vi.fn().mockResolvedValue([]),
  getAllShelfLocations: vi.fn().mockResolvedValue([]),
  createShelfLocation: vi.fn(),
  updateShelfLocation: vi.fn(),
  deleteShelfLocation: vi.fn(),
  getBookStats: vi.fn().mockResolvedValue({ totalBooks: 8, totalShelves: 2 }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "covers/test.jpg", url: "/manus-storage/covers/test.jpg" }),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    jwtSecret: "test-secret",
    ownerOpenId: "owner-123",
    forgeApiUrl: "https://api.example.com",
    forgeApiKey: "test-key",
  },
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("loans router", () => {
  it("lists loans (empty by default)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.loans.list({ activeOnly: false });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a loan record (lend)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.loans.lend({
      book_id: 1,
      borrower_name: "Alice",
    });
    expect(result).toMatchObject({ id: 1, borrower_name: "Alice" });
  });

  it("marks a loan as returned", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.loans.return({ id: 1 });
    expect(result).toMatchObject({ id: 1 });
    expect(result?.returned_date).toBeDefined();
  });

  it("deletes a loan", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.loans.delete({ id: 1 });
    expect(result).toBe(true);
  });
});

describe("stats router", () => {
  it("returns overview stats", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.overview();
    expect(result).toMatchObject({ totalBooks: 8, totalShelves: 2 });
  });

  it("returns genre breakdown", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.byGenre();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({ genre: "Fiction", count: 5 });
  });

  it("returns monthly breakdown", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stats.byMonth();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ month: "2024-01", count: 2 });
  });
});
