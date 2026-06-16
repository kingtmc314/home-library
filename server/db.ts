import { supabaseAdmin, Book, ShelfLocation } from "./supabase";

/**
 * ============ SHELF LOCATIONS ============
 */

export async function getAllShelfLocations(): Promise<ShelfLocation[]> {
  const { data, error } = await supabaseAdmin
    .from("shelf_locations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[DB] Error fetching shelf locations:", error);
    return [];
  }

  return data || [];
}

export async function createShelfLocation(
  name: string,
  description?: string
): Promise<ShelfLocation | null> {
  const { data, error } = await supabaseAdmin
    .from("shelf_locations")
    .insert([{ name, description }])
    .select()
    .single();

  if (error) {
    console.error("[DB] Error creating shelf location:", error);
    return null;
  }

  return data;
}

export async function updateShelfLocation(
  id: number,
  name: string,
  description?: string
): Promise<ShelfLocation | null> {
  const { data, error } = await supabaseAdmin
    .from("shelf_locations")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[DB] Error updating shelf location:", error);
    return null;
  }

  return data;
}

export async function deleteShelfLocation(id: number): Promise<boolean> {
  const { error } = await supabaseAdmin.from("shelf_locations").delete().eq("id", id);

  if (error) {
    console.error("[DB] Error deleting shelf location:", error);
    return false;
  }

  return true;
}

/**
 * ============ BOOKS ============
 */

export async function getAllBooks(): Promise<Book[]> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    )
    .order("date_added", { ascending: false });

  if (error) {
    console.error("[DB] Error fetching books:", error);
    return [];
  }

  return data || [];
}

export async function getBookById(id: number): Promise<Book | null> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("[DB] Error fetching book:", error);
    return null;
  }

  return data;
}

export async function createBook(book: {
  isbn?: string;
  title: string;
  authors?: string;
  cover_url?: string;
  publisher?: string;
  published_year?: string;
  genre?: string;
  description?: string;
  page_count?: number;
  language?: string;
  purchase_price?: number;
  shelf_location_id?: number;
}): Promise<Book | null> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .insert([book])
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    )
    .single();

  if (error) {
    console.error("[DB] Error creating book:", error);
    return null;
  }

  return data;
}

export async function updateBook(
  id: number,
  book: {
    isbn?: string;
    title?: string;
    authors?: string;
    cover_url?: string;
    publisher?: string;
    published_year?: string;
    genre?: string;
    description?: string;
    page_count?: number;
    language?: string;
    purchase_price?: number;
    shelf_location_id?: number;
  }
): Promise<Book | null> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .update({ ...book, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    )
    .single();

  if (error) {
    console.error("[DB] Error updating book:", error);
    return null;
  }

  return data;
}

export async function deleteBook(id: number): Promise<boolean> {
  const { error } = await supabaseAdmin.from("books").delete().eq("id", id);

  if (error) {
    console.error("[DB] Error deleting book:", error);
    return false;
  }

  return true;
}

/**
 * ============ STATS ============
 */

export async function getBookStats(): Promise<{ totalBooks: number; totalShelves: number }> {
  const [booksResult, shelvesResult] = await Promise.all([
    supabaseAdmin.from("books").select("id", { count: "exact" }),
    supabaseAdmin.from("shelf_locations").select("id", { count: "exact" }),
  ]);

  return {
    totalBooks: booksResult.count || 0,
    totalShelves: shelvesResult.count || 0,
  };
}

/**
 * ============ SEARCH ============
 */

export async function searchBooks(query: string): Promise<Book[]> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    )
    .or(`title.ilike.%${query}%,authors.ilike.%${query}%`)
    .order("date_added", { ascending: false });

  if (error) {
    console.error("[DB] Error searching books:", error);
    return [];
  }

  return data || [];
}

export async function filterBooks(filters: {
  genre?: string;
  shelfLocationId?: number;
}): Promise<Book[]> {
  let query = supabaseAdmin
    .from("books")
    .select(
      `
      *,
      shelf_locations:shelf_location_id (*)
    `
    );

  if (filters.genre) {
    query = query.eq("genre", filters.genre);
  }

  if (filters.shelfLocationId) {
    query = query.eq("shelf_location_id", filters.shelfLocationId);
  }

  const { data, error } = await query.order("date_added", { ascending: false });

  if (error) {
    console.error("[DB] Error filtering books:", error);
    return [];
  }

  return data || [];
}


/**
 * ============ USERS (Auth) ============
 */

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("openId", openId)
    .maybeSingle();

  if (error) {
    console.error("[DB] Error fetching user:", error);
    return undefined;
  }

  if (!data) return undefined;

  return {
    id: data.id,
    openId: data.openId,
    name: data.name,
    email: data.email,
    loginMethod: data.loginMethod,
    role: data.role,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    lastSignedIn: new Date(data.lastSignedIn),
  };
}

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
  role?: "user" | "admin";
}): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const existingUser = await getUserByOpenId(user.openId);

  if (existingUser) {
    // Update existing user
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (user.name !== undefined) updates.name = user.name;
    if (user.email !== undefined) updates.email = user.email;
    if (user.loginMethod !== undefined) updates.loginMethod = user.loginMethod;
    if (user.lastSignedIn !== undefined) updates.lastSignedIn = user.lastSignedIn.toISOString();
    if (user.role !== undefined) updates.role = user.role;

    const { error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("openId", user.openId);

    if (error) {
      console.error("[DB] Error updating user:", error);
      throw error;
    }
  } else {
    // Create new user
    const { error } = await supabaseAdmin.from("users").insert([
      {
        openId: user.openId,
        name: user.name || null,
        email: user.email || null,
        loginMethod: user.loginMethod || null,
        role: user.role || "user",
        lastSignedIn: user.lastSignedIn?.toISOString() || new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[DB] Error creating user:", error);
      throw error;
    }
  }
}

/**
 * ============ LOAN TRACKER ============
 */
export interface LoanRecord {
  id: number;
  book_id: number;
  borrower_name: string;
  borrower_contact: string | null;
  lent_date: string;
  due_date: string | null;
  returned_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  books?: Book;
}

export async function createLoan(loan: {
  book_id: number;
  borrower_name: string;
  borrower_contact?: string;
  lent_date?: string;
  due_date?: string;
  notes?: string;
}): Promise<LoanRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("loan_records")
    .insert([{
      book_id: loan.book_id,
      borrower_name: loan.borrower_name,
      borrower_contact: loan.borrower_contact || null,
      lent_date: loan.lent_date || new Date().toISOString(),
      due_date: loan.due_date || null,
      notes: loan.notes || null,
    }])
    .select(`*, books:book_id (*)`)
    .single();
  if (error) {
    console.error("[DB] Error creating loan:", error);
    return null;
  }
  return data;
}

export async function returnLoan(id: number): Promise<LoanRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("loan_records")
    .update({ returned_date: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, books:book_id (*)`)
    .single();
  if (error) {
    console.error("[DB] Error returning loan:", error);
    return null;
  }
  return data;
}

export async function listLoans(activeOnly = false): Promise<LoanRecord[]> {
  let query = supabaseAdmin
    .from("loan_records")
    .select(`*, books:book_id (*)`)
    .order("lent_date", { ascending: false });
  if (activeOnly) {
    query = (query as any).is("returned_date", null);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[DB] Error listing loans:", error);
    return [];
  }
  return data || [];
}

export async function deleteLoan(id: number): Promise<boolean> {
  const { error } = await supabaseAdmin.from("loan_records").delete().eq("id", id);
  if (error) {
    console.error("[DB] Error deleting loan:", error);
    return false;
  }
  return true;
}

/**
 * ============ STATS CHARTS ============
 */
export async function getBooksByGenre(): Promise<{ genre: string; count: number }[]> {
  const { data, error } = await supabaseAdmin.from("books").select("genre");
  if (error) {
    console.error("[DB] Error getting genre stats:", error);
    return [];
  }
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const g = row.genre || "Unknown";
    counts[g] = (counts[g] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getBooksByMonth(): Promise<{ month: string; count: number }[]> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select("date_added")
    .order("date_added", { ascending: true });
  if (error) {
    console.error("[DB] Error getting monthly stats:", error);
    return [];
  }
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    if (!row.date_added) continue;
    const d = new Date(row.date_added);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
