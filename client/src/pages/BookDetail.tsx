import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Download, Trash2, BookOpen, Eye, BookOpenCheck, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PDFViewerModal } from "@/components/PDFViewerModal";
import { Progress } from "@/components/ui/progress";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function deriveCategory(book: { genre?: string | null; language?: string | null }): string {
  if (book.genre) return book.genre;
  if (book.language === "zh" || book.language === "zh-TW" || book.language === "zh-CN") return "Chinese";
  return "General";
}

export default function BookDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams();
  const bookId = parseInt(id || "0");

  const book = trpc.books.get.useQuery({ id: bookId });
  const shelves = trpc.shelves.list.useQuery();
  const files = trpc.files.list.useQuery({ bookId });
  const utils = trpc.useUtils();

  const updateBook = trpc.books.update.useMutation({
    onSuccess: () => {
      book.refetch();
      toast.success("Book updated successfully!");
    },
  });
  const uploadCover = trpc.books.uploadCover.useMutation();
  const uploadFile = trpc.files.upload.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({ bookId });
      toast.success("File uploaded successfully!");
    },
    onError: (err) => {
      toast.error("Upload failed: " + err.message);
    },
  });
  const deleteFile = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({ bookId });
      toast.success("File removed");
    },
  });

  const [viewerFile, setViewerFile] = React.useState<{ url: string; name: string } | null>(null);

  const updateReadingStatus = trpc.reading.updateStatus.useMutation({
    onSuccess: () => {
      book.refetch();
      toast.success("Reading status updated");
    },
  });
  const [readingPage, setReadingPage] = useState<string>("");

  const [formData, setFormData] = useState<any>({});
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // AI extract state
  const extractFromUrl = trpc.files.extractFromUrl.useMutation();
  const [extractingFileId, setExtractingFileId] = useState<number | null>(null);
  const [extractResult, setExtractResult] = useState<Record<string, string | null> | null>(null);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);

  const handleExtractFromPDF = async (file: { id: number; file_url: string; file_name: string }) => {
    setExtractingFileId(file.id);
    try {
      const result = await extractFromUrl.mutateAsync({
        fileUrl: file.file_url,
        fileName: file.file_name,
        bookId: bookId,
      });
      setExtractResult(result as Record<string, string | null>);
      setExtractDialogOpen(true);
    } catch (err: any) {
      toast.error(`AI extraction failed: ${err.message}`);
    } finally {
      setExtractingFileId(null);
    }
  };

  const applyExtractedMetadata = () => {
    if (!extractResult) return;
    setFormData((prev: any) => ({
      ...prev,
      ...(extractResult.title && { title: extractResult.title }),
      ...(extractResult.authors && { authors: extractResult.authors }),
      ...(extractResult.isbn && { isbn: extractResult.isbn }),
      ...(extractResult.publisher && { publisher: extractResult.publisher }),
      ...(extractResult.published_year && { published_year: extractResult.published_year }),
      ...(extractResult.genre && { genre: extractResult.genre }),
      ...(extractResult.language && { language: extractResult.language }),
      ...(extractResult.description && { description: extractResult.description }),
    }));
    setIsEditing(true);
    setExtractDialogOpen(false);
    toast.success('Metadata applied — review and save to confirm.');
  };

  const handleCoverFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const base64 = btoa(Array.from(uint8).map((b) => String.fromCharCode(b)).join(""));
      const result = await uploadCover.mutateAsync({ base64, mimeType: file.type || "image/jpeg" });
      setCoverImage(result.url);
      setFormData((prev: any) => ({ ...prev, cover_url: result.url }));
      toast.success("Cover uploaded to cloud storage");
    } catch {
      toast.error("Cover upload failed — using local preview");
      const reader = new FileReader();
      reader.onload = (e: any) => {
        setCoverImage(e.target.result);
        setFormData((prev: any) => ({ ...prev, cover_url: e.target.result }));
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingCover(false);
    }
  }, [uploadCover]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    // 16 MB limit
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File too large — maximum 16 MB");
      return;
    }
    setUploadingFile(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const base64 = btoa(Array.from(uint8).map((b) => String.fromCharCode(b)).join(""));
      const autoCategory = book.data ? deriveCategory(book.data) : undefined;
      await uploadFile.mutateAsync({
        bookId,
        fileName: file.name,
        base64,
        mimeType: file.type || "application/pdf",
        fileSize: file.size,
        autoCategory,
      });
    } catch {
      // error handled by mutation
    } finally {
      setUploadingFile(false);
    }
  }, [bookId, book.data, uploadFile]);

  // Initialize form data when book loads (in useEffect to avoid setState-in-render anti-pattern)
  useEffect(() => {
    if (book.data && !formInitialized) {
      const b = book.data;
      setFormData({
        isbn: b?.isbn || "",
        title: b?.title || "",
        authors: b?.authors || "",
        publisher: b?.publisher || "",
        published_year: b?.published_year || "",
        genre: b?.genre || "",
        description: b?.description || "",
        page_count: b?.page_count || "",
        language: b?.language || "",
        cover_url: b?.cover_url || "",
        purchase_price: b?.purchase_price || "",
        shelf_location_id: b?.shelf_location_id || "",
      });
      if (b?.cover_url) {
        setCoverImage(b.cover_url);
      }
      setFormInitialized(true);
    }
  }, [book.data, formInitialized]);

  const handleSave = async () => {
    try {
      await updateBook.mutateAsync({
        id: bookId,
        ...formData,
        page_count: formData.page_count ? parseInt(formData.page_count) : undefined,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
        shelf_location_id: formData.shelf_location_id ? parseInt(formData.shelf_location_id) : undefined,
      });
      setIsEditing(false);
    } catch {
      toast.error("Error updating book");
    }
  };

  if (book.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!book.data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate("/app/library")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground">Book not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate("/app/library")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Library
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>{isEditing ? "Edit Book" : book.data.title}</CardTitle>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cover Image */}
            <div className="md:col-span-1">
              {coverImage ? (
                <div className="space-y-3">
                  <img
                    src={coverImage}
                    alt={formData.title}
                    className="w-full h-auto rounded-lg border shadow-sm"
                  />
                  {isEditing && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={uploadingCover}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e: any) => handleCoverFileSelect(e.target.files[0]);
                        input.click();
                      }}
                    >
                      {uploadingCover ? <Spinner className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      {uploadingCover ? "Uploading..." : "Change Cover"}
                    </Button>
                  )}
                </div>
              ) : (
                isEditing && (
                  <Button
                    variant="outline"
                    className="w-full h-64 flex flex-col items-center justify-center"
                    disabled={uploadingCover}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e: any) => handleCoverFileSelect(e.target.files[0]);
                      input.click();
                    }}
                  >
                    {uploadingCover ? <Spinner className="w-8 h-8 mb-2" /> : <Upload className="w-8 h-8 mb-2 text-muted-foreground" />}
                    <span className="text-sm">{uploadingCover ? "Uploading to cloud..." : "Upload Cover"}</span>
                  </Button>
                )
              )}
            </div>

            {/* Book Details */}
            <div className="md:col-span-2 space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="isbn">ISBN</Label>
                      <Input
                        id="isbn"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="authors">Authors</Label>
                    <Input
                      id="authors"
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="publisher">Publisher</Label>
                      <Input
                        id="publisher"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">Published Year</Label>
                      <Input
                        id="year"
                        value={formData.published_year}
                        onChange={(e) => setFormData({ ...formData, published_year: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="genre">Genre</Label>
                      <Input
                        id="genre"
                        value={formData.genre}
                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Input
                        id="language"
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pages">Page Count</Label>
                      <Input
                        id="pages"
                        type="number"
                        value={formData.page_count}
                        onChange={(e) => setFormData({ ...formData, page_count: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Purchase Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.purchase_price}
                        onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="shelf">Shelf Location</Label>
                    <Select value={formData.shelf_location_id?.toString() || ""} onValueChange={(v) => setFormData({ ...formData, shelf_location_id: v })}>
                      <SelectTrigger id="shelf">
                        <SelectValue placeholder="Select a shelf" />
                      </SelectTrigger>
                      <SelectContent>
                        {shelves.data?.map((shelf) => (
                          <SelectItem key={shelf.id} value={shelf.id.toString()}>
                            {shelf.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        if (book.data) {
                          const b = book.data;
                          setFormData({
                            isbn: b?.isbn || "",
                            title: b?.title || "",
                            authors: b?.authors || "",
                            publisher: b?.publisher || "",
                            published_year: b?.published_year || "",
                            genre: b?.genre || "",
                            description: b?.description || "",
                            page_count: b?.page_count || "",
                            language: b?.language || "",
                            cover_url: b?.cover_url || "",
                            purchase_price: b?.purchase_price || "",
                            shelf_location_id: b?.shelf_location_id || "",
                          });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateBook.isPending} className="flex-1">
                      {updateBook.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  {book.data.isbn && (
                    <div><span className="font-semibold">ISBN:</span> {book.data.isbn}</div>
                  )}
                  {book.data.authors && (
                    <div><span className="font-semibold">Authors:</span> {book.data.authors}</div>
                  )}
                  {book.data.publisher && (
                    <div><span className="font-semibold">Publisher:</span> {book.data.publisher}</div>
                  )}
                  {book.data.published_year && (
                    <div><span className="font-semibold">Published:</span> {book.data.published_year}</div>
                  )}
                  {book.data.genre && (
                    <div><span className="font-semibold">Genre:</span> {book.data.genre}</div>
                  )}
                  {book.data.language && (
                    <div><span className="font-semibold">Language:</span> {book.data.language}</div>
                  )}
                  {book.data.page_count && (
                    <div><span className="font-semibold">Pages:</span> {book.data.page_count}</div>
                  )}
                  {book.data.purchase_price && (
                    <div><span className="font-semibold">Price:</span> ${book.data.purchase_price}</div>
                  )}
                  {book.data.shelf_locations && (
                    <div><span className="font-semibold">Shelf:</span> {book.data.shelf_locations.name}</div>
                  )}
                  {book.data.description && (
                    <div>
                      <span className="font-semibold">Description:</span>
                      <p className="mt-2 text-muted-foreground">{book.data.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== READING STATUS SECTION ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="w-5 h-5" />
            Reading Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['unread', 'reading', 'finished'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateReadingStatus.mutate({ id: bookId, status: s })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  (book.data?.reading_status ?? 'unread') === s
                    ? s === 'reading' ? 'bg-blue-500 text-white border-blue-500'
                      : s === 'finished' ? 'bg-green-500 text-white border-green-500'
                      : 'bg-muted text-foreground border-border'
                    : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {s === 'unread' ? '📚 Unread' : s === 'reading' ? '📖 Reading' : '✅ Finished'}
              </button>
            ))}
          </div>
          {(book.data?.reading_status === 'reading' || book.data?.reading_status === 'finished') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-24">Current page</label>
                <input
                  type="number"
                  min={0}
                  max={book.data?.total_pages || book.data?.page_count || 9999}
                  value={readingPage !== '' ? readingPage : (book.data?.current_page ?? 0)}
                  onChange={(e) => setReadingPage(e.target.value)}
                  onBlur={() => {
                    const p = parseInt(readingPage);
                    if (!isNaN(p)) {
                      updateReadingStatus.mutate({
                        id: bookId,
                        status: book.data?.reading_status as any,
                        currentPage: p,
                        totalPages: book.data?.total_pages || book.data?.page_count || undefined,
                      });
                      setReadingPage('');
                    }
                  }}
                  className="w-24 h-8 px-2 text-sm border rounded-md bg-background"
                />
                {(book.data?.total_pages || book.data?.page_count) && (
                  <span className="text-sm text-muted-foreground">
                    of {book.data?.total_pages || book.data?.page_count}
                  </span>
                )}
              </div>
              {(book.data?.total_pages || book.data?.page_count) && (
                <div className="space-y-1">
                  <Progress
                    value={Math.round(
                      ((book.data?.current_page ?? 0) /
                        (book.data?.total_pages || book.data?.page_count || 1)) * 100
                    )}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.round(
                      ((book.data?.current_page ?? 0) /
                        (book.data?.total_pages || book.data?.page_count || 1)) * 100
                    )}% complete
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== E-BOOK / PDF FILES SECTION ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              E-Books &amp; Files
              {files.data && files.data.length > 0 && (
                <Badge variant="secondary">{files.data.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              disabled={uploadingFile}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.epub,.mobi,.txt,.doc,.docx";
                input.onchange = (e: any) => handleFileSelect(e.target.files[0]);
                input.click();
              }}
            >
              {uploadingFile ? <Spinner className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploadingFile ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : files.data && files.data.length > 0 ? (
            <div className="space-y-2">
              {files.data.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                      {file.auto_category && (
                        <Badge variant="outline" className="text-xs py-0 h-4">{file.auto_category}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-primary"
                      title="Extract book info from PDF with AI"
                      disabled={extractingFileId === file.id}
                      onClick={() => handleExtractFromPDF(file)}
                    >
                      {extractingFileId === file.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Sparkles className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewerFile({ url: file.file_url, name: file.file_name })}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a href={file.file_url} download={file.file_name} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      disabled={deleteFile.isPending}
                      onClick={() => deleteFile.mutate({ id: file.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No files attached yet.</p>
              <p className="text-xs mt-1">Upload a PDF, EPUB, or other document to attach it to this book.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {viewerFile && (
      <PDFViewerModal
        open={!!viewerFile}
        onClose={() => setViewerFile(null)}
        fileUrl={viewerFile.url}
        fileName={viewerFile.name}
      />
    )}

    {/* AI Extraction Result Dialog */}
    <Dialog open={extractDialogOpen} onOpenChange={open => !open && setExtractDialogOpen(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Extracted Book Info
          </DialogTitle>
        </DialogHeader>
        {extractResult && (
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground mb-3">The following information was extracted from the PDF. Click "Apply to Book" to update the book record.</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(extractResult)
                .filter(([k, v]) => k !== 'error' && v)
                .map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}: </span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
            </div>
            {extractResult.error && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Note: {extractResult.error}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setExtractDialogOpen(false)}>Cancel</Button>
          <Button onClick={applyExtractedMetadata}>
            <Sparkles className="w-4 h-4 mr-2" />
            Apply to Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
