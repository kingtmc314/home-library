import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen, Package } from "lucide-react";

export default function Stats() {
  const stats = trpc.stats.overview.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library Statistics</h1>
        <p className="text-muted-foreground mt-2">Overview of your book collection</p>
      </div>

      {stats.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Books</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.data?.totalBooks || 0}</div>
              <p className="text-xs text-muted-foreground">Books in your collection</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Shelves</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.data?.totalShelves || 0}</div>
              <p className="text-xs text-muted-foreground">Shelf locations</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
