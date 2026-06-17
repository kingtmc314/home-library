import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { lookupBookByISBN } from "./bookLookup";
import { supabaseAdmin } from "./supabase";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /**
   * ============ BOOKS ============
   */
  books: router({
    list: publicProcedure.query(async () => {
      return await db.getAllBooks();
    }),

    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getBookById(input.id);
    }),

    search: publicProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
      if (!input.query.trim()) return await db.getAllBooks();
      return await db.searchBooks(input.query);
    }),

    filter: publicProcedure
      .input(z.object({
        genre: z.string().optional(),
        shelfLocationId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.filterBooks({ genre: input.genre, shelfLocationId: input.shelfLocationId });
      }),

    lookup: publicProcedure
      .input(z.object({ isbn: z.string() }))
      .query(async ({ input }) => {
        return await lookupBookByISBN(input.isbn);
      }),

    create: protectedProcedure
      .input(z.object({
        isbn: z.string().optional(),
        title: z.string().min(1),
        authors: z.string().optional(),
        cover_url: z.string().optional(),
        publisher: z.string().optional(),
        published_year: z.string().optional(),
        genre: z.string().optional(),
        description: z.string().optional(),
        page_count: z.number().optional(),
        language: z.string().optional(),
        purchase_price: z.number().optional(),
        shelf_location_id: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createBook(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        isbn: z.string().optional(),
        title: z.string().optional(),
        authors: z.string().optional(),
        cover_url: z.string().optional(),
        publisher: z.string().optional(),
        published_year: z.string().optional(),
        genre: z.string().optional(),
        description: z.string().optional(),
        page_count: z.number().optional(),
        language: z.string().optional(),
        purchase_price: z.number().optional(),
        shelf_location_id: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return await db.updateBook(id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteBook(input.id);
      }),

    /** Upload a cover image (base64) to Manus S3 storage and return the URL */
    uploadCover: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
        bookId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key };
      }),

    /** Bulk import books from CSV rows */
    csvImport: protectedProcedure
      .input(z.array(z.object({
        title: z.string().min(1),
        authors: z.string().optional(),
        isbn: z.string().optional(),
        publisher: z.string().optional(),
        published_year: z.number().optional(),
        genre: z.string().optional(),
        language: z.string().optional(),
        page_count: z.number().optional(),
        purchase_price: z.number().optional(),
        shelf_location_id: z.number().optional(),
        description: z.string().optional(),
        cover_url: z.string().optional(),
      })))
      .mutation(async ({ input }) => {
        const results: { success: boolean; title: string; error?: string }[] = [];
        for (const row of input) {
          try {
            await db.createBook({
              ...row,
              published_year: row.published_year !== undefined ? String(row.published_year) : undefined,
            });
            results.push({ success: true, title: row.title });
          } catch (err: any) {
            results.push({ success: false, title: row.title, error: err.message });
          }
        }
        return results;
      }),
  }),

  /**
   * ============ SHELF LOCATIONS ============
   */
  shelves: router({
    list: publicProcedure.query(async () => {
      return await db.getAllShelfLocations();
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        return await db.createShelfLocation(input.name, input.description);
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        return await db.updateShelfLocation(input.id, input.name, input.description);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteShelfLocation(input.id);
      }),
  }),

  /**
   * ============ STATS ============
   */
  stats: router({
    overview: publicProcedure.query(async () => {
      return await db.getBookStats();
    }),

    byGenre: publicProcedure.query(async () => {
      return await db.getBooksByGenre();
    }),

    byMonth: publicProcedure.query(async () => {
      return await db.getBooksByMonth();
    }),
  }),

  /**
   * ============ LOAN TRACKER ============
   */
  loans: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        return await db.listLoans(input.activeOnly ?? false);
      }),

    lend: protectedProcedure
      .input(z.object({
        book_id: z.number(),
        borrower_name: z.string().min(1),
        borrower_contact: z.string().optional(),
        lent_date: z.string().optional(),
        due_date: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLoan(input);
      }),

    return: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.returnLoan(input.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteLoan(input.id);
      }),
  }),

  /**
   * ============ READING STATUS ============
   */
  reading: router({
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['unread', 'reading', 'finished']),
        currentPage: z.number().optional(),
        totalPages: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateReadingStatus(
          input.id,
          input.status,
          input.currentPage,
          input.totalPages
        );
      }),

    stats: publicProcedure.query(async () => {
      return await db.getReadingStats();
    }),
  }),

  /**
   * ============ BOOK FILES (PDF / E-BOOKS) ============
   */
  files: router({
    /** List all files, optionally filtered by bookId */
    list: publicProcedure
      .input(z.object({ bookId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.listBookFiles(input.bookId);
      }),

    /** Upload a PDF/file to Manus S3 storage and record it in book_files */
    upload: protectedProcedure
      .input(z.object({
        bookId: z.number(),
        fileName: z.string().min(1),
        base64: z.string(),
        mimeType: z.string().default("application/pdf"),
        fileSize: z.number().default(0),
        autoCategory: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `ebooks/${input.bookId}/${Date.now()}-${safeName}`;
        const { url, key: storedKey } = await storagePut(key, buffer, input.mimeType);

        const record = await db.createBookFile({
          book_id: input.bookId,
          file_name: input.fileName,
          file_key: storedKey,
          file_url: url,
          file_size: input.fileSize,
          mime_type: input.mimeType,
          auto_category: input.autoCategory,
        });
        return record;
      }),

    /** Delete a file record */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteBookFile(input.id);
      }),

    /** Get a single file record (for download URL) */
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getBookFile(input.id);
      }),

    /**
     * Bulk PDF upload: upload a PDF, optionally auto-create a book record from filename/ISBN.
     * If bookId is provided, attach to existing book.
     * If isbn/title provided, look up metadata and create a new book, then attach.
     */
    /**
     * Extract book metadata from inside a PDF using text extraction + LLM.
     * Accepts base64-encoded PDF, returns structured metadata.
     */
    extractMetadata: protectedProcedure
      .input(z.object({
        base64: z.string(),
        fileName: z.string().default(''),
      }))
      .mutation(async ({ input }) => {
        try {
          const pdfParseModule = await import('pdf-parse');
          const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
          const base64Data = input.base64.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          // Extract text from first ~3 pages (enough for title page + copyright)
          let pdfText = '';
          try {
            const parsed = await pdfParse(buffer, { max: 3 });
            pdfText = parsed.text?.slice(0, 4000) || '';
          } catch {
            pdfText = '';
          }

          // Use LLM to parse metadata from the extracted text + filename
          const prompt = [
            'You are a librarian assistant. Extract book metadata from the following PDF text (first few pages) and filename.',
            'Return ONLY a JSON object with these fields (use null for unknown):',
            '{ "title": string|null, "authors": string|null, "isbn": string|null, "publisher": string|null, "published_year": string|null, "genre": string|null, "language": string|null, "description": string|null }',
            '',
            `Filename: ${input.fileName}`,
            '',
            'PDF text (first pages):',
            pdfText || '(no text extracted — scanned PDF or encrypted)',
          ].join('\n');

          const llmResponse = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a precise book metadata extractor. Return only valid JSON, no markdown.' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'book_metadata',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: ['string', 'null'] },
                    authors: { type: ['string', 'null'] },
                    isbn: { type: ['string', 'null'] },
                    publisher: { type: ['string', 'null'] },
                    published_year: { type: ['string', 'null'] },
                    genre: { type: ['string', 'null'] },
                    language: { type: ['string', 'null'] },
                    description: { type: ['string', 'null'] },
                  },
                  required: ['title', 'authors', 'isbn', 'publisher', 'published_year', 'genre', 'language', 'description'],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = llmResponse?.choices?.[0]?.message?.content || '{}';
          let metadata: Record<string, string | null> = {};
          try {
            metadata = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
          } catch {
            metadata = {};
          }

          // If ISBN found, try to enrich with Google Books / Douban
          if (metadata.isbn) {
            try {
              const { lookupBookByISBN } = await import('./bookLookup');
              const enriched = await lookupBookByISBN(metadata.isbn);
              if (enriched) {
                metadata.title = metadata.title || enriched.title || null;
                metadata.authors = metadata.authors || (enriched.authors?.join(', ') ?? null);
                metadata.publisher = metadata.publisher || enriched.publisher || null;
                metadata.published_year = metadata.published_year || enriched.publishedYear || null;
                metadata.genre = metadata.genre || enriched.genre || null;
                metadata.language = metadata.language || enriched.language || null;
                metadata.description = metadata.description || enriched.description || null;
              }
            } catch { /* ignore enrichment errors */ }
          }

          return {
            title: metadata.title || input.fileName.replace(/\.[^.]+$/, '') || null,
            authors: metadata.authors || null,
            isbn: metadata.isbn || null,
            publisher: metadata.publisher || null,
            published_year: metadata.published_year || null,
            genre: metadata.genre || null,
            language: metadata.language || null,
            description: metadata.description || null,
          };
        } catch (err: any) {
          // Fallback: return just the filename as title
          return {
            title: input.fileName.replace(/\.[^.]+$/, '') || null,
            authors: null, isbn: null, publisher: null,
            published_year: null, genre: null, language: null, description: null,
          };
        }
      }),

    /**
     * Extract book metadata from an already-stored PDF by its storage URL.
     * Downloads the PDF, extracts text, uses LLM to parse metadata.
     */
    extractFromUrl: protectedProcedure
      .input(z.object({
        fileUrl: z.string(),
        fileName: z.string().default(''),
        bookId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const pdfParseModule = await import('pdf-parse');
          const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;

          // Fetch the PDF from storage
          let buffer: Buffer;
          try {
            const { ENV } = await import('./_core/env');
            // Build absolute URL for internal storage proxy
            const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
            const fetchUrl = input.fileUrl.startsWith('http') ? input.fileUrl : `${baseUrl}${input.fileUrl}`;
            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuf = await res.arrayBuffer();
            buffer = Buffer.from(arrayBuf);
          } catch (fetchErr: any) {
            throw new Error(`Could not fetch PDF: ${fetchErr.message}`);
          }

          // Extract text from first 3 pages
          let pdfText = '';
          try {
            const parsed = await pdfParse(buffer, { max: 3 });
            pdfText = parsed.text?.slice(0, 4000) || '';
          } catch {
            pdfText = '';
          }

          // Use LLM to extract metadata
          const prompt = [
            'You are a librarian assistant. Extract book metadata from the following PDF text (first few pages) and filename.',
            'Return ONLY a JSON object with these fields (use null for unknown):',
            '{ "title": string|null, "authors": string|null, "isbn": string|null, "publisher": string|null, "published_year": string|null, "genre": string|null, "language": string|null, "description": string|null }',
            '',
            `Filename: ${input.fileName}`,
            '',
            'PDF text (first pages):',
            pdfText || '(no text extracted — scanned PDF or encrypted)',
          ].join('\n');

          const llmResponse = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a precise book metadata extractor. Return only valid JSON, no markdown.' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'book_metadata',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: ['string', 'null'] },
                    authors: { type: ['string', 'null'] },
                    isbn: { type: ['string', 'null'] },
                    publisher: { type: ['string', 'null'] },
                    published_year: { type: ['string', 'null'] },
                    genre: { type: ['string', 'null'] },
                    language: { type: ['string', 'null'] },
                    description: { type: ['string', 'null'] },
                  },
                  required: ['title', 'authors', 'isbn', 'publisher', 'published_year', 'genre', 'language', 'description'],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = llmResponse?.choices?.[0]?.message?.content || '{}';
          let metadata: Record<string, string | null> = {};
          try {
            metadata = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
          } catch {
            metadata = {};
          }

          // Enrich via ISBN lookup if ISBN found
          if (metadata.isbn) {
            try {
              const enriched = await lookupBookByISBN(metadata.isbn);
              if (enriched) {
                metadata.title = metadata.title || enriched.title || null;
                metadata.authors = metadata.authors || (enriched.authors?.join(', ') ?? null);
                metadata.publisher = metadata.publisher || enriched.publisher || null;
                metadata.published_year = metadata.published_year || enriched.publishedYear || null;
                metadata.genre = metadata.genre || enriched.genre || null;
                metadata.language = metadata.language || enriched.language || null;
                metadata.description = metadata.description || enriched.description || null;
              }
            } catch { /* ignore */ }
          }

          return {
            title: metadata.title || input.fileName.replace(/\.[^.]+$/, '') || null,
            authors: metadata.authors || null,
            isbn: metadata.isbn || null,
            publisher: metadata.publisher || null,
            published_year: metadata.published_year || null,
            genre: metadata.genre || null,
            language: metadata.language || null,
            description: metadata.description || null,
          };
        } catch (err: any) {
          return {
            title: input.fileName.replace(/\.[^.]+$/, '') || null,
            authors: null, isbn: null, publisher: null,
            published_year: null, genre: null, language: null, description: null,
            error: err.message,
          };
        }
      }),

    bulkUpload: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1),
        base64: z.string(),
        mimeType: z.string().default('application/pdf'),
        fileSize: z.number().default(0),
        bookId: z.number().optional(),
        isbn: z.string().optional(),
        title: z.string().optional(),
        authors: z.string().optional(),
        genre: z.string().optional(),
        shelfLocationId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // 1. Determine or create the book record
        let bookId = input.bookId;
        let bookTitle = input.title || input.fileName.replace(/\.[^.]+$/, '');

        if (!bookId) {
          // Try to look up metadata if ISBN provided
          let metadata: any = null;
          if (input.isbn) {
            try {
              const { lookupBookByISBN } = await import('./bookLookup');
              metadata = await lookupBookByISBN(input.isbn);
            } catch { /* ignore lookup errors */ }
          }

          const bookData: Parameters<typeof db.createBook>[0] = {
            isbn: input.isbn || metadata?.isbn || undefined,
            title: metadata?.title || bookTitle,
            authors: metadata?.authors?.join(', ') || input.authors || undefined,
            cover_url: metadata?.coverUrl || undefined,
            publisher: metadata?.publisher || undefined,
            published_year: metadata?.publishedYear || undefined,
            genre: input.genre || metadata?.genre || undefined,
            description: metadata?.description || undefined,
            page_count: metadata?.pageCount || undefined,
            language: metadata?.language || undefined,
            shelf_location_id: input.shelfLocationId || undefined,
          };

          const newBook = await db.createBook(bookData);
          if (!newBook) throw new Error('Failed to create book record');
          bookId = newBook.id;
          bookTitle = newBook.title;
        }

        // 2. Upload file to storage
        const base64Data = input.base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `ebooks/${bookId}/${Date.now()}-${safeName}`;
        const { url, key: storedKey } = await storagePut(key, buffer, input.mimeType);

        // 3. Get book genre for auto-category
        const book = await db.getBookById(bookId);
        const autoCategory = book?.genre || input.genre || null;

        // 4. Create file record
        const record = await db.createBookFile({
          book_id: bookId,
          file_name: input.fileName,
          file_key: storedKey,
          file_url: url,
          file_size: input.fileSize,
          mime_type: input.mimeType,
          auto_category: autoCategory || undefined,
        });

        return { file: record, bookId, bookTitle };
      }),
  }),
});

export type AppRouter = typeof appRouter;
