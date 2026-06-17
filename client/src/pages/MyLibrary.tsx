import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Trash2, Edit2, BookOpen } from "lucide-react";

export default function MyLibrary() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGenre, setFilterGenre] = useState("all");
  const [filterShelf, setFilterShelf] = useState("all");

  const books = trpc.books.list.useQuery();
  const shelves = trpc.shelves.list.useQuery();
  const deleteBook = trpc.books.delete.useMutation({
    onSuccess: () => {
      books.refetch();
    },
  });

  let displayBooks = books.data || [];

  if (searchQuery) {
    displayBooks = displayBooks.filter(
      (book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.authors && book.authors.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  if (filterGenre && filterGenre !== "all") {
    displayBooks = displayBooks.filter((book) => book.genre === filterGenre);
  }

  if (filterShelf && filterShelf !== "all") {
    displayBooks = displayBooks.filter((book) => book.shelf_location_id === parseInt(filterShelf));
  }

  const genres = Array.from(new Set(books.data?.map((b) => b.genre).filter(Boolean) || [])) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
        <p className="text-muted-foreground mt-2">{displayBooks.length} books in your collection</p>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={filterGenre} onValueChange={setFilterGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterShelf} onValueChange={setFilterShelf}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by shelf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shelves</SelectItem>
                {shelves.data?.map((shelf) => (
                  <SelectItem key={shelf.id} value={shelf.id.toString()}>
                    {shelf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Books Grid */}
      {books.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[2/3] bg-muted animate-pulse" />
              <CardContent className="pt-4 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayBooks.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium text-muted-foreground">No books found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || filterGenre !== "all" || filterShelf !== "all"
                  ? "Try adjusting your search or filters"
                  : "Start by scanning a book in Scan & Add"}
              </p>
            </div>
            {!searchQuery && filterGenre === "all" && filterShelf === "all" && (
              <Button onClick={() => navigate("/app/scan")}>Scan Your First Book</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {displayBooks.map((book) => (
            <Card
              key={book.id}
              className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group border border-border/60"
              onClick={() => navigate(`/app/library/${book.id}`)}
            >
              {/* Book Cover */}
              <div className="aspect-[2/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 relative">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                    <BookOpen className="w-10 h-10 text-slate-400" />
                    <span className="text-xs text-slate-400 text-center line-clamp-3">{book.title}</span>
                  </div>
                )}
                {/* Price badge overlay */}
                {book.purchase_price && (
                  <div className="absolute top-2 right-2">
                    <Badge className="text-xs bg-background/90 text-foreground border shadow-sm">
                      ${Number(book.purchase_price).toFixed(2)}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="pt-3 pb-3 space-y-2">
                <h3 className="font-semibold line-clamp-2 text-sm leading-snug">{book.title}</h3>

                {book.authors && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{book.authors}</p>
                )}

                <div className="flex flex-wrap gap-1">
                  {book.genre && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {book.genre}
                    </Badge>
                  )}
                  {(book as any).reading_status && (book as any).reading_status !== 'unread' && (
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${
                        (book as any).reading_status === 'reading'
                          ? 'border-blue-400 text-blue-600'
                          : 'border-green-400 text-green-600'
                      }`}
                    >
                      {(book as any).reading_status === 'reading' ? '📖 Reading' : '✅ Finished'}
                    </Badge>
                  )}
                </div>

                {(book as any).shelf_locations && (
                  <p className="text-xs text-muted-foreground truncate">
                    📚 {(book as any).shelf_locations.name}
                  </p>
                )}

                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/library/${book.id}`);
                    }}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${book.title}"?`)) {
                        deleteBook.mutate({ id: book.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
