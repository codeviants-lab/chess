# SPEC — Satranç Kulübü

Bir WhatsApp grubu için satranç ve turnuva uygulaması.

> Bu dosyayı okuyan ilk oturum: kodlamaya başlamadan önce "Açık kararlar" bölümündeki her soruyu önerinle
> birlikte sahibine sor, cevapları bu dosyaya işle, sonra PROGRESS.md'deki kurallarla M0'dan başla.

## Amaç
30–40 kişilik bir WhatsApp grubu için web uygulaması. Üyeler kayıt olur (ad, benzersiz takma ad, e-posta ile
giriş), birbirleriyle saatli satranç oynar; turnuvalar düzenlenir. Her üyenin galibiyet / mağlubiyet /
beraberlik sayısı, puanı ve maç geçmişi tutulur. Kullanıcılar linke WhatsApp'tan, çoğunlukla telefondan
gelir: önce telefon, sonra masaüstü. Arayüz Türkçe.

Uzun vadeli hedef: uygulama yeniliklere dayanıklı olsun. Oyun kayıtları uygulamanın değişmez çekirdeğidir;
arayüz, turnuva biçimleri, puan sistemi ve ileride eklenecek özellikler bu kaydın üzerine kurulur ve onu
bozmadan değişebilir.

## Kalıcı kayıt sistemi (değişmez çekirdek)
- Olay kaydı (event sourcing): her oyun ve turnuva, yalnızca eklenen olaylardan oluşur. Örnekler:
  game.created, game.move (ply, SAN, UCI, hamleden sonra kalan süre ms, sunucu zamanı UTC),
  game.draw_offered, game.draw_accepted, game.resigned, game.flagged, game.result, game.result_corrected
  (gerekçe ve yönetici kimliğiyle), tournament.created, tournament.joined, tournament.round_paired,
  player.registered, player.renamed.
- Olaylar asla güncellenmez ya da silinmez; bir düzeltme yeni bir olaydır. Veritabanında bu kural RLS
  (yalnızca ekleme izni) ve güncelleme/silmeyi reddeden bir tetikleyiciyle zorlanır.
- Her oyunun olayları sıra numaralıdır (1, 2, 3 …): boşluk ve çift kayıt reddedilir; iki istemci aynı anda
  yazarsa biri iyimser eşzamanlılık kontrolüyle geri çevrilir.
- Türetilmiş görünümler (projeksiyonlar): sıralama tabloları, G/M/B, puanlar, istatistikler olaylardan
  hesaplanır ve her an baştan üretilebilir. Puan algoritması sürümlüdür (ör. elo-v1); değişirse geçmiş
  yeniden hesaplanır, olaylar değişmez.
- Kalıcı kimlikler: oyuncu, oyun ve turnuvaların değişmeyen UUID/ULID kimlikleri olur. Takma ad değişince
  geçmiş bozulmaz. Hesap silinince kişisel veriler (ad, e-posta) silinir, oyun kayıtları anonim kimlikle
  ("Silinmiş oyuncu") kalır; kişisel veri ile oyun kaydı ayrı tablolarda durur (KVKK).
- Sürümlü şema: her olayın bir schema_version alanı vardır. Değişiklikler yalnızca eklemeli olur (yeni,
  isteğe bağlı alanlar). Kırıcı bir değişiklik yeni bir sürüm, dönüştürücü ve test gerektirir. Uygulanmış
  veritabanı migration'ları düzenlenmez; numaralı yeni migration eklenir. Eski okuyucular tanımadıkları
  olay türlerini atlar (ileriye uyumluluk).
- Standart formatlar: PGN kanonik dışa aktarımdır (Event, Site, Date, Round, White, Black, Result,
  TimeControl etiketleri, ayrıca GameId, WhiteId, BlackId); hamleler UCI ile saklanır, konumlar (FEN)
  hamlelerden yeniden hesaplanabilir. Tüm veri JSON satırları (olaylar) ve PGN olarak dışa aktarılabilir ve
  geri yüklenebilir.
- Çekirdek bağımsızdır: kurallar, olay doğrulama, projeksiyonlar, eşleştirme ve puan hesabı arayüzden ve
  Supabase'den bağımsız bir modülde (core/) durur. Depolama bir arayüzün arkasındadır: bellek adaptörü
  (testler) ve Supabase adaptörü aynı sözleşme testlerinden geçer.

## Depolama ve arşiv
- Oyun sürerken: hamleler sunucudan geçer (canlı iletim, saat, doğrulama) ve geçici olarak Supabase
  Postgres'te tutulur, böylece bağlantı kopması ya da sayfa yenilenmesi oyunu kaybettirmez. İstemciler olay
  tablosuna doğrudan yazamaz: her hamle ve sonuç, doğrulama yapan bir sunucu fonksiyonundan (Postgres RPC ya
  da Edge Function) geçer. Servis anahtarı yalnızca sunucudadır. Okuma RLS ile yalnızca grup üyelerine açıktır.
- Maç bitince: sunucu oyunun tamamını (PGN + olay JSON satırları + olay zincirinin son hash'i) tek bir dosya
  olarak private arşiv reposuna commit'ler: games/YYYY/MM/<oyun-kimliği>.pgn ve .jsonl. Commit'i yalnızca
  sunucu yapar; GitHub token'ı asla istemcide bulunmaz. Arşivde ad ve e-posta asla bulunmaz, yalnızca anonim
  oyuncu kimlikleri bulunur (git geçmişinden silmek pratikte mümkün olmadığı için).
- Arşivden boş bir veritabanına geri yükleme scripti yazılır ve test edilir: geri yüklenen veriden üretilen
  sıralama, orijinaliyle birebir aynı olmalıdır.
- Kapasite hesabı README'de: oyun başına boyut, yıllık tahmin, ücretsiz plan sınırları.

## Barındırma
- Başlangıç: Supabase ücretsiz plan + statik ön yüz (GitHub Pages ya da Vercel). Sunucu kiralanmaz.
- Taşınabilirlik şartı: yalnızca standart Postgres özellikleri ve adaptör arayüzü; Supabase'e özel bir şeye
  bağımlı kalınacaksa nedeni yazılır. README'de "kendi sunucuna (VPS) taşıma" bölümü: veritabanı aktarımı,
  Docker ile kurulum, yedekleme.

## Sabit kararlar
- Kurallar ve hamle doğrulama: chess.js. Hamleler sunucuda da doğrulanır; istemciye güvenilmez.
- Tahta: kendi SVG tahtamız. Sürükle-bırak ve dokun-dokun hamle, yasal kare ipuçları, son hamle ve şah
  vurgusu, terfi seçimi, tahtayı çevirme, oynanış sesleri (kapatılabilir). En az 4 tema (ör. klasik ahşap,
  turnuva yeşili, koyu, yüksek kontrast) ve en az 2 taş seti. Taş görsellerinin lisansını kontrol et ve
  atfını yaz.
- Backend: Supabase (e-posta sihirli link ile giriş, Postgres, Realtime, Row Level Security). Anahtarlar
  ortam değişkenlerinden okunur, repoya asla yazılmaz.
- Saat sunucu otoritesindedir: süre bitişi, bağlantı kopması ve yeniden bağlanma sunucuda kararlaştırılır.
- Gruba kapalı: yalnızca davet linki ya da kodu olan kişiler katılabilir. Yöneticiler turnuva açar.
- Paylaşım: eşleşme, sonuç ve sıralama metinleri wa.me linkiyle WhatsApp'a paylaşılabilir.
- Kişisel veri en az düzeyde (ad, takma ad, e-posta); kısa bir KVKK aydınlatma metni; hesap silme mümkün.

## Açık kararlar (önce sor)
0. Oyunlar uygulamanın içinde mi oynansın (kendi tahta ve saatimiz), yoksa Lichess'te mi (özel takım +
   Lichess API ile biten oyunları çekip kendi kayıt sistemimize yazmak)? Öneri: uygulama içinde; Lichess
   yolu daha hızlı biter ama tahta ve deneyim Lichess'in olur ve oyunlar herkese açıktır.
1. Masa başında oynanan maçların sonucu elle girilebilsin mi (iki oyuncu onaylarsa)?
2. Varsayılan turnuva biçimi: İsviçre (öneri), herkes herkesle (≤10 kişi) ve/veya eleme? Eşitlik bozma
   kuralları (Buchholz, Sonneborn-Berger)?
3. Puan sistemi: Elo (basit) mi Glicko-2 (az maçta daha doğru) mi? (Sürümlü olduğu için sonra değişebilir.)
4. Bot ve analiz için Stockfish (GPL-3: repo GPL olur) eklensin mi?
5. Ön yüz barındırma: GitHub Pages ya da Vercel?
6. Varsayılan süre kontrolleri (ör. 3+2, 5+0, 10+5)?
7. Dil: TypeScript (öneri: olay ve sözleşme tipleri derleyicide denetlenir; Vite ile) mi, düz JavaScript mi?
8. Olaylar hash zinciriyle mühürlensin mi (her olay bir öncekinin özetini taşır, sonradan yapılan
   değişiklik fark edilir)? Öneri: evet, maliyeti düşük.
9. Arşiv reposunun adı (öneri: satranc-kulubu-arsiv, private).

## Aşamalar (her biri bitince dur ve onay bekle)
- M0 Kayıt çekirdeği (arayüz yok): olay türleri ve şema v1, olay doğrulama, bellek adaptörü, projeksiyonlar
  (oyun durumu, G/M/B, puan), PGN dışa ve içe aktarma, JSON satırları dışa ve içe aktarma, sözleşme
  testleri. Bu aşamada olay formatı dondurulur.
- M1 Tahta ve yerel oyun: SVG tahta, temalar, taş setleri, iki kişi aynı cihazda; yerel oyunlar da aynı
  olay formatıyla kaydedilir; PGN dışa aktarma.
- M2 Hesaplar: giriş, profil (ad, takma ad, avatar), davetle gruba katılma, yönetici rolü; Supabase
  adaptörü sözleşme testlerinden geçer.
- M3 Çevrimiçi oyun: meydan okuma, saat, canlı hamleler, teslim olma, beraberlik teklifi, yeniden bağlanma;
  maç bitince arşiv commit'i.
- M4 Turnuvalar: oluşturma, katılma, eşleştirme, turlar, sonuçların oyunlardan otomatik gelmesi, eşitlik
  bozmalı sıralama tablosu.
- M5 İstatistik ve geçmiş: profil (G/M/B, puan grafiği), maç geçmişi ve hamle hamle tekrar oynatma, ikili
  karşılaşma geçmişi, genel sıralama, WhatsApp paylaşımı.
- M6 Cila: PWA (ana ekrana ekleme), bildirimler, yönetici araçları, veri dışa aktarma, yedekleme, geri
  yükleme ve VPS'e taşıma dokümanı, README ekran görüntüleriyle.

## Kalite
- Kural, eşleştirme ve puan kodunun birim testleri olsun: bilinen PGN'ler, rok, en passant, terfi, pat,
  üç kez tekrar, 50 hamle kuralı; eşleştirmede aynı iki kişi iki kez eşleşmez, bay geçme adil dağıtılır; Elo
  hesabı elle hesaplanmış örneklerle karşılaştırılır.
- Kaydın dayanıklılığı test edilir:
  - Tüm projeksiyonlar olay kaydından baştan üretildiğinde aynı sonucu verir (yeniden oynatma testi).
  - Dışa aktar → içe aktar → dışa aktar zinciri birebir aynı çıktıyı verir.
  - v1 olaylarından oluşan örnek dosyalar repoda kalıcı olarak saklanır; her yeni sürüm onları hâlâ
    okuyabilmelidir.
  - Güncelleme ve silme girişimleri veritabanında reddedilir; sıra numarası boşluğu reddedilir.
  - Bir sonuç düzeltmesi geçmişi silmeden sıralamayı değiştirir.
  - Arşivden geri yükleme, orijinaliyle aynı sıralamayı üretir.
- Arayüzü Playwright ile 390 px ve 1280 px genişlikte dene: konsolda hata yok, yatay kaydırma yok, ekran
  görüntüsü al.
- İki tarayıcı sekmesiyle uçtan uca bir çevrimiçi maç oynat (Supabase'e ulaşılamıyorsa bellek adaptörüyle;
  bunu açıkça belirt).
