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
- [ ] P0 — oynanabilir sürüm (puansız): bot, arkadaşa link, rastgele rakip — kod bitti (#13, PR #14), yayında
      https://codeviants-lab.github.io/chess/ (yalnızca bot); kalanlar: #15 Supabase, #16 cihaz testi,
      #18 gruba açılış (#17 otomatik yayın bitti)
- [ ] M0 — kayıt çekirdeği (#1 bitti; #2–#11 açık)
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
- 2026-10-17 — Sahibi önceliği değiştirdi: M0'dan önce gruba atılabilecek, puansız oynanabilir sürüm (P0, SPEC'te
  bölüm). #1 (iskelet, PR #12) ve #13 (P0, PR #14) birleşti. Proje adı codeviants-chess. Site GitHub Pages'te
  (Cloudflare hesabı yok): derlenmiş dosyalar public codeviants-lab/codeviants-lab.github.io reposunda, yayın
  `./scripts/deploy-pages.sh` ile elle. Supabase anahtarı olmadığı için yayında yalnızca bota karşı oyun var;
  çevrimiçi modlar "Yakında". Açık uçlar "P0 — gruba açılış" kilometre taşında: #15–#18.
- 2026-10-23 — Repo public yapıldı; site artık bu repodan, `main`'e her birleşmede GitHub Actions ile yayınlanıyor
  (https://codeviants-lab.github.io/chess/). `scripts/deploy-pages.sh` ve ayrı yayın reposu yerine bu (#17).
