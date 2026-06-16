import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BookOpen, Barcode, Grid3x3, BarChart3 } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Home Library Hub</h1>
          </div>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <Button onClick={() => navigate("/app/library")}>Go to Library</Button>
                <Button variant="outline" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button onClick={() => (window.location.href = getLoginUrl())}>Sign In</Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-5xl font-bold tracking-tight">
            Organize Your Personal Library with Elegance
          </h2>
          <p className="text-xl text-muted-foreground">
            Scan ISBN barcodes, automatically fetch book metadata, and manage your collection with a premium, refined interface.
          </p>
          {isAuthenticated ? (
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" onClick={() => navigate("/app/scan")}>
                <Barcode className="w-5 h-5 mr-2" />
                Start Scanning
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/app/library")}>
                <Grid3x3 className="w-5 h-5 mr-2" />
                View Library
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={() => (window.location.href = getLoginUrl())}>
              Get Started
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-100 py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Powerful Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <Barcode className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold mb-2">ISBN Scanning</h4>
              <p className="text-sm text-muted-foreground">
                Scan book barcodes using your device camera with live viewfinder
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <BookOpen className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold mb-2">Auto Lookup</h4>
              <p className="text-sm text-muted-foreground">
                Fetch complete metadata from Google Books & Open Library APIs
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <Grid3x3 className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold mb-2">E-Commerce Grid</h4>
              <p className="text-sm text-muted-foreground">
                Browse your collection in a beautiful, responsive grid layout
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <BarChart3 className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold mb-2">Statistics</h4>
              <p className="text-sm text-muted-foreground">
                Track total books, shelves, and organize by genre or location
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto bg-blue-600 text-white rounded-lg p-12 text-center space-y-4">
          <h3 className="text-3xl font-bold">Ready to Build Your Library?</h3>
          <p className="text-lg opacity-90">
            Start scanning books and organizing your collection today
          </p>
          {isAuthenticated ? (
            <Button size="lg" variant="secondary" onClick={() => navigate("/app/scan")}>
              <Barcode className="w-5 h-5 mr-2" />
              Scan Your First Book
            </Button>
          ) : (
            <Button size="lg" variant="secondary" onClick={() => (window.location.href = getLoginUrl())}>
              Sign In to Get Started
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Home Library Hub — Organize your personal book collection with elegance</p>
        </div>
      </footer>
    </div>
  );
}
