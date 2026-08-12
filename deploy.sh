#!/bin/bash
# Jarvis Deploy-Skript
# Verwendung: ./deploy.sh
# KEIN pnpm build nötig — der Build wird lokal gemacht und mit gepusht.

echo "🔄 Jarvis wird aktualisiert..."
git reset --hard HEAD
git pull origin main

echo "📦 Installiere neue Node-Abhängigkeiten..."
# Da npm auf dem Server kaputt ist (matches-Fehler), nutzen wir pnpm.
# Mit node-linker=hoisted erzeugen wir einen flachen node_modules-Ordner 
# OHNE Symlinks, womit Passenger problemlos umgehen kann.
pnpm install --prod --config.node-linker=hoisted

mkdir -p tmp
touch tmp/restart.txt
echo "✅ Fertig! Jarvis wurde neu gestartet."
