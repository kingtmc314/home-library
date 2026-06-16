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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/app/*"}>
        {() => (
          <DashboardLayout>
            <Switch>
              <Route path={"/scan"} component={ScanAdd} />
              <Route path={"/library"} component={MyLibrary} />
              <Route path={"/library/:id"} component={BookDetail} />
              <Route path={"/shelves"} component={ShelfLocations} />
              <Route path={"/stats"} component={Stats} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        )}
      </Route>
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
