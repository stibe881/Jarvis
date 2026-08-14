import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Sun, Calendar, RefreshCw, MapPin, Newspaper } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user } = useAuth();
  
  // Hole das Morning Briefing vom Backend
  const { data: briefingData, isLoading: briefingLoading, isError: briefingError, refetch: refetchBriefing, isFetching: briefingFetching } = trpc.chat.generateMorningBriefing.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60 * 2, // 2 Stunden cachen
  });

  const { data: newsData, isLoading: newsLoading } = trpc.news.getLatest.useQuery(undefined, {
    staleTime: 1000 * 60 * 15, // 15 Minuten cachen
  });

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Sun className="text-yellow-500" size={32} />
            Guten Morgen, {user?.name || "Stefan"}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Hier ist deine Übersicht für den heutigen Tag.
          </p>
        </header>

        <section className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-muted/40 flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="text-primary" />
              Tagesplanung (Morning Briefing)
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchBriefing()}
              disabled={briefingFetching}
              className="gap-2"
            >
              <RefreshCw size={14} className={briefingFetching ? "animate-spin" : ""} />
              Aktualisieren
            </Button>
          </div>
          <div className="p-6 min-h-[200px]">
            {briefingLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
                <Loader2 className="animate-spin" size={32} />
                <p>Jarvis analysiert deine Termine und Aufgaben...</p>
              </div>
            ) : briefingError ? (
              <div className="text-destructive">
                Fehler beim Laden der Tagesplanung. Bitte versuche es später noch einmal.
              </div>
            ) : (
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <Streamdown>{(typeof briefingData?.briefing === 'string' ? briefingData.briefing : String(briefingData?.briefing || "Keine Informationen verfügbar."))}</Streamdown>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* News Widget */}
          <section className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
            <div className="p-4 border-b bg-muted/40 flex items-center gap-2">
              <Newspaper className="text-primary" />
              <h2 className="text-lg font-semibold">Aktuelle Nachrichten</h2>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {newsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-6">
                  {newsData?.map((feed: any, i: number) => (
                    <div key={i}>
                      <h3 className="font-bold text-primary mb-2 sticky top-0 bg-card py-1">{feed.source}</h3>
                      <ul className="space-y-3">
                        {feed.items?.map((item: any, j: number) => (
                          <li key={j} className="text-sm border-b pb-2 last:border-0">
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-foreground/90 block mb-1">
                              {item.title}
                            </a>
                            {item.pubDate && <span className="text-xs text-muted-foreground">{new Date(item.pubDate).toLocaleString('de-CH')}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Maps Widget */}
          <section className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-muted/40 flex items-center gap-2">
              <MapPin className="text-primary" />
              <h2 className="text-lg font-semibold">Verkehr & Karte</h2>
            </div>
            <div className="flex-1 min-h-[400px]">
              <iframe
                title="Google Maps Zell LU"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src="https://www.google.com/maps/embed/v1/place?key=REPLACE_ME_mit_Maps_API_Key&q=Zell+LU,Switzerland"
              ></iframe>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
