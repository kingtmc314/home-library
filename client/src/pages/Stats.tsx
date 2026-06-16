import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Package,
  BookMarked,
  TrendingUp,
  Library,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const GENRE_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#10b981", "#34d399", "#6ee7b7", "#a7f3d0",
  "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a",
  "#ef4444", "#f87171", "#fca5a5", "#fecaca",
];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = "text-primary",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-muted/50`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-muted-foreground">
          {payload[0].value} book{payload[0].value !== 1 ? "s" : ""} ({payload[0].payload.percent}%)
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="text-muted-foreground">
          {payload[0].value} book{payload[0].value !== 1 ? "s" : ""} added
        </p>
      </div>
    );
  }
  return null;
};

export default function Stats() {
  const stats = trpc.stats.overview.useQuery();
  const genreStats = trpc.stats.byGenre.useQuery();
  const monthlyStats = trpc.stats.byMonth.useQuery();
  const loans = trpc.loans.list.useQuery({ activeOnly: false });

  const isLoading = stats.isLoading || genreStats.isLoading || monthlyStats.isLoading;

  // Process genre data for pie chart
  const totalGenreBooks = (genreStats.data || []).reduce((sum, g) => sum + Number(g.count), 0);
  const genreData = (genreStats.data || [])
    .filter((g) => g.genre && g.genre !== "Unknown")
    .map((g, i) => ({
      name: g.genre,
      value: Number(g.count),
      percent: totalGenreBooks > 0 ? Math.round((Number(g.count) / totalGenreBooks) * 100) : 0,
      fill: GENRE_COLORS[i % GENRE_COLORS.length],
    }));

  // Process monthly data for bar chart
  const monthlyData = (monthlyStats.data || []).map((m) => ({
    month: m.month,
    books: Number(m.count),
  }));

  const activeLoans = loans.data?.filter((l) => !l.returned_date).length ?? 0;
  const overdueLoans = loans.data?.filter(
    (l) => !l.returned_date && l.due_date && new Date(l.due_date) < new Date()
  ).length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library Statistics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          An overview of your personal book collection
        </p>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Books"
            value={stats.data?.totalBooks ?? 0}
            description="In your collection"
            icon={BookOpen}
            color="text-blue-600"
          />
          <StatCard
            title="Shelf Locations"
            value={stats.data?.totalShelves ?? 0}
            description="Organised shelves"
            icon={Package}
            color="text-violet-600"
          />
          <StatCard
            title="On Loan"
            value={activeLoans}
            description={overdueLoans > 0 ? `${overdueLoans} overdue` : "All within due date"}
            icon={BookMarked}
            color={overdueLoans > 0 ? "text-red-600" : "text-green-600"}
          />
          <StatCard
            title="Genres"
            value={genreData.length}
            description="Unique categories"
            icon={Library}
            color="text-amber-600"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Books by Genre</CardTitle>
            <CardDescription>Distribution of your collection by category</CardDescription>
          </CardHeader>
          <CardContent>
            {genreStats.isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : genreData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No genre data yet</p>
                <p className="text-xs mt-1">Add genres to your books to see the chart</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={genreData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {genreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Books Added per Month</CardTitle>
            <CardDescription>Your collection growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyStats.isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : monthlyData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No data yet</p>
                <p className="text-xs mt-1">Start adding books to see your growth chart</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="books"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Genre breakdown table */}
      {genreData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Genre Breakdown</CardTitle>
            <CardDescription>Detailed count by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {genreData.map((g, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: g.fill }}
                  />
                  <span className="text-sm flex-1 truncate">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${g.percent}%`,
                          backgroundColor: g.fill,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {g.value} ({g.percent}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
