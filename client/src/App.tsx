import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ScanAdd from "./pages/ScanAdd";
import MyLibrary from "./pages/MyLibrary";
import ShelfLocations from "./pages/ShelfLocations";
import Stats from "./pages/Stats";
import BookDetail from "./pages/BookDetail";
import Loans from "./pages/Loans";
import EBooks from "./pages/EBooks";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/app/scan"} component={() => <DashboardLayout><ScanAdd /></DashboardLayout>} />
      <Route path={"/app/library/:id"} component={() => <DashboardLayout><BookDetail /></DashboardLayout>} />
      <Route path={"/app/library"} component={() => <DashboardLayout><MyLibrary /></DashboardLayout>} />
      <Route path={"/app/shelves"} component={() => <DashboardLayout><ShelfLocations /></DashboardLayout>} />
      <Route path={"/app/stats"} component={() => <DashboardLayout><Stats /></DashboardLayout>} />
      <Route path={"/app/loans"} component={() => <DashboardLayout><Loans /></DashboardLayout>} />
      <Route path={"/app/ebooks"} component={() => <DashboardLayout><EBooks /></DashboardLayout>} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}



function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
