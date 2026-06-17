import axios from "axios";
import https from "https";

export interface BookMetadata {
  title: string;
  authors: string[];
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: string | null;
  genre: string | null;
  description: string | null;
  pageCount: number | null;
  language: string | null;
  source?: string;
}

// ─── 1. Google Books ──────────────────────────────────────────────────────────
async function lookupGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  try {
    const params: Record<string, string | number> = {
      q: `isbn:${isbn}`,
      maxResults: 1,
    };
    // Use API key if provided to lift the daily quota
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (apiKey) params.key = apiKey;

    const response = await axios.get("https://www.googleapis.com/books/v1/volumes", {
      params,
      timeout: 6000,
    });

    if (!response.data.items || response.data.items.length === 0) return null;

    const volumeInfo = response.data.items[0].volumeInfo || {};
    // Upgrade cover to larger size
    const rawCover: string | undefined = volumeInfo.imageLinks?.thumbnail;
    const coverUrl = rawCover
      ? rawCover.replace("http://", "https://").replace("&zoom=1", "&zoom=0")
      : null;

    return {
      title: volumeInfo.title || "Unknown Title",
      authors: volumeInfo.authors || [],
      coverUrl,
      publisher: volumeInfo.publisher || null,
      publishedYear: volumeInfo.publishedDate?.substring(0, 4) || null,
      genre: volumeInfo.categories?.[0] || null,
      description: volumeInfo.description || null,
      pageCount: volumeInfo.pageCount || null,
      language: volumeInfo.language || null,
      source: "Google Books",
    };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 429) {
      console.warn("[Google Books] Daily quota exceeded — trying fallbacks");
    } else {
      console.error("[Google Books] Error:", status || error?.message);
    }
    return null;
  }
}

// ─── 2. Douban Books (Chinese/HK/TW books) ───────────────────────────────────
/**
 * Scrapes book.douban.com for Chinese-language books not in Google Books.
 * Works by:
 *   1. Searching douban.com/search for the ISBN to get the subject ID
 *   2. Fetching book.douban.com/subject/{id}/ for full metadata via og: tags
 */
async function lookupDouban(isbn: string): Promise<BookMetadata | null> {
  const HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    Referer: "https://book.douban.com/",
    Cookie: 'll="118281"; bid=manushomlib',
  };

  const fetchHtml = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const req = https.request(url, { headers: HEADERS, timeout: 8000 }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      req.end();
    });

  try {
    // Step 1: search for the ISBN
    const searchHtml = await fetchHtml(
      `https://www.douban.com/search?cat=1001&q=${encodeURIComponent(isbn)}`
    );

    // Check for no-results
    if (searchHtml.includes("没有找到")) return null;

    // Extract first subject ID from search results
    const sidMatch = searchHtml.match(/sid:\s*(\d+)/);
    if (!sidMatch) return null;
    const subjectId = sidMatch[1];

    // Step 2: fetch book detail page
    const bookHtml = await fetchHtml(`https://book.douban.com/subject/${subjectId}/`);

    // Extract og: meta tags
    const ogTitle = bookHtml.match(/property="og:title"\s+content="([^"]+)"/)?.[1];
    const ogDesc = bookHtml.match(/property="og:description"\s+content="([^"]+)"/)?.[1];
    const ogImg = bookHtml.match(/property="og:image"\s+content="([^"]+)"/)?.[1];

    if (!ogTitle) return null;

    // Extract structured info from the #info div
    const infoSection = bookHtml.match(/<div id="info"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const cleanInfo = infoSection.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // Parse structured fields from the cleaned info text
    // Format: "作者: value 出版社: value 出版年: value ISBN: value 页数: value"
    const extractField = (label: string): string | null => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = cleanInfo.match(new RegExp(`${escaped}[：:]\\s*([^\\s][^出版社出版年页数装帧ISBN定价]{1,60}?)(?:\\s+(?:作者|出版社|出版年|页数|装帧|ISBN|定价)|$)`));
      return m ? m[1].trim() : null;
    };

    // Split on known field labels (handles both "作者:" and "作者 :" formats)
    const fields: Record<string, string> = {};
    const parts = cleanInfo.split(/(?=作者|编者|译者|出版社|出版年|页数|装帧|ISBN|定价)/);
    for (const part of parts) {
      const m = part.match(/^(作者|编者|译者|出版社|出版年|页数|装帧|ISBN|定价)\s*[：:]\s*(.+)/);
      if (m && !fields[m[1]]) fields[m[1]] = m[2].trim();
    }

    const authorRaw = fields["作者"] || fields["编者"] || fields["译者"] || null;
    const publisher = fields["出版社"] || null;
    const pubYear = fields["出版年"] || null;
    const pagesRaw = fields["页数"] || null;

    // Parse authors — may be comma/slash separated
    const authors = authorRaw
      ? authorRaw.split(/[,，\/、]/).map((a) => a.trim()).filter(Boolean)
      : [];

    // Parse year — take first 4 digits
    const yearMatch = pubYear?.match(/\d{4}/);
    const publishedYear = yearMatch ? yearMatch[0] : null;

    const pageCount = pagesRaw ? parseInt(pagesRaw) || null : null;

    // Upgrade cover image to large size
    const coverUrl = ogImg
      ? ogImg.replace("/s/public/", "/l/public/").replace("/m/public/", "/l/public/")
      : null;

    return {
      title: ogTitle.trim(),
      authors,
      coverUrl,
      publisher,
      publishedYear,
      genre: null,
      description: ogDesc ? ogDesc.trim() : null,
      pageCount,
      language: "zh",
      source: "Douban Books",
    };
  } catch (error: any) {
    console.error("[Douban] Error:", error?.message);
    return null;
  }
}

// ─── 3. Open Library ─────────────────────────────────────────────────────────
async function lookupOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  try {
    const response = await axios.get(`https://openlibrary.org/api/books`, {
      params: {
        bibkeys: `ISBN:${isbn}`,
        jscmd: "data",
        format: "json",
      },
      timeout: 7000,
    });

    const key = `ISBN:${isbn}`;
    if (!response.data[key]) return null;

    const book = response.data[key];
    return {
      title: book.title || "Unknown Title",
      authors: book.authors?.map((a: any) => a.name) || [],
      coverUrl: book.cover?.large || book.cover?.medium || null,
      publisher: book.publishers?.[0]?.name || null,
      publishedYear: book.publish_date?.match(/\d{4}/)?.[0] || null,
      genre: book.subjects?.[0]?.name || book.subjects?.[0] || null,
      description: book.excerpts?.[0]?.text || null,
      pageCount: book.number_of_pages || null,
      language: null,
      source: "Open Library",
    };
  } catch (error: any) {
    console.error("[Open Library] Error:", error?.message);
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Look up book metadata by ISBN.
 * Lookup chain:
 *   1. Google Books (with optional API key for higher quota)
 *   2. Douban Books (Chinese/HK/TW books via scraping — no key needed)
 *   3. Open Library (international fallback)
 */
export async function lookupBookByISBN(isbn: string): Promise<BookMetadata | null> {
  // 1. Google Books
  const googleResult = await lookupGoogleBooks(isbn);
  if (googleResult) return googleResult;

  // 2. Douban (Chinese books)
  const doubanResult = await lookupDouban(isbn);
  if (doubanResult) return doubanResult;

  // 3. Open Library
  const openLibraryResult = await lookupOpenLibrary(isbn);
  if (openLibraryResult) return openLibraryResult;

  return null;
}
