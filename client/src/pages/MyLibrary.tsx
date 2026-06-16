import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Trash2, Edit2 } from "lucide-react";

export default function MyLibrary() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterShelf, setFilterShelf] = useState("");

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

  if (filterGenre) {
    displayBooks = displayBooks.filter((book) => book.genre === filterGenre);
  }

  if (filterShelf) {
    displayBooks = displayBooks.filter((book) => book.shelf_location_id === parseInt(filterShelf));
  }

  const genres = Array.from(new Set(books.data?.map((b) => b.genre).filter(Boolean) || []));

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
                <SelectItem value="">All Genres</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre || ""}>
                    {genre || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterShelf} onValueChange={setFilterShelf}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by shelf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Shelves</SelectItem>
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
      {displayBooks.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground">No books found. Start by scanning a book!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayBooks.map((book) => (
            <Card
              key={book.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/app/library/${book.id}`)}
            >
              {book.cover_url ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">No Cover</span>
                </div>
              )}

              <CardContent className="pt-4 space-y-2">
                <h3 className="font-semibold line-clamp-2 text-sm">{book.title}</h3>

                {book.authors && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{book.authors}</p>
                )}

                <div className="flex flex-wrap gap-1 pt-2">
                  {book.genre && <Badge variant="secondary" className="text-xs">{book.genre}</Badge>}
                  {book.purchase_price && (
                    <Badge variant="outline" className="text-xs">
                      ${book.purchase_price}
                    </Badge>
                  )}
                </div>

                {book.shelf_locations && (
                  <p className="text-xs text-muted-foreground pt-2">{book.shelf_locations.name}</p>
                )}

                <div className="flex gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1"
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
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this book?")) {
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
