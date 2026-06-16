import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { lookupBookByISBN } from "./bookLookup";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
      if (!input.query.trim()) {
        return await db.getAllBooks();
      }
      return await db.searchBooks(input.query);
    }),

    filter: publicProcedure
      .input(
        z.object({
          genre: z.string().optional(),
          shelfLocationId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await db.filterBooks({
          genre: input.genre,
          shelfLocationId: input.shelfLocationId,
        });
      }),

    lookup: publicProcedure
      .input(z.object({ isbn: z.string() }))
      .query(async ({ input }) => {
        return await lookupBookByISBN(input.isbn);
      }),

    create: protectedProcedure
      .input(
        z.object({
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
        })
      )
      .mutation(async ({ input }) => {
        return await db.createBook(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
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
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return await db.updateBook(id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteBook(input.id);
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
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createShelfLocation(input.name, input.description);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1),
          description: z.string().optional(),
        })
      )
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
  }),
});

export type AppRouter = typeof appRouter;
