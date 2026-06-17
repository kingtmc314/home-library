import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle, Trash2, BookOpen
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── ISBN extraction from filename ───────────────────────────────────────────
function extractISBN(filename: string): string | null {
  // Match 13-digit ISBN (978/979 prefix) or 10-digit ISBN
  const match = filename.match(/(?:isbn[-_]?)?(97[89]\d{10}|\d{9}[\dX])/i);
  return match ? match[1] : null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

type UploadStatus = "pending" | "uploading" | "done" | "error" | "skipped";

interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  detectedISBN: string;
  customISBN: string;
  customTitle: string;
  genre: string;
  status: UploadStatus;
  error?: string;
  resultBookTitle?: string;
  resultBookId?: number;
}

const GENRES = [
  "Fiction", "Non-Fiction", "Science", "History", "Biography",
  "Technology", "Business", "Self-Help", "Children", "Comics",
  "Art", "Travel", "Cooking", "Religion", "Philosophy", "Other",
];

export default function BulkPDFUpload() {
  const { user } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkUpload = trpc.files.bulkUpload.useMutation();
  const utils = trpc.useUtils();

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = [];
    for (const file of files) {
      if (!file.type.match(/pdf|epub|mobi|text/) && !file.name.match(/\.(pdf|epub|mobi|txt|docx)$/i)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 16 MB limit`);
        continue;
      }
      const isbn = extractISBN(file.name);
      const titleFromName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        detectedISBN: isbn || "",
        customISBN: isbn || "",
        customTitle: titleFromName,
        genre: "",
        status: "pending",
      });
    }
    if (newItems.length) {
      setItems(prev => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} file${newItems.length > 1 ? "s" : ""}`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUploadAll = async () => {
    const pending = items.filter(it => it.status === "pending");
    if (!pending.length) return;
    setUploading(true);
    let success = 0, failed = 0;

    for (const item of pending) {
      updateItem(item.id, { status: "uploading" });
      try {
        const base64 = await fileToBase64(item.file);
        const result = await bulkUpload.mutateAsync({
          fileName: item.fileName,
          base64,
          mimeType: item.file.type || "application/pdf",
          fileSize: item.file.size,
          isbn: item.customISBN || undefined,
          title: item.customTitle || undefined,
          genre: item.genre || undefined,
        });
        updateItem(item.id, {
          status: "done",
          resultBookTitle: result.bookTitle,
          resultBookId: result.bookId,
        });
        success++;
      } catch (err: any) {
        updateItem(item.id, { status: "error", error: err.message || "Upload failed" });
        failed++;
      }
    }

    await utils.books.list.invalidate();
    await utils.files.list.invalidate({});
    setUploading(false);
    toast.success(`Upload complete: ${success} done${failed ? `, ${failed} failed` : ""}`);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please log in to upload PDFs.</p>
        <Button asChild><a href={getLoginUrl()}>Log In</a></Button>
      </div>
    );
  }

  const pendingCount = items.filter(it => it.status === "pending").length;
  const doneCount = items.filter(it => it.status === "done").length;
  const errorCount = items.filter(it => it.status === "error").length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk PDF Upload</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drop multiple PDF files — the system will auto-detect ISBNs from filenames,
          look up book metadata, create book records, and attach the files automatically.
        </p>
      </div>

      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <Upload className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm font-medium">Drop PDF files here, or click to browse</p>
          <p className="text-xs text-muted-foreground">
            Supports PDF, EPUB, MOBI, TXT, DOCX · Max 16 MB per file
          </p>
          <p className="text-xs text-muted-foreground">
            Tip: Name files like <code className="bg-muted px-1 rounded">9780743273565-gatsby.pdf</code> for auto ISBN detection
          </p>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub,.mobi,.txt,.docx"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
      />

      {/* File list */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{items.length} file{items.length > 1 ? "s" : ""} queued</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {doneCount > 0 && <span className="text-green-600 mr-3">✓ {doneCount} uploaded</span>}
                  {errorCount > 0 && <span className="text-destructive mr-3">✗ {errorCount} failed</span>}
                  {pendingCount > 0 && <span className="text-muted-foreground">{pendingCount} pending</span>}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setItems([])}
                  disabled={uploading}
                >
                  Clear All
                </Button>
                <Button
                  size="sm"
                  onClick={handleUploadAll}
                  disabled={uploading || pendingCount === 0}
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                  ) : (
                    `Upload ${pendingCount} File${pendingCount !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {items.map(item => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 transition-colors ${
                  item.status === "done" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" :
                  item.status === "error" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
                  item.status === "uploading" ? "bg-primary/5 border-primary/30" :
                  "bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.status === "pending" && <FileText className="w-5 h-5 text-muted-foreground" />}
                    {item.status === "uploading" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                    {item.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {item.status === "error" && <XCircle className="w-5 h-5 text-destructive" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Filename + size */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium truncate">{item.fileName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(item.file.size)}</span>
                      {item.detectedISBN && (
                        <Badge variant="outline" className="text-xs shrink-0">ISBN detected</Badge>
                      )}
                    </div>

                    {/* Done state */}
                    {item.status === "done" && item.resultBookTitle && (
                      <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                        <BookOpen className="w-4 h-4" />
                        <span>Created: <strong>{item.resultBookTitle}</strong></span>
                      </div>
                    )}

                    {/* Error state */}
                    {item.status === "error" && (
                      <p className="text-xs text-destructive">{item.error}</p>
                    )}

                    {/* Editable fields for pending items */}
                    {(item.status === "pending" || item.status === "uploading") && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Title (auto-filled)</Label>
                          <Input
                            value={item.customTitle}
                            onChange={e => updateItem(item.id, { customTitle: e.target.value })}
                            className="h-7 text-xs mt-0.5"
                            placeholder="Book title"
                            disabled={item.status === "uploading"}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">ISBN (auto-detected)</Label>
                          <Input
                            value={item.customISBN}
                            onChange={e => updateItem(item.id, { customISBN: e.target.value })}
                            className="h-7 text-xs mt-0.5 font-mono"
                            placeholder="e.g. 9780743273565"
                            disabled={item.status === "uploading"}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Genre</Label>
                          <Select
                            value={item.genre}
                            onValueChange={v => updateItem(item.id, { genre: v })}
                            disabled={item.status === "uploading"}
                          >
                            <SelectTrigger className="h-7 text-xs mt-0.5">
                              <SelectValue placeholder="Select genre" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENRES.map(g => (
                                <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {item.status !== "uploading" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>1. Drop your PDF files — ISBNs are automatically extracted from filenames (e.g. <code className="bg-muted px-1 rounded">9780743273565-title.pdf</code>)</p>
          <p>2. If an ISBN is found, the system looks up book metadata (title, author, cover, publisher) from Google Books and Douban</p>
          <p>3. A new book record is created in your library and the PDF is attached to it</p>
          <p>4. You can edit the title, ISBN, and genre for each file before uploading</p>
          <p>5. Files without an ISBN will use the filename as the book title — you can edit it before uploading</p>
        </CardContent>
      </Card>
    </div>
  );
}
