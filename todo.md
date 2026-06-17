# Home Library Hub — TODO

## Phase 1: Setup
- [x] Create todo.md
- [x] Install html5-qrcode dependency
- [x] Design and apply database schema (books + shelf_locations tables)

## Phase 2: Backend
- [x] books table: title, authors, isbn, coverUrl, publisher, year, genre, description, pageCount, language, purchasePrice, shelfLocationId, dateAdded
- [x] shelf_locations table: id, name, description, createdAt
- [x] tRPC router: books.list, books.get, books.create, books.update, books.delete
- [x] tRPC router: shelves.list, shelves.create, shelves.update, shelves.delete
- [x] tRPC router: stats.overview (total books, total shelves)
- [x] Book lookup helper: Google Books API → Open Library API fallback

## Phase 3: Frontend Layout
- [x] Premium theme: typography, color palette, CSS variables
- [x] DashboardLayout sidebar with 4 sections: Scan & Add, My Library, Shelf Locations, Stats
- [x] App.tsx routing for all pages
- [x] Responsive sidebar (collapsible on mobile)

## Phase 4: Scan & Add Page
- [x] html5-qrcode barcode scanner with start/stop controls and live viewfinder
- [x] On scan success: call Google Books API then Open Library fallback
- [x] Auto-filled book confirmation form with all 10+ metadata fields
- [x] Cover image preview; fallback to custom photo upload
- [x] Shelf location dropdown (populated from DB)
- [x] Purchase price input
- [x] Save to database with success feedback and scanner reset

## Phase 5: My Library Page
- [x] Responsive e-commerce-style book grid
- [x] Book card: cover, title, author, price badge, shelf location tag
- [x] Search bar (title, author, keyword)
- [x] Filter panel (genre, shelf location)
- [x] Book detail page with all metadata
- [x] Edit book form (pre-filled)
- [x] Delete book with confirmation dialog

## Phase 6: Shelf Locations & Stats
- [x] Shelf Locations page: list, create, edit, delete shelves
- [x] Stats page: total book count, total shelf count

## Phase 7: Polish & Tests
- [x] Vitest tests for books and shelves routers
- [x] Loading skeletons and empty states
- [x] Error handling for API failures and scanner errors
- [x] Mobile-responsive layout verification
- [x] GitHub repository initialization (kingtmc314/home-library)
- [x] Vercel deployment (home-library-kingtmc314s-projects.vercel.app)
- [x] Final checkpoint and delivery

## Round 2 Features

- [x] Create loan_records table in Supabase
- [x] tRPC routes: loans.lend, loans.return, loans.list, loans.listActive
- [x] tRPC routes: stats.byGenre, stats.byMonth
- [x] Loans page in sidebar with active/overdue loans list
- [x] Lend Book button on book detail and library grid
- [x] Genre breakdown pie chart on Stats page (Recharts)
- [x] Monthly additions bar chart on Stats page (Recharts)
- [x] Manus S3 cloud storage for book cover uploads (storagePut)
- [x] Server tRPC route for cover upload to Manus S3 storage
- [x] Replace base64 cover upload with cloud storage URL
- [x] Tests for loan tracker routes (27 tests passing)
- [x] Checkpoint, GitHub push, Vercel redeploy

## Round 3 Features

- [x] Add manual book entry (Add Book Manually button — no ISBN needed)
- [x] Improved ISBN lookup error handling (quota/not-found messages + auto-open form)
- [x] Google Books API key support (optional, via GOOGLE_BOOKS_API_KEY env var)
- [x] Douban Books scraping fallback for Chinese/mainland books (no key needed)
- [x] Open Library as 3rd fallback
- [x] Lookup chain: Google Books → Douban → Open Library → Manual entry
