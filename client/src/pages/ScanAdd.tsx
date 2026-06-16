import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, Upload, X, PenLine } from "lucide-react";

const EMPTY_FORM = {
  isbn: "",
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
};

export default function ScanAdd() {
  const [scannerActive, setScannerActive] = useState(false);
  const [isbn, setIsbn] = useState("");
  // bookData is null (no form), "manual" (manual mode), or the looked-up data object
  const [bookData, setBookData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  const [uploadingCover, setUploadingCover] = useState(false);
  const shelves = trpc.shelves.list.useQuery();
  const createBook = trpc.books.create.useMutation();
  const uploadCover = trpc.books.uploadCover.useMutation();
  const utils = trpc.useUtils();

  const handleCoverFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const base64 = btoa(Array.from(uint8).map((b) => String.fromCharCode(b)).join(""));
      const result = await uploadCover.mutateAsync({
        base64,
        mimeType: file.type || "image/jpeg",
      });
      setCoverImage(result.url);
      setFormData((prev: any) => ({ ...prev, cover_url: result.url }));
      toast.success("Cover uploaded to cloud storage");
    } catch (err) {
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

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerStarted.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore stop errors
      }
      scannerStarted.current = false;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    if (!scannerActive) return;

    setScannerError(null);
    const html5QrCode = new Html5Qrcode("qr-reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (!cameras || cameras.length === 0) {
          setScannerError("No camera found on this device.");
          setScannerActive(false);
          return;
        }

        const backCamera = cameras.find(
          (c) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("rear") ||
            c.label.toLowerCase().includes("environment")
        );
        const cameraId = backCamera ? backCamera.id : cameras[cameras.length - 1].id;

        return html5QrCode.start(
          cameraId,
          {
            fps: 15,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(minEdge * 0.85),
                height: Math.floor(minEdge * 0.35),
              };
            },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            const cleanIsbn = decodedText.replace(/[\s-]/g, "");
            setIsbn(cleanIsbn);
            stopScanner();
            handleLookup(cleanIsbn);
          },
          () => {}
        );
      })
      .then(() => {
        scannerStarted.current = true;
      })
      .catch((err) => {
        const msg = String(err);
        if (msg.includes("Permission") || msg.includes("permission")) {
          setScannerError("Camera permission denied. Please allow camera access in your browser settings.");
        } else {
          setScannerError("Could not start camera: " + msg);
        }
        setScannerActive(false);
      });

    return () => {
      if (scannerRef.current && scannerStarted.current) {
        scannerRef.current.stop().catch(() => {});
        scannerStarted.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerActive]);

  const handleLookup = async (isbnValue: string) => {
    if (!isbnValue.trim()) return;
    setLoading(true);
    try {
      const result = await utils.books.lookup.fetch({ isbn: isbnValue.trim() });
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
        toast.success("Book found! Review the details below.");
      } else {
        // Not found — open manual form pre-filled with the ISBN
        toast.info("Book not found in database. Please fill in the details manually.");
        setFormData({ ...EMPTY_FORM, isbn: isbnValue });
        setBookData("notfound");
        setCoverImage(null);
      }
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("quota")) {
        toast.warning("Book lookup API quota reached for today. Please fill in the details manually.");
      } else {
        toast.error("Error looking up book. Please fill in the details manually.");
      }
      setFormData({ ...EMPTY_FORM, isbn: isbnValue });
      setBookData("notfound");
      setCoverImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddManually = () => {
    setFormData({ ...EMPTY_FORM });
    setBookData("manual");
    setCoverImage(null);
    setScannerActive(false);
  };

  const handleReset = () => {
    setBookData(null);
    setIsbn("");
    setFormData({ ...EMPTY_FORM });
    setCoverImage(null);
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
      toast.success("Book added to your library!");
      handleReset();
    } catch (error) {
      toast.error("Error saving book");
    }
  };

  const isFormMode = bookData !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scan & Add Book</h1>
        <p className="text-muted-foreground mt-2">Scan an ISBN barcode, look up by ISBN, or add all details manually</p>
      </div>

      {!isFormMode ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a Book</CardTitle>
            <CardDescription>Scan the barcode, enter the ISBN, or fill in all details yourself</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scannerError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {scannerError}
              </div>
            )}

            {scannerActive ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Hold the barcode horizontally inside the scanning frame
                </p>
                <div
                  id="qr-reader"
                  style={{ width: "100%", maxWidth: "520px", margin: "0 auto" }}
                />
                <Button onClick={stopScanner} variant="outline" className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Stop Scanner
                </Button>
              </div>
            ) : (
              <Button onClick={() => setScannerActive(true)} className="w-full" size="lg">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera Scanner
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or enter ISBN to look up</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="e.g. 9789861371955"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && isbn && !loading && handleLookup(isbn)}
              />
              <Button onClick={() => handleLookup(isbn)} disabled={!isbn || loading} className="shrink-0">
                {loading ? <Spinner className="w-4 h-4" /> : "Look Up"}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or add without ISBN</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" size="lg" onClick={handleAddManually}>
              <PenLine className="w-4 h-4 mr-2" />
              Add Book Manually
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {bookData === "manual" ? "Add Book Manually" :
               bookData === "notfound" ? "Book Not Found — Enter Details" :
               "Confirm Book Details"}
            </CardTitle>
            <CardDescription>
              {bookData === "manual" ? "Fill in all the book information below" :
               bookData === "notfound" ? "This ISBN wasn't found in the database. Please fill in the details yourself." :
               "Review and edit the book information before saving"}
            </CardDescription>
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
                  </div>
                ) : (
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
                    <span className="text-sm">{uploadingCover ? "Uploading to cloud..." : "Upload Cover Photo"}</span>
                    <span className="text-xs text-muted-foreground mt-1">Optional</span>
                  </Button>
                )}
              </div>

              {/* Book Details */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="isbn-field">ISBN</Label>
                    <Input
                      id="isbn-field"
                      placeholder="e.g. 9789888903245"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="title"
                      placeholder="Book title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="authors">Authors</Label>
                  <Input
                    id="authors"
                    placeholder="e.g. John Smith, Jane Doe"
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="publisher">Publisher</Label>
                    <Input
                      id="publisher"
                      placeholder="Publisher name"
                      value={formData.publisher}
                      onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Published Year</Label>
                    <Input
                      id="year"
                      placeholder="e.g. 2023"
                      value={formData.published_year}
                      onChange={(e) => setFormData({ ...formData, published_year: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="genre">Genre / Category</Label>
                    <Input
                      id="genre"
                      placeholder="e.g. Fiction, History"
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      placeholder="e.g. en, zh, fr"
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
                      placeholder="e.g. 320"
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
                      placeholder="e.g. 98.00"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="shelf">Shelf Location</Label>
                  <Select
                    value={formData.shelf_location_id}
                    onValueChange={(v) => setFormData({ ...formData, shelf_location_id: v })}
                  >
                    <SelectTrigger id="shelf">
                      <SelectValue placeholder="Select a shelf (optional)" />
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
                  <Label htmlFor="description">Description / Notes</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description or personal notes about this book"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createBook.isPending} className="flex-1">
                {createBook.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save to Library
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
