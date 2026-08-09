import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { MessageSquare, StickyNote, CheckSquare, LogOut, Cpu, Menu, X, CalendarDays, Brain, Settings, Briefcase, Building2, LayoutDashboard, MoreHorizontal, FileText, Mic, UserPlus, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useAppBadge } from "@/hooks/useAppBadge";

/** Widget-Modus: kompakte Ansicht ohne Navigation, aktiviert per ?widget=1 */
function useWidgetMode() {
  const [isWidget, setIsWidget] = useState(false);
  useEffect(() => {
    const check = () => {
      const params = new URLSearchParams(window.location.search);
      setIsWidget(params.get("widget") === "1");
    };
    check();
    window.addEventListener("popstate", check);
    return () => window.removeEventListener("popstate", check);
  }, []);
  return isWidget;
}

// Primäre Bottom-Nav (max 4 + Mehr-Button)
const primaryNav = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/tasks", label: "Aufgaben", icon: CheckSquare },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/app", label: "Meine App", icon: LayoutDashboard },
];

// Alle Nav-Items (für Desktop-Sidebar und Mehr-Menü)
const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/notes", label: "Notizen", icon: StickyNote },
  { href: "/tasks", label: "Aufgaben", icon: CheckSquare },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/voice-notes", label: "Sprachnotizen", icon: Mic },
  { href: "/templates", label: "Vorlagen", icon: FileText },
  { href: "/delegation", label: "Delegation", icon: UserPlus },
  { href: "/memory", label: "Gedächtnis", icon: Brain },
  { href: "/gross-ict", label: "Gross ICT", icon: Briefcase },
  { href: "/sonnenberg", label: "Sonnenberg", icon: Building2 },
  { href: "/app", label: "Meine App", icon: LayoutDashboard },
  { href: "/integrations", label: "Verbindungen", icon: Plug },
  { href: "/profile", label: "Profil", icon: Settings },
];

export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const isWidget = useWidgetMode();
  useAppBadge();

  // Mehr-Menü schliessen wenn ausserhalb geklickt
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <JarvisOrb size={80} />
          <p className="font-jarvis text-primary text-sm tracking-widest animate-pulse">INITIALISIERUNG...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-8 p-8 w-full max-w-sm">
          <JarvisOrb size={120} />
          <div className="text-center">
            <h1 className="font-jarvis text-4xl font-bold text-primary jarvis-glow-text mb-2">JARVIS</h1>
            <p className="text-muted-foreground text-sm tracking-widest">PERSÖNLICHER KI-ASSISTENT</p>
          </div>
          <p className="text-foreground/70 text-center text-sm">
            Dein intelligenter Assistent powered by Claude. Bitte melde dich an, um fortzufahren.
          </p>
          <Button
            onClick={() => startLogin()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-jarvis tracking-widest py-3 jarvis-glow-sm"
          >
            ANMELDEN
          </Button>
        </div>
      </div>
    );
  }

  const isActive = (href: string) =>
    location === href || (href === "/" && (location === "/chat" || location === "/"));

  // ── Widget-Modus: nur Chat, ohne Sidebar und Bottom-Nav ──
  if (isWidget) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-sidebar flex-shrink-0">
          <div className="flex items-center gap-2">
            <JarvisOrb size={22} />
            <span className="font-jarvis text-sm font-bold text-primary jarvis-glow-text">JARVIS</span>
          </div>
          <a
            href="/"
            className="text-[10px] text-muted-foreground hover:text-primary tracking-wide"
            title="Vollansicht öffnen"
          >
            VOLLANSICHT
          </a>
        </header>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Mobile Top-Bar (nur auf kleinen Bildschirmen) ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
        <div className="flex items-center gap-2">
          <JarvisOrb size={28} />
          <span className="font-jarvis text-base font-bold text-primary jarvis-glow-text">JARVIS</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-muted-foreground hover:text-primary p-1"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── Mobile Slide-Down-Menü ── */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[57px] left-0 right-0 z-50 bg-sidebar border-b border-border shadow-xl">
          <nav className="p-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all",
                    isActive(href)
                      ? "bg-primary/20 text-primary jarvis-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </div>
              </Link>
            ))}
          </nav>
          <div className="px-3 pb-3 border-t border-border pt-3">
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
                <span className="text-primary text-xs font-bold">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name ?? "Nutzer"}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
            >
              <LogOut size={14} />
              Abmelden
            </Button>
          </div>
        </div>
      )}

      {/* ── Desktop + Mobile Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Desktop Sidebar (ab md) ── */}
        <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <JarvisOrb size={36} />
              <div>
                <h1 className="font-jarvis text-lg font-bold text-primary jarvis-glow-text">JARVIS</h1>
                <p className="text-xs text-muted-foreground tracking-widest">KI-ASSISTENT</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                  isActive(href)
                    ? "bg-primary/20 text-primary jarvis-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}>
                  <Icon size={18} className={isActive(href) ? "text-primary" : ""} />
                  {label}
                  {isActive(href) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary jarvis-glow-sm" />}
                </div>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <span className="text-primary text-xs font-bold">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name ?? "Nutzer"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
            >
              <LogOut size={14} />
              Abmelden
            </Button>
          </div>
        </aside>

        {/* ── Hauptinhalt ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom-Navigation ── */}
      <nav className="md:hidden flex-shrink-0 flex items-center justify-around border-t border-border bg-sidebar py-1 px-2 safe-area-bottom">
        {primaryNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[56px]",
              isActive(href) ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon size={20} />
              <span className="text-[9px] font-medium tracking-wide leading-tight">{label}</span>
              {isActive(href) && <span className="w-1 h-1 rounded-full bg-primary" />}
            </div>
          </Link>
        ))}
        {/* Mehr-Button */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[56px]",
              moreMenuOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal size={20} />
            <span className="text-[9px] font-medium tracking-wide leading-tight">Mehr</span>
          </button>
          {/* Mehr-Menü Popup */}
          {moreMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-52 bg-sidebar border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              {navItems.filter(n => !primaryNav.some(p => p.href === n.href)).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <div
                    onClick={() => setMoreMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all",
                      isActive(href) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                    {isActive(href) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                </Link>
              ))}
              <div className="border-t border-border px-4 py-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
                  <span className="text-primary text-[10px] font-bold">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
                </div>
                <span className="text-xs text-muted-foreground truncate flex-1">{user?.name ?? "Nutzer"}</span>
                <button onClick={() => logout()} className="text-muted-foreground hover:text-destructive">
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

export function JarvisOrb({ size = 48 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full border-2 border-primary/30 animate-jarvis-spin"
        style={{ borderTopColor: "oklch(0.65 0.22 220)" }}
      />
      <div
        className="absolute rounded-full border border-primary/20 animate-jarvis-spin-reverse"
        style={{ inset: size * 0.1, borderRightColor: "oklch(0.75 0.18 195)" }}
      />
      <div
        className="relative rounded-full bg-primary/10 flex items-center justify-center animate-pulse-ring"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <Cpu size={size * 0.28} className="text-primary" />
      </div>
    </div>
  );
}
