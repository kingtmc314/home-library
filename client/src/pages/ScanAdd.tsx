import { useState, useRef, useEffect } from "react";
import { Html5Qrcode, Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, Upload, X } from "lucide-react";

export default function ScanAdd() {
  const [scannerActive, setScannerActive] = useState(false);
  const [isbn, setIsbn] = useState("");
  const [bookData, setBookData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const shelves = trpc.shelves.list.useQuery();
  const createBook = trpc.books.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!scannerActive) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setIsbn(decodedText);
        setScannerActive(false);
        scanner.clear();
        handleLookup(decodedText);
      },
      () => {}
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [scannerActive]);

  const handleLookup = async (isbnValue: string) => {
    setLoading(true);
    try {
      const result = await utils.books.lookup.fetch({ isbn: isbnValue });
      if (result) {
        setBookData(result);
        setFormData({
          isbn: isbnValue,
          title: result.title || "",
          authors: Array.isArray(result.authors) ? result.authors.join(", ") : (result.authors || ""),
          publisher: result.publisher || "",
          published_year: result.publishedYear || "",
          genre: result.genre || "",
          description: result.description || "",
          page_count: result.pageCount || "",
          language: result.language || "",
          cover_url: result.coverUrl || "",
          purchase_price: "",
          shelf_location_id: "",
        });
        if (result.coverUrl) {
          setCoverImage(result.coverUrl);
        }
      } else {
        toast.error("Book not found. Please fill in the details manually.");
        setFormData({
          isbn: isbnValue,
          title: "",
          authors: "",
          publisher: "",
          published_year: "",
          genre: "",
          description: "",
          page_count: "",
          language: "",
          cover_url: "",
          purchase_price: "",
          shelf_location_id: "",
        });
      }
    } catch (error) {
      toast.error("Error looking up book");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    try {
      await createBook.mutateAsync({
        ...formData,
        page_count: formData.page_count ? parseInt(formData.page_count) : undefined,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
        shelf_location_id: formData.shelf_location_id ? parseInt(formData.shelf_location_id) : undefined,
      });
      toast.success("Book added successfully!");
      setIsbn("");
      setBookData(null);
      setFormData({});
      setCoverImage(null);
    } catch (error) {
      toast.error("Error saving book");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scan & Add Book</h1>
        <p className="text-muted-foreground mt-2">Scan ISBN barcode or manually enter book details</p>
      </div>

      {!bookData ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan ISBN Barcode</CardTitle>
            <CardDescription>Point your camera at the ISBN barcode on the back of the book</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scannerActive ? (
              <div className="space-y-4">
                <div id="qr-reader" style={{ width: "100%", maxWidth: "500px" }}></div>
                <Button onClick={() => setScannerActive(false)} variant="outline" className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Stop Scanner
                </Button>
              </div>
            ) : (
              <Button onClick={() => setScannerActive(true)} className="w-full" size="lg">
                <Camera className="w-4 h-4 mr-2" />
                Start Scanner
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or enter ISBN manually</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <div className="flex gap-2">
                <Input
                  id="isbn"
                  placeholder="e.g. 9789861371955"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                />
                <Button onClick={() => handleLookup(isbn)} disabled={!isbn || loading}>
                  {loading ? <Spinner className="w-4 h-4" /> : "Lookup"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Book Details</CardTitle>
            <CardDescription>Review and edit the book information before saving</CardDescription>
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
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e: any) => {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = (event: any) => {
                            setCoverImage(event.target.result);
                            setFormData({ ...formData, cover_url: event.target.result });
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change Cover
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-64 flex flex-col items-center justify-center"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e: any) => {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (event: any) => {
                          setCoverImage(event.target.result);
                          setFormData({ ...formData, cover_url: event.target.result });
                        };
                        reader.readAsDataURL(file);
                      };
                      input.click();
                    }}
                  >
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <span className="text-sm">Upload Cover</span>
                  </Button>
                )}
              </div>

              {/* Book Details */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="authors">Authors</Label>
                    <Input
                      id="authors"
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    />
                  </div>
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
                  <Select value={formData.shelf_location_id} onValueChange={(v) => setFormData({ ...formData, shelf_location_id: v })}>
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
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setBookData(null);
                  setIsbn("");
                  setFormData({});
                  setCoverImage(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createBook.isPending} className="flex-1">
                {createBook.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save Book
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
