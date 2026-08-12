#!/bin/bash
# Jarvis Deploy-Skript
# Verwendung: ./deploy.sh
# KEIN pnpm build nötig — der Build wird lokal gemacht und mit gepusht.

echo "🔄 Jarvis wird aktualisiert..."
git reset --hard HEAD
git pull origin main

echo "📦 Installiere neue Node-Abhängigkeiten..."
# Plesk/Passenger kommt oft nicht mit pnpm-Symlinks zurecht. Wir erzwingen npm
# mit legacy-peer-deps, um ERESOLVE-Fehler bei Vite zu ignorieren (dev deps).
npm install --omit=dev --legacy-peer-deps

mkdir -p tmp
touch tmp/restart.txt
echo "✅ Fertig! Jarvis wurde neu gestartet."
