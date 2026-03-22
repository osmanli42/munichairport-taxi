#!/bin/bash
echo "🚀 Deploy başlıyor..."
cd /Users/osman/munichairport-taxi
git add .
git commit -m "update: $(date '+%d.%m.%Y %H:%M')"
git push
echo "✅ Bitti! Site 1-2 dakika içinde güncellenir."
echo "🌐 https://flughafen-muenchen.taxi"
