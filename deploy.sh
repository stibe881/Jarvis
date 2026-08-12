#!/bin/bash
# Jarvis Deploy-Skript
# Verwendung: ./deploy.sh
# KEIN pnpm build nötig — der Build wird lokal gemacht und mit gepusht.

echo "🔄 Jarvis wird aktualisiert..."
git reset --hard HEAD
git pull origin main

echo "📦 Installiere neue Node-Abhängigkeiten..."
pnpm install --prod

mkdir -p tmp
touch tmp/restart.txt
echo "✅ Fertig! Jarvis wurde neu gestartet."
