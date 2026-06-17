import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle,
  Trash2, BookOpen, Sparkles, Edit3, FolderOpen,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const MAX_FILE_SIZE = 16 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = "pending" | "extracting" | "ready" | "uploading" | "done" | "error";

interface ExtractedMeta {
  title: string | null;
  authors: string | null;
  isbn: string | null;
  publisher: string | null;
  published_year: string | null;
  genre: string | null;
  language: string | null;
  description: string | null;
}

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  meta: ExtractedMeta;
  resultBookId?: number;
  resultBookTitle?: string;
}

const emptyMeta = (fileName: string): ExtractedMeta => ({
  title: fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim(),
  authors: null, isbn: null, publisher: null,
  published_year: null, genre: null, language: null, description: null,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkPDFUpload() {
  const { user } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExtractedMeta>(emptyMeta(""));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractMetadata = trpc.files.extractMetadata.useMutation();
  const bulkUpload = trpc.files.bulkUpload.useMutation();
  const utils = trpc.useUtils();

  // ── File handling ────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: File[]) => {
    const valid: UploadItem[] = [];
    for (const file of files) {
      if (!file.name.match(/\.(pdf)$/i) && file.type !== "application/pdf") {
        toast.error(`${file.name}: only PDF files are supported`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 16 MB limit`);
        continue;
      }
      valid.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        meta: emptyMeta(file.name),
      });
    }
    if (valid.length) {
      setItems(prev => [...prev, ...valid]);
      toast.success(`Added ${valid.length} file${valid.length > 1 ? "s" : ""}`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(it => it.id !== id));

  // ── AI Extraction ────────────────────────────────────────────────────────────

  const extractOne = async (item: UploadItem) => {
    updateItem(item.id, { status: "extracting", error: undefined });
    try {
      const base64 = await fileToBase64(item.file);
      const result = await extractMetadata.mutateAsync({
        base64,
        fileName: item.file.name,
      });
      updateItem(item.id, {
        status: "ready",
        meta: {
          title: result.title || item.meta.title,
          authors: result.authors || null,
          isbn: result.isbn || null,
          publisher: result.publisher || null,
          published_year: result.published_year || null,
          genre: result.genre || null,
          language: result.language || null,
          description: result.description || null,
        },
      });
      toast.success(`AI extracted info for: ${result.title || item.file.name}`);
    } catch (err: any) {
      updateItem(item.id, { status: "error", error: err.message || "Extraction failed" });
      toast.error(`Extraction failed: ${item.file.name}`);
    }
  };

  const extractAll = async () => {
    const targets = items.filter(it => it.status === "pending" || it.status === "error");
    if (!targets.length) { toast.info("All files already processed."); return; }
    for (const item of targets) await extractOne(item);
  };

  // ── Upload ───────────────────────────────────────────────────────────────────

  const uploadOne = async (item: UploadItem) => {
    updateItem(item.id, { status: "uploading", error: undefined });
    try {
      const base64 = await fileToBase64(item.file);
      const result = await bulkUpload.mutateAsync({
        fileName: item.file.name,
        base64,
        mimeType: "application/pdf",
        fileSize: item.file.size,
        isbn: item.meta.isbn || undefined,
        title: item.meta.title || item.file.name.replace(/\.pdf$/i, ""),
        authors: item.meta.authors || undefined,
        genre: item.meta.genre || undefined,
      });
      updateItem(item.id, {
        status: "done",
        resultBookId: result.bookId,
        resultBookTitle: result.bookTitle,
      });
    } catch (err: any) {
      updateItem(item.id, { status: "error", error: err.message || "Upload failed" });
    }
  };

  const uploadAll = async () => {
    const targets = items.filter(it => it.status === "ready" || it.status === "pending");
    if (!targets.length) { toast.info("No files ready to save."); return; }
    for (const item of targets) await uploadOne(item);
    await utils.books.list.invalidate();
    toast.success(`Saved ${targets.length} book(s) to your library!`);
  };

  // ── Edit dialog ──────────────────────────────────────────────────────────────

  const openEdit = (item: UploadItem) => {
    setEditForm({ ...item.meta });
    setEditingId(item.id);
  };

  const saveEdit = () => {
    setItems(prev => prev.map(it =>
      it.id === editingId
        ? { ...it, meta: { ...editForm }, status: it.status === "pending" ? "ready" : it.status }
        : it
    ));
    setEditingId(null);
  };

  // ── Status helpers ───────────────────────────────────────────────────────────

  const statusBadge = (status: ItemStatus, error?: string) => {
    switch (status) {
      case "pending":    return <Badge variant="secondary">Pending</Badge>;
      case "extracting": return <Badge className="bg-blue-500 text-white animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin inline" />Reading PDF…</Badge>;
      case "ready":      return <Badge className="bg-emerald-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1 inline" />Ready</Badge>;
      case "uploading":  return <Badge className="bg-amber-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin inline" />Saving…</Badge>;
      case "done":       return <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1 inline" />Saved</Badge>;
      case "error":      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1 inline" />Error</Badge>;
    }
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
  const readyCount = items.filter(it => it.status === "ready").length;
  const doneCount = items.filter(it => it.status === "done").length;
  const errorCount = items.filter(it => it.status === "error").length;
  const canExtract = items.some(it => it.status === "pending" || it.status === "error");
  const canUpload = items.some(it => it.status === "ready" || it.status === "pending");

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Bulk PDF Upload
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drop multiple PDFs — AI reads <strong>inside each file</strong> to extract title, author, ISBN,
          publisher, genre, and language automatically. No need to rename files.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60"
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">Drop PDF files here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">PDF only · Max 16 MB per file</p>
      </div>

      {/* Action bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-3 text-sm">
            <span className="text-muted-foreground">{items.length} file(s)</span>
            {readyCount > 0 && <span className="text-emerald-600 font-medium">{readyCount} ready</span>}
            {doneCount > 0 && <span className="text-green-600 font-medium">{doneCount} saved</span>}
            {errorCount > 0 && <span className="text-destructive font-medium">{errorCount} errors</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setItems([])}>Clear All</Button>
            <Button variant="outline" onClick={extractAll} disabled={!canExtract}>
              <Sparkles className="w-4 h-4 mr-2" />
              Extract All with AI
            </Button>
            <Button onClick={uploadAll} disabled={!canUpload}>
              <Upload className="w-4 h-4 mr-2" />
              Save All to Library
            </Button>
          </div>
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className={`overflow-hidden transition-colors ${
              item.status === "done" ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" :
              item.status === "error" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" :
              item.status === "ready" ? "border-emerald-300 dark:border-emerald-800" : ""
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <FileText className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0">
                    {/* File name + size + status */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium truncate max-w-xs text-sm">{item.file.name}</span>
                      <span className="text-xs text-muted-foreground">{formatSize(item.file.size)}</span>
                      {statusBadge(item.status, item.error)}
                    </div>

                    {/* Extracted metadata */}
                    {(item.status === "ready" || item.status === "done" || item.status === "uploading") && (
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                        {item.meta.title && <div><span className="text-muted-foreground">Title: </span><span className="font-medium">{item.meta.title}</span></div>}
                        {item.meta.authors && <div><span className="text-muted-foreground">Author(s): </span>{item.meta.authors}</div>}
                        {item.meta.isbn && <div><span className="text-muted-foreground">ISBN: </span><code className="text-xs">{item.meta.isbn}</code></div>}
                        {item.meta.publisher && <div><span className="text-muted-foreground">Publisher: </span>{item.meta.publisher}</div>}
                        {item.meta.published_year && <div><span className="text-muted-foreground">Year: </span>{item.meta.published_year}</div>}
                        {item.meta.genre && <div><span className="text-muted-foreground">Genre: </span>{item.meta.genre}</div>}
                        {item.meta.language && <div><span className="text-muted-foreground">Language: </span>{item.meta.language}</div>}
                      </div>
                    )}

                    {/* Done result */}
                    {item.status === "done" && item.resultBookTitle && (
                      <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 mt-1">
                        <BookOpen className="w-4 h-4" />
                        <span>Saved as: <strong>{item.resultBookTitle}</strong></span>
                      </div>
                    )}

                    {/* Error */}
                    {item.status === "error" && item.error && (
                      <p className="text-xs text-destructive mt-1">{item.error}</p>
                    )}
                  </div>

                  {/* Per-file actions */}
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {(item.status === "pending" || item.status === "error") && (
                      <Button size="sm" variant="outline" onClick={() => extractOne(item)}>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />AI Extract
                      </Button>
                    )}
                    {(item.status === "ready" || item.status === "pending") && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                        <Edit3 className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                    )}
                    {item.status === "ready" && (
                      <Button size="sm" onClick={() => uploadOne(item)}>
                        <Upload className="w-3.5 h-3.5 mr-1" />Save
                      </Button>
                    )}
                    {item.status === "done" && item.resultBookId && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/app/books/${item.resultBookId}`}>
                          <FolderOpen className="w-3.5 h-3.5 mr-1" />View
                        </a>
                      </Button>
                    )}
                    {item.status !== "uploading" && item.status !== "extracting" && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files added yet</p>
          <p className="text-sm mt-1">Drop PDFs above — AI will read inside each file to extract book info</p>
        </div>
      )}

      {/* How it works */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How AI extraction works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>1. Click <strong>Extract All with AI</strong> — the system reads the first few pages of each PDF to find the title, author, ISBN, publisher, and genre.</p>
          <p>2. Review the extracted info. Click <strong>Edit</strong> on any file to correct or fill in missing fields.</p>
          <p>3. Click <strong>Save All to Library</strong> — each PDF is uploaded to cloud storage and a new book record is created automatically.</p>
          <p className="text-amber-600 dark:text-amber-400">Note: Scanned or image-only PDFs may not yield text — you can still edit the metadata manually before saving.</p>
        </CardContent>
      </Card>

      {/* Edit metadata dialog */}
      <Dialog open={!!editingId} onOpenChange={open => !open && setEditingId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Book Metadata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(["title", "authors", "isbn", "publisher", "published_year", "genre", "language"] as const).map(field => (
              <div key={field} className="grid grid-cols-3 items-center gap-2">
                <Label className="capitalize text-right text-sm">{field.replace("_", " ")}</Label>
                <Input
                  className="col-span-2"
                  value={editForm[field] || ""}
                  onChange={e => setEditForm(prev => ({ ...prev, [field]: e.target.value || null }))}
                  placeholder={`Enter ${field.replace("_", " ")}`}
                />
              </div>
            ))}
            <div className="grid grid-cols-3 items-start gap-2">
              <Label className="text-right mt-2 text-sm">Description</Label>
              <Textarea
                className="col-span-2"
                rows={3}
                value={editForm.description || ""}
                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value || null }))}
                placeholder="Book description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
