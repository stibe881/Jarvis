import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Sun, Calendar, RefreshCw } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user } = useAuth();
  
  // Hole das Morning Briefing vom Backend
  const { data, isLoading, isError, refetch, isFetching } = trpc.chat.generateMorningBriefing.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60 * 2, // 2 Stunden cachen
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
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
              Aktualisieren
            </Button>
          </div>
          <div className="p-6 min-h-[200px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
                <Loader2 className="animate-spin" size={32} />
                <p>Jarvis analysiert deine Termine und Aufgaben...</p>
              </div>
            ) : isError ? (
              <div className="text-destructive">
                Fehler beim Laden der Tagesplanung. Bitte versuche es später noch einmal.
              </div>
            ) : (
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <Streamdown>{data?.briefing || "Keine Informationen verfügbar."}</Streamdown>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
