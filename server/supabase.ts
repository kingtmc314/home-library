import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

// Server-side admin client (bypasses RLS)
export const supabaseAdmin = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Types for our tables
export interface ShelfLocation {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: number;
  isbn: string | null;
  title: string;
  authors: string | null; // JSON array as string
  cover_url: string | null;
  publisher: string | null;
  published_year: string | null;
  genre: string | null;
  description: string | null;
  page_count: number | null;
  language: string | null;
  purchase_price: number | null;
  shelf_location_id: number | null;
  date_added: string;
  created_at: string;
  updated_at: string;
  // reading status (added in Round 5)
  reading_status: 'unread' | 'reading' | 'finished';
  current_page: number | null;
  total_pages: number | null;
  // joined
  shelf_locations?: ShelfLocation | null;
}
