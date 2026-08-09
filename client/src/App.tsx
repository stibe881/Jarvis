import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import JarvisChat from "./pages/JarvisChat";
import JarvisNotes from "./pages/JarvisNotes";
import JarvisTasks from "./pages/JarvisTasks";
import JarvisLayout from "./components/JarvisLayout";
import JarvisCalendar from "./pages/JarvisCalendar";
import JarvisMemory from "./pages/JarvisMemory";
import JarvisProfile from "./pages/JarvisProfile";
import GrossIct from "./pages/GrossIct";

function Router() {
  return (
    <JarvisLayout>
      <Switch>
        <Route path={"/"} component={JarvisChat} />
        <Route path={"/chat"} component={JarvisChat} />
        <Route path={"/notes"} component={JarvisNotes} />
      <Route path={"/tasks"} component={JarvisTasks} />
      <Route path={"/calendar"} component={JarvisCalendar} />
      <Route path={"/memory"} component={JarvisMemory} />
      <Route path={"/profile"} component={JarvisProfile} />
      <Route path={"/gross-ict"} component={GrossIct} />
      <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </JarvisLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
