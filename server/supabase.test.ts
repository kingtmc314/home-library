import { describe, expect, it } from "vitest";

describe("Supabase credentials", () => {
  it("SUPABASE_URL is set and valid", () => {
    const url = process.env.SUPABASE_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
  });

  it("SUPABASE_ANON_KEY is set and is a JWT", () => {
    const key = process.env.SUPABASE_ANON_KEY;
    expect(key).toBeDefined();
    expect(key).toMatch(/^eyJ/);
  });

  it("SUPABASE_SERVICE_ROLE_KEY is set and is a JWT", () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(key).toBeDefined();
    expect(key).toMatch(/^eyJ/);
  });

  it("can reach Supabase health endpoint", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase credentials not set");
    }
    const res = await fetch(`${url}/rest/v1/shelf_locations?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    // 200 = tables exist, 404 = project not ready — both mean credentials are valid
    expect([200, 404, 406]).toContain(res.status);
  });
});
