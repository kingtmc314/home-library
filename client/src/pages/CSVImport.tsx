import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Download, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── CSV parsing ─────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || "").trim().replace(/^"|"$/g, "");
    });
    return row;
  });
}

// ─── Column aliases ───────────────────────────────────────────────────────────
function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k]) return row[k];
  }
  return "";
}

type ImportStatus = "pending" | "importing" | "done" | "error";
interface ImportRow {
  id: string;
  title: string;
  authors: string;
  isbn: string;
  genre: string;
  publisher: string;
  year: string;
  price: string;
  shelf: string;
  language: string;
  status: ImportStatus;
  error?: string;
}

const SAMPLE_CSV = `title,authors,isbn,genre,publisher,year,price,shelf,language
"The Great Gatsby","F. Scott Fitzgerald","9780743273565","Fiction","Scribner","1925","12.99","Living Room","English"
"1984","George Orwell","9780451524935","Fiction","Signet Classic","1949","9.99","Bedroom","English"
"Sapiens","Yuval Noah Harari","9780062316097","Non-Fiction","Harper","2011","15.99","Study","English"`;

export default function CSVImport() {
  const { user } = useAuth();
  const isOwner = (user as any)?.isOwner === true;
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createBook = trpc.books.create.useMutation();
  const utils = trpc.useUtils();

  const processCSVText = useCallback((text: string) => {
    const parsed = parseCSV(text);
    if (!parsed.length) {
      toast.error("No rows found. Check your CSV format.");
      return;
    }
    const importRows: ImportRow[] = parsed
      .filter(r => getField(r, "title"))
      .map((r, i) => ({
        id: `row-${i}`,
        title: getField(r, "title"),
        authors: getField(r, "authors", "author"),
        isbn: getField(r, "isbn"),
        genre: getField(r, "genre", "category"),
        publisher: getField(r, "publisher"),
        year: getField(r, "year", "published_year", "publishedyear"),
        price: getField(r, "price", "purchase_price"),
        shelf: getField(r, "shelf", "shelf_location", "location"),
        language: getField(r, "language", "lang"),
        status: "pending",
      }));
    setRows(importRows);
    toast.success(`Loaded ${importRows.length} books from CSV`);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error("Please upload a .csv or .txt file");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => processCSVText(e.target?.result as string);
    reader.readAsText(file);
  }, [processCSVText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImportAll = async () => {
    if (!rows.length) return;
    setImporting(true);
    let success = 0, failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "done") continue;

      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "importing" } : r));

      try {
        const price = parseFloat(row.price);
        await createBook.mutateAsync({
          title: row.title,
          authors: row.authors || undefined,
          isbn: row.isbn || undefined,
          genre: row.genre || undefined,
          publisher: row.publisher || undefined,
          published_year: row.year || undefined,
          purchase_price: isNaN(price) ? undefined : price,
          language: row.language || undefined,
        });
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done" } : r));
        success++;
      } catch (err: any) {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err.message } : r));
        failed++;
      }
    }

    await utils.books.list.invalidate();
    setImporting(false);
    toast.success(`Import complete: ${success} added${failed ? `, ${failed} failed` : ""}`);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-books.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please log in to import books.</p>
        <Button asChild><a href={getLoginUrl()}>Log In</a></Button>
      </div>
    );
  }

  const pending = rows.filter(r => r.status === "pending").length;
  const done = rows.filter(r => r.status === "done").length;
  const errors = rows.filter(r => r.status === "error").length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {!isOwner && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <FileText className="h-12 w-12 text-muted-foreground opacity-30 mb-3" />
          <p className="text-muted-foreground">CSV import is only available to the library owner.</p>
        </div>
      )}
      {isOwner && <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CSV Bulk Import</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import multiple books at once from a spreadsheet or CSV file.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample}>
          <Download className="w-4 h-4 mr-2" />
          Sample CSV
        </Button>
      </div>

      {/* Drop zone */}
      {!rows.length && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm font-medium">Drop your CSV file here, or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supported columns: title, authors, isbn, genre, publisher, year, price, shelf, language
            </p>
          </CardContent>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* Preview table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Preview — {rows.length} books</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {done > 0 && <span className="text-green-600 mr-3">✓ {done} imported</span>}
                  {errors > 0 && <span className="text-destructive mr-3">✗ {errors} failed</span>}
                  {pending > 0 && <span className="text-muted-foreground">{pending} pending</span>}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRows([]); }}
                  disabled={importing}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportAll}
                  disabled={importing || pending === 0}
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
                  ) : (
                    `Import ${pending} Books`
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Author</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">ISBN</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Genre</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium max-w-[200px] truncate">{row.title}</td>
                      <td className="px-4 py-2 text-muted-foreground max-w-[150px] truncate">{row.authors || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{row.isbn || "—"}</td>
                      <td className="px-4 py-2">
                        {row.genre ? <Badge variant="secondary" className="text-xs">{row.genre}</Badge> : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {row.price ? `$${parseFloat(row.price).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.status === "pending" && <span className="text-muted-foreground text-xs">Pending</span>}
                        {row.status === "importing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        {row.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {row.status === "error" && (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-destructive truncate max-w-[80px]" title={row.error}>
                              {row.error || "Error"}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format guide */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            CSV Format Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>The first row must be a header row. Supported column names (case-insensitive):</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mt-2 font-mono">
            <span><strong>title</strong> — Book title (required)</span>
            <span><strong>authors</strong> or <strong>author</strong></span>
            <span><strong>isbn</strong> — ISBN-10 or ISBN-13</span>
            <span><strong>genre</strong> or <strong>category</strong></span>
            <span><strong>publisher</strong></span>
            <span><strong>year</strong> or <strong>published_year</strong></span>
            <span><strong>price</strong> or <strong>purchase_price</strong></span>
            <span><strong>shelf</strong> or <strong>shelf_location</strong></span>
            <span><strong>language</strong> or <strong>lang</strong></span>
          </div>
          <p className="mt-2">Wrap values containing commas in double quotes. Download the sample CSV above for a template.</p>
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
