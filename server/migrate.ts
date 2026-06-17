/**
 * Server-side migration: creates the book_files table in Supabase if it doesn't exist.
 * Called once from server startup.
 */
import { supabaseAdmin } from "./supabase";

export async function runMigrations() {
  // Check if book_files table exists
  const { error: checkError } = await supabaseAdmin
    .from("book_files")
    .select("id")
    .limit(1);

  if (!checkError) {
    // Table already exists
    return;
  }

  if (checkError.code !== "42P01" && !checkError.message.includes("does not exist") && !checkError.message.includes("schema cache")) {
    console.error("[Migration] Unexpected error checking book_files:", checkError.message);
    return;
  }

  // Table doesn't exist - we need to create it
  // Use the Supabase REST API to call a stored procedure
  // Since we can't run DDL directly, we'll use the pg connection approach
  console.log("[Migration] book_files table not found, attempting to create...");

  // Try using the Supabase REST API's special SQL endpoint
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sql = `
    CREATE TABLE IF NOT EXISTS book_files (
      id BIGSERIAL PRIMARY KEY,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      file_name VARCHAR(512) NOT NULL,
      file_key TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size BIGINT DEFAULT 0,
      mime_type VARCHAR(128) DEFAULT 'application/pdf',
      auto_category VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_book_files_book_id ON book_files(book_id);
  `;

  // Try the Supabase SQL endpoint (available via the pg connection)
  // Use the project's direct database connection
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  // Try the Supabase Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (mgmtRes.ok) {
    console.log("[Migration] book_files table created via Management API");
    return;
  }

  // Try the Supabase SQL endpoint via the REST API
  const sqlRes = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (sqlRes.ok) {
    console.log("[Migration] book_files table created via exec_sql RPC");
    return;
  }

  console.warn("[Migration] Could not create book_files table automatically.");
  console.warn("[Migration] Please run the following SQL in your Supabase dashboard:");
  console.warn(sql);
}
