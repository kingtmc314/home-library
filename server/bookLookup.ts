import axios from "axios";

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
}

/**
 * Lookup book metadata from Google Books API
 */
async function lookupGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  try {
    const response = await axios.get("https://www.googleapis.com/books/v1/volumes", {
      params: {
        q: `isbn:${isbn}`,
        maxResults: 1,
      },
      timeout: 5000,
    });

    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }

    const book = response.data.items[0];
    const volumeInfo = book.volumeInfo || {};

    return {
      title: volumeInfo.title || "Unknown Title",
      authors: volumeInfo.authors || [],
      coverUrl: volumeInfo.imageLinks?.thumbnail || null,
      publisher: volumeInfo.publisher || null,
      publishedYear: volumeInfo.publishedDate?.substring(0, 4) || null,
      genre: volumeInfo.categories?.[0] || null,
      description: volumeInfo.description || null,
      pageCount: volumeInfo.pageCount || null,
      language: volumeInfo.language || null,
    };
  } catch (error) {
    console.error("[Google Books API] Error:", error);
    return null;
  }
}

/**
 * Lookup book metadata from Open Library API (fallback)
 */
async function lookupOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  try {
    const response = await axios.get(`https://openlibrary.org/api/books`, {
      params: {
        bibkeys: `ISBN:${isbn}`,
        jscmd: "data",
        format: "json",
      },
      timeout: 5000,
    });

    const key = `ISBN:${isbn}`;
    if (!response.data[key]) {
      return null;
    }

    const book = response.data[key];

    return {
      title: book.title || "Unknown Title",
      authors: book.authors?.map((a: any) => a.name) || [],
      coverUrl: book.cover?.medium || null,
      publisher: book.publishers?.[0]?.name || null,
      publishedYear: book.publish_date?.substring(0, 4) || null,
      genre: book.subjects?.[0] || null,
      description: null,
      pageCount: book.number_of_pages || null,
      language: null,
    };
  } catch (error) {
    console.error("[Open Library API] Error:", error);
    return null;
  }
}

/**
 * Lookup book metadata by ISBN, trying Google Books first, then Open Library
 */
export async function lookupBookByISBN(isbn: string): Promise<BookMetadata | null> {
  // Try Google Books first
  const googleResult = await lookupGoogleBooks(isbn);
  if (googleResult) {
    return googleResult;
  }

  // Fallback to Open Library
  const openLibraryResult = await lookupOpenLibrary(isbn);
  if (openLibraryResult) {
    return openLibraryResult;
  }

  return null;
}
