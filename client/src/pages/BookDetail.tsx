import { useState } from "react";
import { useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";

export default function BookDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams();
  const bookId = parseInt(id || "0");

  const book = trpc.books.get.useQuery({ id: bookId });
  const shelves = trpc.shelves.list.useQuery();
  const updateBook = trpc.books.update.useMutation({
    onSuccess: () => {
      book.refetch();
      toast.success("Book updated successfully!");
    },
  });

  const [formData, setFormData] = useState<any>({});
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const uploadCover = trpc.books.uploadCover.useMutation();

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

  // Initialize form data when book loads
  if (book.data && Object.keys(formData).length === 0) {
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
  }

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
    } catch (error) {
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
                        // Reset form data
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
                    <div>
                      <span className="font-semibold">ISBN:</span> {book.data.isbn}
                    </div>
                  )}
                  {book.data.authors && (
                    <div>
                      <span className="font-semibold">Authors:</span> {book.data.authors}
                    </div>
                  )}
                  {book.data.publisher && (
                    <div>
                      <span className="font-semibold">Publisher:</span> {book.data.publisher}
                    </div>
                  )}
                  {book.data.published_year && (
                    <div>
                      <span className="font-semibold">Published:</span> {book.data.published_year}
                    </div>
                  )}
                  {book.data.genre && (
                    <div>
                      <span className="font-semibold">Genre:</span> {book.data.genre}
                    </div>
                  )}
                  {book.data.language && (
                    <div>
                      <span className="font-semibold">Language:</span> {book.data.language}
                    </div>
                  )}
                  {book.data.page_count && (
                    <div>
                      <span className="font-semibold">Pages:</span> {book.data.page_count}
                    </div>
                  )}
                  {book.data.purchase_price && (
                    <div>
                      <span className="font-semibold">Price:</span> ${book.data.purchase_price}
                    </div>
                  )}
                  {book.data.shelf_locations && (
                    <div>
                      <span className="font-semibold">Shelf:</span> {book.data.shelf_locations.name}
                    </div>
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
    </div>
  );
}
