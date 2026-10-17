# codeviants-chess

### ▶ [Tıkla ve oyna: codeviants-lab.github.io](https://codeviants-lab.github.io)

Kayıt yok, kurulum yok: linki aç ve oyna. Telefonda ve bilgisayarda çalışır. Şu an bota karşı; arkadaşa link ve
rastgele rakip, Supabase bağlanınca açılır.

Bir WhatsApp grubu için satranç ve turnuva uygulaması: kayıt, uygulama içinde saatli oyunlar (canlı ve
yazışmalı), turnuvalar, galibiyet / mağlubiyet / beraberlik, puan ve maç geçmişi. Oyun kayıtları değişmez,
hash zinciriyle mühürlenmiş bir olay kaydında tutulur; biten her oyun ayrıca bir arşiv reposuna PGN olarak
yazılır.

Durum: **P0 — oynanabilir, puansız sürüm**: bota karşı (3 seviye), arkadaşa link atarak ya da rastgele rakiple
oyna; telefon ve masaüstü; ok çizme. Puan, hesap ve turnuvalar sonraki aşamalarda. Gereksinimler ve kararlar
[SPEC.md](SPEC.md), ilerleme [PROGRESS.md](PROGRESS.md).

Katılmak için: [CONTRIBUTING.md](CONTRIBUTING.md) — iş seçme, dal, PR ve yapay zekâ ajanlarıyla çalışma kuralları.

## Neden "codeviants"?

İsim üç kelimenin üst üste binmesi:

- **co** — birlikte. Bu proje bir grubun ortak işi.
- **dev** — developer, geliştirici. Birlikte geliştirenler: *co-dev-iants*.
- **deviant** — sapkın, normdan sapan.

Sonuncusu bilerek seçildi. Varsayılan hal hiçbir şey yapmamak: evde oturmak, akıp giden günü izlemek. Biz o
normdan sapanlarız. Bir şey üretmek, birlikte bir şey kurmak için oturduğumuz yerden kalkanlar. Hiçbir şey
yapmamanın "normal"i karşısında sapkın kalmak iyidir.

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

## Yayına alma

Site GitHub Pages'te: `scripts/deploy-pages.sh` derler ve yalnızca derlenmiş dosyaları public
`codeviants-lab/codeviants-lab.github.io` reposuna gönderir (kaynak kod bu private repoda kalır). Adres:
https://codeviants-lab.github.io. Yayınlamak: `main` güncelken `./scripts/deploy-pages.sh`.

Arkadaşa link ve rastgele rakip için Supabase gerekir (Supabase anahtarı olmayan bir derlemede bu modlar "yakında"
olarak görünür):

1. supabase.com'da proje aç → **Project Settings → API**: Project URL ve `anon` `public` anahtar.
   Veritabanı kullanılmıyor; yalnızca Realtime (broadcast + presence).
2. Bu iki değeri yukarıdaki gibi `.env.local`'e yaz ve `./scripts/deploy-pages.sh` çalıştır.

Anon anahtar tarayıcıya gömülür ve herkese açıktır; bu Supabase'in tasarımıdır. Servis (service_role) anahtarı
asla buraya ya da repoya girmez. İleride PR önizlemeleri istenirse Cloudflare Pages'e geçilebilir (SPEC).

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
