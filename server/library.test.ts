import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module so tests don't hit Supabase
vi.mock("./db", () => ({
  getAllBooks: vi.fn().mockResolvedValue([
    {
      id: 1,
      isbn: "9780743273565",
      title: "The Great Gatsby",
      authors: "F. Scott Fitzgerald",
      cover_url: "https://example.com/cover.jpg",
      publisher: "Scribner",
      published_year: "1925",
      genre: "Fiction",
      description: "A story of the fabulously wealthy Jay Gatsby.",
      page_count: 180,
      language: "English",
      purchase_price: 12.99,
      shelf_location_id: 1,
      date_added: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
  getBookById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) {
      return {
        id: 1,
        isbn: "9780743273565",
        title: "The Great Gatsby",
        authors: "F. Scott Fitzgerald",
        cover_url: null,
        publisher: "Scribner",
        published_year: "1925",
        genre: "Fiction",
        description: "A story of the fabulously wealthy Jay Gatsby.",
        page_count: 180,
        language: "English",
        purchase_price: 12.99,
        shelf_location_id: null,
        date_added: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }),
  searchBooks: vi.fn().mockResolvedValue([]),
  filterBooks: vi.fn().mockResolvedValue([]),
  createBook: vi.fn().mockImplementation(async (book: any) => ({
    id: 99,
    ...book,
    date_added: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  updateBook: vi.fn().mockImplementation(async (id: number, updates: any) => ({
    id,
    ...updates,
    updated_at: new Date().toISOString(),
  })),
  deleteBook: vi.fn().mockResolvedValue(true),
  getAllShelfLocations: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Living Room Shelf A",
      description: "Top shelf by the window",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
  createShelfLocation: vi.fn().mockImplementation(async (name: string, description?: string) => ({
    id: 10,
    name,
    description: description || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  updateShelfLocation: vi.fn().mockImplementation(async (id: number, name: string, description?: string) => ({
    id,
    name,
    description: description || null,
    updated_at: new Date().toISOString(),
  })),
  deleteShelfLocation: vi.fn().mockResolvedValue(true),
  getBookStats: vi.fn().mockResolvedValue({ totalBooks: 5, totalShelves: 2 }),
}));

vi.mock("./bookLookup", () => ({
  lookupBookByISBN: vi.fn().mockResolvedValue({
    isbn: "9780743273565",
    title: "The Great Gatsby",
    authors: "F. Scott Fitzgerald",
    cover_url: "https://example.com/cover.jpg",
    publisher: "Scribner",
    published_year: "1925",
    genre: "Fiction",
    description: "A novel.",
    page_count: 180,
    language: "en",
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
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

describe("books router", () => {
  it("books.list returns all books", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const books = await caller.books.list();
    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBeGreaterThan(0);
    expect(books[0]).toHaveProperty("title");
    expect(books[0]).toHaveProperty("authors");
  });

  it("books.get returns a book by id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const book = await caller.books.get({ id: 1 });
    expect(book).not.toBeNull();
    expect(book?.title).toBe("The Great Gatsby");
    expect(book?.authors).toBe("F. Scott Fitzgerald");
  });

  it("books.get returns null for non-existent id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const book = await caller.books.get({ id: 9999 });
    expect(book).toBeNull();
  });

  it("books.search returns results", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const results = await caller.books.search({ query: "gatsby" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("books.lookup fetches book data by ISBN", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const data = await caller.books.lookup({ isbn: "9780743273565" });
    expect(data).not.toBeNull();
    expect(data?.title).toBe("The Great Gatsby");
    expect(data?.isbn).toBe("9780743273565");
  });

  it("books.create requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.books.create({ title: "Test Book" })
    ).rejects.toThrow();
  });

  it("books.create saves a book when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const book = await caller.books.create({
      title: "Test Book",
      authors: "Test Author",
      isbn: "1234567890",
      genre: "Fiction",
      purchase_price: 9.99,
    });
    expect(book).not.toBeNull();
    expect(book?.title).toBe("Test Book");
  });

  it("books.update modifies a book when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const updated = await caller.books.update({
      id: 1,
      title: "Updated Title",
      purchase_price: 14.99,
    });
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated Title");
  });

  it("books.delete removes a book when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.books.delete({ id: 1 });
    expect(result).toBe(true);
  });
});

describe("shelves router", () => {
  it("shelves.list returns all shelf locations", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const shelves = await caller.shelves.list();
    expect(Array.isArray(shelves)).toBe(true);
    expect(shelves.length).toBeGreaterThan(0);
    expect(shelves[0]).toHaveProperty("name");
  });

  it("shelves.create requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.shelves.create({ name: "New Shelf" })
    ).rejects.toThrow();
  });

  it("shelves.create saves a shelf when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const shelf = await caller.shelves.create({
      name: "Study Room Shelf B",
      description: "Bottom shelf",
    });
    expect(shelf).not.toBeNull();
    expect(shelf?.name).toBe("Study Room Shelf B");
  });

  it("shelves.update modifies a shelf when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const updated = await caller.shelves.update({
      id: 1,
      name: "Updated Shelf Name",
    });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated Shelf Name");
  });

  it("shelves.delete removes a shelf when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.shelves.delete({ id: 1 });
    expect(result).toBe(true);
  });
});

describe("stats router", () => {
  it("stats.overview returns total books and shelves", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const stats = await caller.stats.overview();
    expect(stats).toHaveProperty("totalBooks");
    expect(stats).toHaveProperty("totalShelves");
    expect(typeof stats.totalBooks).toBe("number");
    expect(typeof stats.totalShelves).toBe("number");
  });
});
