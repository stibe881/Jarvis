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
import SonnenbergIct from "./pages/SonnenbergIct";
import AppDashboard from "./pages/AppDashboard";
import JarvisTemplates from "./pages/JarvisTemplates";
import JarvisVoiceNotes from "./pages/JarvisVoiceNotes";
import JarvisDelegation from "./pages/JarvisDelegation";
import JarvisIntegrations from "./pages/JarvisIntegrations";
import JarvisShortcuts from "./pages/JarvisShortcuts";
import CustomerDossier from "./pages/CustomerDossier";
import JarvisBoccia from "./pages/JarvisBoccia";
import OnboardingWizard from "./components/OnboardingWizard";
import Login from "./pages/Login";

function Router() {
  // Die Login-Seite liegt bewusst ausserhalb des Layouts: sie muss ohne
  // angemeldete Sitzung erreichbar sein.
  if (window.location.pathname === "/login") {
    return <Login />;
  }

  return (
    <JarvisLayout>
      <OnboardingWizard />
      <Switch>
        <Route path={"/"} component={JarvisChat} />
        <Route path={"/chat"} component={JarvisChat} />
        <Route path={"/notes"} component={JarvisNotes} />
        <Route path={"/tasks"} component={JarvisTasks} />
        <Route path={"/calendar"} component={JarvisCalendar} />
        <Route path={"/memory"} component={JarvisMemory} />
        <Route path={"/profile"} component={JarvisProfile} />
        <Route path={"/gross-ict"} component={GrossIct} />
        <Route path={"/sonnenberg"} component={SonnenbergIct} />
        <Route path={"/app"} component={AppDashboard} />
        <Route path={"/templates"} component={JarvisTemplates} />
        <Route path={"/voice-notes"} component={JarvisVoiceNotes} />
        <Route path={"/delegation"} component={JarvisDelegation} />
        <Route path={"/integrations"} component={JarvisIntegrations} />
        <Route path={"/shortcuts"} component={JarvisShortcuts} />
        <Route path={"/customer"} component={CustomerDossier} />
        <Route path={"/boccia"} component={JarvisBoccia} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </JarvisLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
