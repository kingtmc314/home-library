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
    .single();

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
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    lastSignedIn: new Date(data.last_signed_in),
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
      updated_at: new Date().toISOString(),
    };

    if (user.name !== undefined) updates.name = user.name;
    if (user.email !== undefined) updates.email = user.email;
    if (user.loginMethod !== undefined) updates.loginMethod = user.loginMethod;
    if (user.lastSignedIn !== undefined) updates.last_signed_in = user.lastSignedIn.toISOString();
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
        last_signed_in: user.lastSignedIn?.toISOString() || new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[DB] Error creating user:", error);
      throw error;
    }
  }
}
