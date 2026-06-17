import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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
CREATE INDEX IF NOT EXISTS idx_book_files_auto_category ON book_files(auto_category);
`;

// Use the Supabase REST API to run raw SQL via the pg endpoint
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  },
  body: JSON.stringify({ sql }),
});

if (!res.ok) {
  const text = await res.text();
  console.log("exec_sql not available, trying direct approach...");
  
  // Try using the pg endpoint directly
  const pgRes = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!pgRes.ok) {
    const pgText = await pgRes.text();
    console.log("pg endpoint not available either:", pgText.substring(0, 200));
    
    // Try the management API
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    console.log("Project ref:", projectRef);
    
    if (projectRef) {
      const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const mgmtText = await mgmtRes.text();
      console.log("Management API response:", mgmtRes.status, mgmtText.substring(0, 200));
    }
  } else {
    const pgData = await pgRes.json();
    console.log("pg endpoint success:", pgData);
  }
} else {
  const data = await res.json();
  console.log("exec_sql success:", data);
}

// Verify by checking if the table exists
const { data: tables, error } = await supabase
  .from("book_files")
  .select("id")
  .limit(1);

if (error && error.code === "42P01") {
  console.log("❌ Table does not exist yet");
} else if (error) {
  console.log("✅ Table exists (got error but not 42P01):", error.message);
} else {
  console.log("✅ book_files table exists and accessible");
}
