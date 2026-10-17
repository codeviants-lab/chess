# codeviants-chess

### ▶ [Tıkla ve oyna: codeviants-chess.pages.dev](https://codeviants-chess.pages.dev)

Kayıt yok, kurulum yok: linki aç, bota karşı ya da arkadaşınla oyna. Telefonda ve bilgisayarda çalışır.

Bir WhatsApp grubu için satranç ve turnuva uygulaması: kayıt, uygulama içinde saatli oyunlar (canlı ve
yazışmalı), turnuvalar, galibiyet / mağlubiyet / beraberlik, puan ve maç geçmişi. Oyun kayıtları değişmez,
hash zinciriyle mühürlenmiş bir olay kaydında tutulur; biten her oyun ayrıca bir arşiv reposuna PGN olarak
yazılır.

Durum: **P0 — oynanabilir, puansız sürüm**: bota karşı (3 seviye), arkadaşa link atarak ya da rastgele rakiple
oyna; telefon ve masaüstü; ok çizme. Puan, hesap ve turnuvalar sonraki aşamalarda. Gereksinimler ve kararlar
[SPEC.md](SPEC.md), ilerleme [PROGRESS.md](PROGRESS.md).

Katılmak için: [CONTRIBUTING.md](CONTRIBUTING.md) — iş seçme, dal, PR ve yapay zekâ ajanlarıyla çalışma kuralları.

## Çalıştırma

Node 22 gerekir.

```bash
npm ci
npm run dev        # http://localhost:5173 — Supabase anahtarı yoksa çevrimiçi modlar aynı tarayıcının sekmeleri arasında çalışır
npm run check      # tip denetimi + birim testleri
npm run e2e        # tarayıcıda uçtan uca testler (ilk sefer: npx playwright install chromium)
```

Çevrimiçi oyunu gerçek cihazlar arasında çalıştırmak için `.env.local` dosyasına (git'e girmez):

```
VITE_SUPABASE_URL=https://<proje>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/public anahtar>
```

## Yayına alma (Cloudflare Pages)

1. Supabase: yeni proje → **Project Settings → API**: Project URL ve `anon` `public` anahtarı al.
   Veritabanı kullanılmıyor; yalnızca Realtime (broadcast + presence). **Realtime → Settings**'te public
   kanallara erişim açık olmalı (varsayılan).
2. Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → `codeviants-lab/chess`.
   Build command `npm run build`, output `dist`, ortam değişkenleri `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (ve gerekirse `NODE_VERSION=22`). Proje adı `codeviants-chess` →
   `https://codeviants-chess.pages.dev`.
3. Her PR'a otomatik önizleme linki gelir; `main`'e birleşen her şey yayına çıkar.

Anon anahtar tarayıcıya gömülür ve herkese açıktır; bu Supabase'in tasarımıdır. Servis (service_role) anahtarı
asla buraya ya da repoya girmez.

## Kendi sistemini icat et

Puan ve turnuva sistemleri bu projede sabit değil. Bilinen sistemler (Elo; herkes herkesle; eleme) varsayılan
olarak hazır gelir, ama asıl amaç grubun **kendi sistemlerini** tasarlayıp eklemesi. Bu alan yaratıcılığa
tamamen açık: bilinen bir satranç sistemine benzemesi gerekmez. Siyahla kazanmaya ek puan, sezonlar, takım
ligleri, meydan okuma merdiveni… ne istersen.

Tek şart, eklentinin SPEC.md'deki **"Genişletilebilir sistemler"** sözleşmesine uyması: tek dosya, saf
fonksiyon, sürümlü kimlik, sözleşme testlerinden geçmek. Yapay zekâ ajanınla çalışıyorsan ona önce o bölümü
okut. Yeni sistemler önce "deneysel" sıralama olarak resmi olanın yanında görünür; hiçbir oyun kaydı
değişmediği için denemek risksizdir.

## Sistemler

| Kimlik | Ad | Ne yapar |
|---|---|---|
| `elo-v1` | Elo | Varsayılan puan: başlangıç 1500, K = 32. |
| `round-robin-v1` | Herkes herkesle | Varsayılan turnuva; eşitlikte aralarındaki maç. |
| `knockout-v1` | Eleme | Beraberlikte rövanş, sonra armageddon. |

## Lisans

MIT — bkz. [LICENSE](LICENSE). Taş görselleri (`app/public/pieces/`): cburnett seti, Colin M.L. Burnett,
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) — Lichess'in kullandığı standart set.
