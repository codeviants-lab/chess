# Katkı rehberi

Bu proje bir WhatsApp grubunun ortak projesi. Kodun büyük kısmını üyelerin yapay zekâ ajanları yazıyor; bu
rehber hem insanlar hem ajanlar için. **Ajanla çalışıyorsan ona bu dosyayı, [SPEC.md](SPEC.md)'yi ve
üzerinde çalıştığın Issue'yu okut.**

## Kısaca akış

1. [Issues](../../issues) sekmesinden bir iş seç. Önce **M0** etiketli olanlar; bağımlılığı ("Önce bunlar")
   kapanmamış bir işi alma.
2. Issue'ya "bunu alıyorum" yaz ve kendini **Assignees**'e ekle. Atanmış bir işi başkası almaz; bir haftada
   ilerleme yoksa iş yeniden boşa çıkar.
3. `main`'den bir dal aç: `<issue-no>-<kısa-ad>`, ör. `12-hash-zinciri`.
4. İşi yap. Issue'daki **"Bitti sayılır"** maddelerinin hepsi sağlanmalı.
5. `npm run check` (tip denetimi + testler) yerelde geçsin.
6. Pull request aç, açıklamaya `Closes #<issue-no>` yaz. En az bir kişi onaylayınca birleştirilir.

## Kurallar

- **`main`'e doğrudan push yok.** Her değişiklik PR ile gelir. (GitHub'ın ücretsiz planı bunu zorlayamıyor;
  kural bize emanet.)
- **Bir PR = bir Issue.** Küçük PR çabuk incelenir. Fırsattan istifade başka şeyleri düzeltme; ayrı Issue aç.
- **SPEC.md bağlayıcıdır.** Orada olmayan bir özellik ekleme; fikrini Issue olarak aç (etiket: `fikir`).
  SPEC'i değiştirmek gerekiyorsa bunu ayrı bir PR'da, gerekçesiyle yap.
- **Olay formatı kutsaldır.** M0 bittikten sonra olay şeması yalnızca eklemeli değişir (yeni, isteğe bağlı
  alan). Var olan bir alanı silmek, yeniden adlandırmak ya da anlamını değiştirmek yasak.
- **Yeni bağımlılık** (npm paketi) eklemeden önce Issue'da sor. Hesap, anahtar ya da ücretli servis gerekiyorsa
  dur ve sor. Anahtarlar (Supabase, GitHub token) asla repoya ve PR'a girmez; `.env` dosyası git'e girmez.
- **Çalıştırmadığın şeye "çalışıyor" deme.** PR açıklamasında neyi denediğini, neyi denemediğini yaz.
- Kod, tip ve dosya adları İngilizce; arayüz metinleri, belgeler ve commit açıklamaları Türkçe ya da
  İngilizce olabilir.

## Kendi puan ya da turnuva sistemini eklemek

En yaratıcı kısım bu ve herkese açık. SPEC.md'deki **"Genişletilebilir sistemler"** bölümündeki sözleşmeye
uy:

1. Önce `fikir` etiketiyle bir Issue aç: sistemin adı ve kuralları düz Türkçe, bir de elle hesaplanmış küçük
   bir örnek.
2. Tek dosya: `core/rating/<id>.ts` ya da `core/tournament/<id>.ts`; kayıt listesine (`index.ts`) bir satır.
3. Saf fonksiyon: `Date.now()`, `Math.random()`, ağ, veritabanı, global durum yok.
4. Kimlik `<ad>-v1`. Birleştirildikten sonra davranışı değişmez; değişiklik `-v2` olur.
5. Ortak sözleşme testleri otomatik çalışır; sen en az üç elle hesaplanmış örnek testi eklersin.
6. README'deki "Sistemler" tablosuna bir satır.

Yeni sistem önce "deneysel" sıralama olarak görünür; resmi yapmak yöneticinin kararı.

## Ajanlar için notlar

- Kesin kuralları uydurma: SPEC.md'de ya da Issue'da yazmıyorsa sor (Issue yorumu olarak).
- Aynı test iki kez üst üste başarısız olursa tahminle ilerleme; durumu PR'a ya da Issue'ya yaz.
- Bir aşama (M0, M1 …) tamamen bitince PROGRESS.md'ye kısa bir özet yazılır; tek tek işlerin günlüğü
  PR açıklamalarında durur.
