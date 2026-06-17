import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { FileText, Download, Trash2, Search, BookOpen, Filter } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function EBooks() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterShelf, setFilterShelf] = useState("all");

  const files = trpc.files.list.useQuery({});
  const shelves = trpc.shelves.list.useQuery();
  const utils = trpc.useUtils();

  const deleteFile = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({});
      toast.success("File removed");
    },
    onError: () => toast.error("Failed to remove file"),
  });

  // Derive unique genres from files
  const genres = useMemo(() => {
    if (!files.data) return [];
    const set = new Set<string>();
    files.data.forEach((f) => {
      if (f.auto_category) set.add(f.auto_category);
    });
    return Array.from(set).sort();
  }, [files.data]);

  // Derive unique shelves from files' books
  const shelfOptions = useMemo(() => {
    if (!shelves.data) return [];
    return shelves.data;
  }, [shelves.data]);

  // Filter files
  const filtered = useMemo(() => {
    if (!files.data) return [];
    return files.data.filter((f) => {
      const book = (f as any).books;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        f.file_name.toLowerCase().includes(q) ||
        (book?.title || "").toLowerCase().includes(q) ||
        (book?.isbn || "").includes(q) ||
        (book?.authors || "").toLowerCase().includes(q);
      const matchGenre =
        filterGenre === "all" || f.auto_category === filterGenre;
      const matchShelf =
        filterShelf === "all" ||
        String(book?.shelf_location_id) === filterShelf;
      return matchSearch && matchGenre && matchShelf;
    });
  }, [files.data, search, filterGenre, filterShelf]);

  const totalSize = useMemo(
    () => filtered.reduce((sum, f) => sum + (f.file_size || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            E-Books Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} file{filtered.length !== 1 ? "s" : ""} · {formatFileSize(totalSize)} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, ISBN, or filename…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterGenre} onValueChange={setFilterGenre}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {genres.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterShelf} onValueChange={setFilterShelf}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All shelves" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shelves</SelectItem>
                {shelfOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground font-medium">
              {files.data?.length === 0
                ? "No e-books uploaded yet"
                : "No files match your search"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {files.data?.length === 0
                ? "Open any book in My Library and upload a PDF to get started."
                : "Try adjusting your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => {
            const book = (file as any).books;
            return (
              <Card key={file.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {/* File icon */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.file_name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {book && (
                          <Link
                            href={`/app/library/${book.id}`}
                            className="text-xs text-primary hover:underline truncate max-w-[200px]"
                          >
                            {book.title}
                          </Link>
                        )}
                        {book?.isbn && (
                          <span className="text-xs text-muted-foreground font-mono">
                            ISBN: {book.isbn}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)}
                        </span>
                        {file.auto_category && (
                          <Badge variant="outline" className="text-xs py-0 h-4">
                            {file.auto_category}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                        <a
                          href={file.file_url}
                          download={file.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      {user && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          disabled={deleteFile.isPending}
                          onClick={() => deleteFile.mutate({ id: file.id })}
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
