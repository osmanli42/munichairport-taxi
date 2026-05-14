# SEO Tracker — flughafen-muenchen.taxi

Profesyonel, otomasyonlu SEO takip sistemi. Bağımsız Node.js scripti — Next.js build/runtime'a dokunmaz.

## Özellikler

- **On-page audit**: title, meta, H1, canonical, OG, schema, hreflang, alt, perf, status
- **Skor**: 0–100 ağırlıklı SEO skoru (sayfa + site)
- **Rank takibi**: SerpAPI ile Google'da hedef keyword pozisyonları
- **Tarihsel trend**: ASCII sparkline ile 30 günlük skor + rank trendi
- **DeepSearch**:
  - Rakip SERP haritası (Top 10 snapshot her primary keyword için)
  - **Google #1 olma stratejisi**: rank-1 rakibin sayfasını derinlemesine analiz, gap tablosu, somut aksiyon planı
  - Keyword genişletme (Google Autosuggest, ücretsiz)
  - Core Web Vitals (Google PageSpeed Insights, ücretsiz)
  - İçerik kalite skoru (kelime sayısı, keyword density, Flesch okunabilirlik)
  - Indexed page sayısı + sitemap diff + broken internal links
- **Autopilot**: skor/rank kötüleşince anında Telegram mesajı + otomatik düzeltme önerileri + iyileştirme briefi
- **DeepSeek AI (opsiyonel)**: title/meta rewrite, gap planından 10-adım strateji üretimi (ücretsiz tier varsa kullanır, key boşsa atlanır)

## Kurulum

```bash
cd scripts/seo-tracker
npm install
cp config.example.json config.json
# config.json'u açıp şunları doldurun:
#   serpApiKey           → https://serpapi.com (ayda 100 ücretsiz arama)
#   alerts.telegram      → bot token + chat id  (BotFather'dan)
#   pageSpeedApiKey      → opsiyonel, PSI günlük kotayı artırır
#   deepseekApiKey       → opsiyonel
```

### Telegram bot kurulumu

1. Telegram'da @BotFather → `/newbot` → token al
2. Bot ile bir mesajlaş → `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id`'yi kopyala
3. `config.json` → `alerts.telegram.botToken` ve `chatId`'ye yapıştır
4. Test: `node index.js watch` → ilk çalıştırmada düşüş yok, ama haftalık digest günü ise mesaj gelir. Zorla test için `data/history.json`'a yapay yüksek skorlu eski entry ekleyip `watch` tekrar çalıştır.

## Komutlar

```bash
node index.js audit       # on-page audit + skor
node index.js rank        # rank check
node index.js deepsearch  # rakip + strateji + keyword + content quality
node index.js watch       # tam döngü + diff + alert + autopilot (cron için)
node index.js report      # trend sparkline
node index.js deepseek rewrite https://flughafen-muenchen.taxi/de
node index.js deepseek improve
```

## VPS cron kurulumu

```bash
# VPS'te (root user veya ilgili user):
crontab -e
```

Ekleyin:
```
0 8 * * * cd /root/munichairport-taxi/frontend/scripts/seo-tracker && /usr/bin/node index.js watch >> data/cron.log 2>&1
0 9 * * 1 cd /root/munichairport-taxi/frontend/scripts/seo-tracker && /usr/bin/node index.js deepsearch >> data/cron.log 2>&1
```

İlk satır: her gün 08:00 — tam audit + rank + autopilot.
İkinci satır: her Pazartesi 09:00 — derin rakip/strateji raporu üret.

## Çıktı dosyaları (`data/`)

- `history.json` — zaman serisi snapshot'lar
- `last-report.md` — en son audit insan-okunur rapor
- `rank-one-plan-<keyword>.md` — her primary keyword için #1 olma aksiyon planı
- `rank-one-summary-<date>.md` — strateji özeti
- `deepsearch-<date>.json` — tam deepsearch çıktısı
- `autopilot-<date>.md` — autopilot tespit ettiği fix önerileri
- `alerts.log` — tüm uyarıların log'u
- `deepseek-cache.json` — DeepSeek API cache (kotayı korur)

## Mimari

```
index.js                 # CLI
lib/
  rankCheck.js           # SerpAPI wrapper
  onPageAudit.js         # cheerio HTML parse + audit
  scorer.js              # 0-100 skor
  history.js             # snapshot + diff
  alert.js               # Telegram + log
  autopilot.js           # kötüleşme algıla → fix öner
  fixers/                # 5 fixer modülü
  competitors.js         # rakip SERP + page deep-dive
  rankOneStrategy.js     # gap table + action plan
  keywordExpander.js     # Google Autosuggest
  indexHealth.js         # site: query + sitemap diff + broken links
  vitals.js              # PageSpeed Insights
  contentQuality.js      # readability + density + heading hierarchy
  trendReport.js         # ASCII sparkline
  deepseek.js            # opsiyonel AI (cache'li)
```

## Güvenlik

- `config.json` `.gitignore`'da — secrets repo'ya commit edilmez
- Autopilot **default dry-run**: kod değişiklikleri sadece markdown önerisi olarak yazılır, otomatik commit YOK
- `autopilot.protectedPaths` listesindeki dosyalara fixer'lar dokunmaz
- Onaylanmadan main branch'e merge yok
