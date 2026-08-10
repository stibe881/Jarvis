import { useState } from "react";

/**
 * Lokaler Passwort-Login für den Self-Hosting-Betrieb.
 *
 * Ersetzt den früheren Weiterleitungs-Login über den Plattform-OAuth-Server:
 * Das Passwort wird an /api/auth/login geschickt, der Server setzt bei Erfolg
 * den Session-Cookie und wir laden die App neu.
 */
export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (resp.ok) {
        window.location.href = "/";
        return;
      }
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Anmeldung fehlgeschlagen.");
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div className="space-y-1 text-center">
          <h1 className="font-jarvis text-2xl font-bold text-primary">
            JARVIS
          </h1>
          <p className="text-sm text-muted-foreground">
            Bitte melde dich an, um fortzufahren.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
