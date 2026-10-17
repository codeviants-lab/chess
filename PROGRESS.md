# PROGRESS — codeviants-chess

Çalışma döngüsünün günlüğü (bkz. SPEC.md). En yeni kayıt "Günlük"ün en altında.

## Döngü kuralları
- Her iş bir GitHub Issue'sudur ve kendi dalında yapılıp PR ile gönderilir (bkz. CONTRIBUTING.md). İşin
  günlüğü (ne yapıldı, test sonucu, ne denenmedi) PR açıklamasına yazılır; bu dosyaya yalnızca aşama
  özetleri ve önemli kararlar girer.
- Bir aşama bitince onu "[x] — incelemede" işaretle, özetini yaz ve döngüyü durdur. Sahibi onaylamadan
  sonrakine geçme.
- Aynı test iki kez üst üste başarısız olursa dur, sorunu "Açık sorunlar"a yaz; tahminle ilerleme.
- M0'dan sonra olay formatını değiştirmen gerekirse dur ve sor; değişiklik yalnızca eklemeli olabilir.
- `main`'e doğrudan push etme. Sormadan yeni bağımlılık, hesap ya da ücretli servis
  ekleme. Hesap açman, para harcaman ya da bir anahtara ihtiyaç duyman gerekiyorsa dur ve sor; anahtarları
  sohbette isteme, ortam ayarlarına eklenmelerini iste.
- Çalıştırmadığın bir şeye "çalışıyor" deme; doğrulanmayan her şeyi açıkça yaz.
- SPEC.md'de olmayan özellik ekleme; fikirleri aşağıda "Öneriler"e yaz.

## Aşamalar
- [x] Açık kararlar cevaplandı (SPEC.md, 2026-10-17)
- [ ] P0 — oynanabilir sürüm (puansız): bot, arkadaşa link, rastgele rakip
- [ ] M0 — kayıt çekirdeği
- [ ] M1 — tahta ve yerel oyun
- [ ] M2 — hesaplar
- [ ] M3 — çevrimiçi oyun
- [ ] M4 — turnuvalar
- [ ] M5 — istatistik ve geçmiş
- [ ] M6 — cila

## Açık sorunlar
(yok)

## Öneriler
(yok)

## Günlük
- 2026-10-17 — Proje oluşturuldu: SPEC.md, PROGRESS.md, LICENSE (MIT), .gitignore. Henüz kod yok. Sıradaki:
  açık kararları sahibine sormak.
- 2026-10-17 — Repo codeviants-lab/chess'e taşındı. Açık kararlar sahibiyle tek tek cevaplandı ve SPEC.md'ye
  işlendi ("Verilen kararlar"): uygulama içi oyun, onaylı masa başı sonuçları, herkes herkesle + eleme,
  elo-v1, Stockfish yok, Cloudflare Pages, 3+2 / 5+0 / 10+5 / yazışmalı, TypeScript, hash zinciri,
  arşiv codeviants-lab/chess-archive. Yeni bölüm: puan ve turnuva sistemleri için bağlayıcı eklenti
  sözleşmesi (grup kendi sistemlerini ekleyecek). Sıradaki: CONTRIBUTING.md ve ilk Issue'lar, sonra M0.
