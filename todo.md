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

## Round 4: PDF E-Book Attachments

- [x] Add book_files table in Supabase (id, book_id, file_name, file_key, file_url, file_size, mime_type, auto_category, created_at)
- [x] DB helpers: createBookFile, listBookFiles, deleteBookFile, getBookFile
- [x] tRPC routes: files.upload, files.list, files.delete, files.get
- [x] PDF upload UI on BookDetail page (file picker, 16MB limit)
- [x] File list on BookDetail: name, size, auto-category badge, download button, delete button
- [x] Auto-categorize PDF by book genre/language (inherit from book metadata)
- [x] E-Books page in sidebar: browse all PDFs, filter by genre/shelf/ISBN, download
- [x] Add E-Books nav item to DashboardLayout sidebar
- [x] Register /app/ebooks route in App.tsx

## Round 5: PDF Viewer, CSV Import, Reading Status, Bulk PDF Upload (Complete)

- [x] In-browser PDF viewer modal on BookDetail page (iframe-based, Preview button)
- [x] In-browser PDF viewer modal on EBooks page (Preview button per file)
- [x] CSV bulk import page (upload CSV, parse, preview, save all books)
- [x] Add reading_status column to books table in Supabase (unread/reading/finished)
- [x] Add current_page and total_pages fields for reading progress
- [x] tRPC route: reading.updateStatus + reading.stats
- [x] Reading status badge on book cards in My Library grid
- [x] Reading progress bar on BookDetail page
- [x] Currently Reading section on Stats page
- [x] Bulk PDF Upload page: drop multiple PDFs, parse filename for title/ISBN, auto-lookup metadata
- [x] Auto-create book record + attach PDF in one step for each uploaded file
- [x] Bulk upload progress UI: per-file status (looking up / saving / done / failed)
- [x] Add CSV Import and Bulk PDF Upload nav items to sidebar

## Round 6: AI PDF Metadata Extraction (Complete)

- [x] Install pdf-parse npm package for server-side PDF text extraction
- [x] tRPC route: files.extractMetadata — accepts base64 PDF, extracts text, uses LLM to parse title/author/ISBN/publisher/year/genre
- [x] tRPC route: files.extractFromUrl — fetch stored PDF by URL, extract text, parse metadata with LLM
- [x] BulkPDFUpload: AI Extract button per file, editable metadata preview dialog before saving
- [x] BookDetail: Sparkles (AI) button on each PDF file → extract info → Apply to Book dialog
- [x] Fallback to filename parsing if PDF text extraction fails
- [x] TypeScript check: 0 errors
- [x] Checkpoint, GitHub push

## Round 7: Guest Access + Request/Chat System

- [x] Create book_requests table in Supabase (id, book_id, requester_id, requester_name, type: borrow|pdf, status: pending|approved|denied, created_at)
- [x] Create request_messages table in Supabase (id, request_id, sender_id, sender_name, message, created_at)
- [x] DB helpers: createRequest, listRequests, updateRequestStatus, createMessage, listMessages
- [x] tRPC routes: requests.create, requests.list, requests.updateStatus, requests.get
- [x] tRPC routes: messages.send, messages.list
- [x] Owner-only guards: hide Add Book / Edit / Delete / Lend buttons for non-owner users
- [x] Guest-facing: "Request to Borrow" and "Request PDF" buttons on book detail page
- [x] Guest request form: type, message, contact info
- [x] Per-request chat thread: guest and owner can exchange messages
- [x] Owner Requests inbox page: list all requests with status badges, open chat thread
- [x] Owner can approve/deny requests from inbox
- [x] Owner notification (notifyOwner) on new request and new message
- [x] Add Requests nav item to sidebar (owner: inbox; guest: my requests)
- [x] Checkpoint, GitHub push
