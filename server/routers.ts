import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { lookupBookByISBN } from "./bookLookup";
import { supabaseAdmin } from "./supabase";
import { storagePut } from "./storage";

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
  }),
});

export type AppRouter = typeof appRouter;
