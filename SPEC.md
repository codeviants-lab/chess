# SPEC — codeviants-chess

Bir WhatsApp grubu için satranç ve turnuva uygulaması.

> Bu dosyayı okuyan ajan: tüm kararlar verildi (bkz. "Verilen kararlar"). PROGRESS.md'deki kurallarla
> sıradaki açık aşamadan devam et. Puan ya da turnuva sistemi ekleyeceksen önce "Genişletilebilir sistemler"
> bölümünü oku; oradaki sözleşme bağlayıcıdır.

## Amaç
30–40 kişilik bir WhatsApp grubu için web uygulaması. Üyeler kayıt olur (ad, benzersiz takma ad, e-posta ile
giriş), birbirleriyle saatli satranç oynar; turnuvalar düzenlenir. Her üyenin galibiyet / mağlubiyet /
beraberlik sayısı, puanı ve maç geçmişi tutulur. Kullanıcılar linke WhatsApp'tan, çoğunlukla telefondan
gelir: önce telefon, sonra masaüstü. Arayüz Türkçe.

Uzun vadeli hedef: uygulama yeniliklere dayanıklı olsun. Oyun kayıtları uygulamanın değişmez çekirdeğidir;
arayüz, turnuva biçimleri, puan sistemi ve ileride eklenecek özellikler bu kaydın üzerine kurulur ve onu
bozmadan değişebilir.

Proje bir grup tarafından birlikte geliştirilir ve kodun büyük kısmını üyelerin yapay zekâ ajanları yazar.
Bu yüzden sözleşmeler (olay formatı, eklenti arayüzleri) TypeScript tipleri ve testlerle makinece
denetlenebilir olmalıdır; düz metinle bırakılan kural, kural sayılmaz.

## Kalıcı kayıt sistemi (değişmez çekirdek)
- Olay kaydı (event sourcing): her oyun ve turnuva, yalnızca eklenen olaylardan oluşur. Örnekler:
  game.created (süre kontrolü dahil), game.move (ply, SAN, UCI, hamleden sonra kalan süre ms, sunucu zamanı
  UTC), game.draw_offered, game.draw_accepted, game.resigned, game.flagged, game.result,
  game.result_corrected (gerekçe ve yönetici kimliğiyle), game.result_reported, game.result_confirmed,
  game.result_disputed (masa başı maçlar, bkz. kararlar), tournament.created (biçim kimliği ve seçenekleriyle),
  tournament.joined, tournament.round_paired, player.registered, player.renamed.
- Olaylar asla güncellenmez ya da silinmez; bir düzeltme yeni bir olaydır. Veritabanında bu kural RLS
  (yalnızca ekleme izni) ve güncelleme/silmeyi reddeden bir tetikleyiciyle zorlanır.
- Her oyunun olayları sıra numaralıdır (1, 2, 3 …): boşluk ve çift kayıt reddedilir; iki istemci aynı anda
  yazarsa biri iyimser eşzamanlılık kontrolüyle geri çevrilir.
- Hash zinciri: her olay, aynı akıştaki bir önceki olayın SHA-256 özetini (prev_hash) taşır; ilk olayınki
  null'dır. Özet, olayın kanonik JSON'u (anahtarlar sıralı, boşluksuz) üzerinden hesaplanır. Zinciri baştan
  doğrulayan bir fonksiyon core/'da bulunur; kırık zincir hata olarak raporlanır.
- Türetilmiş görünümler (projeksiyonlar): sıralama tabloları, G/M/B, puanlar, istatistikler olaylardan
  hesaplanır ve her an baştan üretilebilir. Puan ve turnuva sistemleri sürümlüdür (ör. elo-v1); değişirse
  geçmiş yeniden hesaplanır, olaylar değişmez.
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

## Genişletilebilir sistemler: puan ve turnuva biçimleri
Grubun açık isteği: puan ve turnuva sistemleri sabit değildir. Bilinen sistemler varsayılan olarak hazır
gelir, ama asıl hedef grubun **kendi sistemlerini icat edip eklemesidir**. Bu alan yaratıcılığa sonuna kadar
açıktır: yeni bir sistemin bilinen satranç sistemlerine benzemesi gerekmez (ör. siyahla kazanmaya ek puan,
uzun oyunlara ağırlık, sezonlar, takım ligleri, meydan okuma merdiveni). Sınır yalnızca aşağıdaki
sözleşmedir; ona uyan her fikir eklenebilir.

### Varsayılanlar
- Puan: `elo-v1` — başlangıç 1500, K = 32, beklenen skor 1 / (1 + 10^((Rb − Ra) / 400)). Masa başı maçlar
  (onaylanmış) da sayılır. Glicko-2 ileride bir eklenti olarak eklenebilir.
- Turnuva: `round-robin-v1` (varsayılan, herkes herkesle; renkler Berger tablosuyla dengelenir; tek sayıda
  oyuncuda her turda biri bay geçer) ve `knockout-v1` (eleme).
- Eşitlik bozma (`round-robin-v1`): eşit puanlı oyuncular arasında yalnızca kendi aralarındaki maçlardan
  alınan puan. Bu da eşitse oyuncular ortak sırayı paylaşır (ör. "2–3."); yönetici isterse ayrı bir eşitlik
  bozma maçı açar.
- Beraberlik (`knockout-v1`): renkler değişerek bir rövanş; o da berabere biterse armageddon (beyaz 5 dk,
  siyah 4 dk, beraberlik siyahın galibiyeti sayılır). Turnuva seçenekleriyle değiştirilebilir.

### Sözleşme (bağlayıcı)
- Yer: puan sistemleri `core/rating/<id>.ts`, turnuva biçimleri `core/tournament/<id>.ts`. Her biri
  `core/rating/index.ts` ya da `core/tournament/index.ts` içindeki kayıt listesine eklenir; başka bir dosyaya
  dokunmak gerekmez.
- Kimlik: `<ad>-v<sürüm>` (ör. `elo-v1`). Yayınlanmış bir sürümün davranışı asla değiştirilmez; değişiklik
  yeni sürümdür (`elo-v2`). Eski turnuvalar oluşturuldukları sürümle hesaplanmaya devam eder.
- Saf fonksiyon: girdi yalnızca olaylardan türetilmiş veridir. Ağ, veritabanı, dosya, `Date.now()`,
  `Math.random()` ve global durum yasaktır. Rastgelelik gerekiyorsa core/'daki tohumlu üreteç turnuva
  kimliğinden tohumlanarak kullanılır. Aynı girdi her zaman aynı çıktıyı verir. Girdi nesneleri değiştirilmez.
- Arayüzler (adlar ve alanlar bu şekilde uygulanır; ekleme yapılabilir, çıkarma yapılamaz):

```ts
type PlayerId = string;
type Score = 1 | 0.5 | 0;                       // beyaz açısından

interface RatedResult {
  gameId: string;
  white: PlayerId;
  black: PlayerId;
  score: Score;
  playedAt: string;                             // ISO 8601, UTC
  timeControl: TimeControl;
  source: "online" | "manual";                  // manual = onaylanmış masa başı sonucu
  tournamentId?: string;
}

interface PlayerRating {
  value: number;                                // sıralamada gösterilen sayı
  games: number;
  extra?: Record<string, number>;               // sisteme özgü değerler (ör. sapma)
}

interface RatingSystem<Options = unknown> {
  id: string;                                   // "elo-v1"
  name: string;                                 // arayüzde görünen Türkçe ad
  description: string;                          // kuralları düz Türkçe anlatır; arayüzde gösterilir
  defaultOptions: Options;
  // results oynanma sırasıyla gelir (playedAt, eşitse gameId).
  compute(results: readonly RatedResult[], options: Options): ReadonlyMap<PlayerId, PlayerRating>;
}

interface Pairing { white: PlayerId; black: PlayerId | null }   // black null = bay

interface TournamentState {
  tournamentId: string;
  players: readonly PlayerId[];                 // katılım sırası
  rounds: readonly {
    number: number;
    pairings: readonly (Pairing & { result?: Score; gameIds: readonly string[] })[];
  }[];
}

interface Standing {
  place: number;                                // paylaşılan sırada aynı sayı
  player: PlayerId;
  points: number;
  tiebreaks: Record<string, number>;
}

interface TournamentFormat<Options = unknown> {
  id: string;                                   // "round-robin-v1"
  name: string;
  description: string;
  defaultOptions: Options;
  validateOptions(playerCount: number, options: Options): string[];   // boş dizi = geçerli
  nextRound(state: TournamentState, options: Options): Pairing[] | "finished";
  standings(state: TournamentState, options: Options): Standing[];
}
```

- Seçim olaylarda saklanır: `tournament.created` biçimin kimliğini ve seçeneklerini taşır. Genel sıralama için
  grubun bir "resmi puan sistemi" ayarı vardır (varsayılan `elo-v1`).
- Puanlar projeksiyon olduğu için birden çok sistem aynı anda hesaplanabilir: yeni bir sistem önce
  "deneysel" sıralama olarak resmi olanın yanında gösterilir; yönetici isterse resmi yapar. Hiçbir olay
  değişmez, geri dönmek her zaman mümkündür.
- Her eklenti iki tür testten geçer:
  - Ortak sözleşme testleri (`tests/contracts/`, her kayıtlı eklentiye otomatik uygulanır): aynı girdi iki kez
    aynı çıktıyı verir; girdi değişmez (dondurulmuş nesneyle denenir); olaylardan yeniden oynatma aynı sonucu
    verir. Turnuvada ayrıca: bir oyuncu bir turda en fazla bir kez eşleşir; biten turnuva "finished" döner;
    sıralama her oyuncuyu tam bir kez içerir.
  - Eklentinin kendi testleri: elle hesaplanmış en az üç örnek.
- Yeni sistem eklenirken README'deki "Sistemler" tablosuna bir satır yazılır (kimlik, ad, bir cümle).

## Depolama ve arşiv
- Oyun sürerken: hamleler sunucudan geçer (canlı iletim, saat, doğrulama) ve geçici olarak Supabase
  Postgres'te tutulur, böylece bağlantı kopması ya da sayfa yenilenmesi oyunu kaybettirmez. İstemciler olay
  tablosuna doğrudan yazamaz: her hamle ve sonuç, doğrulama yapan bir sunucu fonksiyonundan (Postgres RPC ya
  da Edge Function) geçer. Servis anahtarı yalnızca sunucudadır. Okuma RLS ile yalnızca grup üyelerine açıktır.
- Maç bitince: sunucu oyunun tamamını (PGN + olay JSON satırları + olay zincirinin son hash'i) private arşiv
  reposu `codeviants-lab/chess-archive`'a commit'ler: games/YYYY/MM/<oyun-kimliği>.pgn ve .jsonl. Commit'i
  yalnızca sunucu yapar; GitHub token'ı asla istemcide bulunmaz. Arşivde ad ve e-posta asla bulunmaz, yalnızca
  anonim oyuncu kimlikleri bulunur (git geçmişinden silmek pratikte mümkün olmadığı için).
- Arşivden boş bir veritabanına geri yükleme scripti yazılır ve test edilir: geri yüklenen veriden üretilen
  sıralama, orijinaliyle birebir aynı olmalıdır.
- Kapasite hesabı README'de: oyun başına boyut, yıllık tahmin, ücretsiz plan sınırları.

## Barındırma
- Şu an (P0): derlenmiş site GitHub Pages'te, public `codeviants-lab/codeviants-lab.github.io` reposundan
  (https://codeviants-lab.github.io); kaynak private kalır. Cloudflare hesabı açılınca aşağıdaki plana geçilir.
- Başlangıç: Supabase ücretsiz plan + statik ön yüz Cloudflare Pages'te (private repoya bağlanır, her PR için
  önizleme linki verir). Sunucu kiralanmaz. GitHub Pages kullanılamaz: ücretsiz org'da private repodan yayın
  yok ve org'da Pages kapalı.
- Taşınabilirlik şartı: yalnızca standart Postgres özellikleri ve adaptör arayüzü; Supabase'e özel bir şeye
  bağımlı kalınacaksa nedeni yazılır. README'de "kendi sunucuna (VPS) taşıma" bölümü: veritabanı aktarımı,
  Docker ile kurulum, yedekleme.

## Sabit kararlar
- Dil: TypeScript (strict), Vite. Olay tipleri ve eklenti arayüzleri derleyicide denetlenir.
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
- Lisans MIT. Stockfish yok (GPL-3 gerektirir); analiz için oyunun PGN'i Lichess analiz sayfasında açılabilir.

## Verilen kararlar (2026-10-17)
0. Oyunlar uygulamanın içinde oynanır: kendi tahtamız ve saatimiz. Lichess kullanılmaz.
1. Masa başı maçlar: oyunculardan biri sonucu girer (`game.result_reported`), rakip onaylarsa
   (`game.result_confirmed`) G/M/B'ye ve puana sayılır; itiraz ederse (`game.result_disputed`) sayılmaz ve
   yöneticiye düşer. Hamleler olmadan yalnızca sonuç kaydedilir; PGN'de hamlesiz oyun olarak dışa aktarılır.
2. Turnuva biçimleri: herkes herkesle (varsayılan) ve eleme. İsviçre sistemi yok (eklenti olarak
   eklenebilir). Eşitlik bozma: aralarındaki maç (ayrıntı: "Genişletilebilir sistemler").
3. Puan: varsayılan `elo-v1`; grup kendi sistemlerini eklenti olarak ekler.
4. Stockfish eklenmez.
5. Ön yüz: Cloudflare Pages.
6. Süre kontrolleri: 3+2, 5+0, 10+5 ve yazışmalı (hamle başına 1 gün). Maç açan kişi özel süre de
   seçebilir. TimeControl tipi iki türü kapsar: `{ kind: "live", initialMs, incrementMs }` ve
   `{ kind: "correspondence", perMoveMs }`. Yazışmalı oyunda süre bitimi de sunucuda kararlaştırılır.
7. Dil: TypeScript.
8. Olaylar hash zinciriyle mühürlenir.
9. Arşiv reposu: `codeviants-lab/chess-archive` (private).

## P0 — oynanabilir sürüm (puansız, 2026-10-17)
Sahibinin kararı: M0'dan önce gruba hemen atılabilecek, oynanabilir bir sürüm. Puan, hesap ve kalıcı kayıt
yok; amaç oyunu gruba açmak ve ardından katkıcıları davet etmek.

- Modlar: bota karşı (kolay / orta / zor), arkadaşa link (`#/g/<oda>`), rastgele rakip (aynı süreyi seçmiş
  bekleyenlerle eşleşme). Süreler: süresiz, 3+2, 5+0, 10+5. Telefon önce, masaüstü de.
- Tahta: kendi SVG tahtamız, standart görünüm (Lichess kahverengi tahta, cburnett taşları). Sürükle-bırak ve
  dokun-dokun; ok ve daire çizme (sağ tık; telefonda kalem modu; Shift kırmızı, Alt mavi, Ctrl sarı).
- Bot: `core/bot/` — kendi hızlı tahta temsilimiz (perft ile chess.js'e karşı doğrulanır) + alfa-beta arama,
  tarayıcıda Web Worker'da çalışır. Stockfish yok.
- Çevrimiçi: Supabase Realtime'ın yalnızca broadcast ve presence özellikleri (veritabanı yok). Oyun protokolü
  `app/game/room.ts`: her istemci her mesajı aynı saf `reduce` fonksiyonundan geçirir; hamleler chess.js ile
  doğrulanır. Sunucu otoritesi yok — puansız olduğu için kabul edilebilir. Supabase anahtarı yoksa aynı
  tarayıcının sekmeleri arasında çalışır (yerel geliştirme ve uçtan uca testler).
- M3 bu protokolün yerine sunucu otoriteli, olay kaydına yazan sürümü koyar; P0'ın oda linkleri ve arayüzü
  korunur.

## Aşamalar (her biri bitince dur ve onay bekle)
- P0 Oynanabilir sürüm (yukarıda).
- M0 Kayıt çekirdeği (arayüz yok): olay türleri ve şema v1, hash zinciri, olay doğrulama, bellek adaptörü,
  projeksiyonlar (oyun durumu, G/M/B, puan), eklenti kayıtları ve `elo-v1`, ortak sözleşme testleri, PGN dışa
  ve içe aktarma, JSON satırları dışa ve içe aktarma. Bu aşamada olay formatı dondurulur.
- M1 Tahta ve yerel oyun: SVG tahta, temalar, taş setleri, iki kişi aynı cihazda; yerel oyunlar da aynı
  olay formatıyla kaydedilir; PGN dışa aktarma.
- M2 Hesaplar: giriş, profil (ad, takma ad, avatar), davetle gruba katılma, yönetici rolü, masa başı sonuç
  girme ve onaylama; Supabase adaptörü sözleşme testlerinden geçer.
- M3 Çevrimiçi oyun: meydan okuma, saat (canlı ve yazışmalı), canlı hamleler, teslim olma, beraberlik
  teklifi, yeniden bağlanma; maç bitince arşiv commit'i.
- M4 Turnuvalar: `round-robin-v1` ve `knockout-v1`, oluşturma, katılma, turlar, sonuçların oyunlardan
  otomatik gelmesi, eşitlik bozmalı sıralama tablosu, deneysel sıralamaların resmi olanın yanında gösterimi.
- M5 İstatistik ve geçmiş: profil (G/M/B, puan grafiği), maç geçmişi ve hamle hamle tekrar oynatma, ikili
  karşılaşma geçmişi, genel sıralama, WhatsApp paylaşımı.
- M6 Cila: PWA (ana ekrana ekleme), bildirimler (yazışmalı oyunda sıra sende), yönetici araçları, veri dışa
  aktarma, yedekleme, geri yükleme ve VPS'e taşıma dokümanı, README ekran görüntüleriyle.

## Kalite
- Kural, eşleştirme ve puan kodunun birim testleri olsun: bilinen PGN'ler, rok, en passant, terfi, pat,
  üç kez tekrar, 50 hamle kuralı; herkes herkesle biçiminde her çift tam bir kez karşılaşır, renkler dengelidir
  ve bay geçme adil dağıtılır; elemede beraberlik rövanş ve armageddon'a gider; Elo hesabı elle hesaplanmış
  örneklerle karşılaştırılır.
- Kaydın dayanıklılığı test edilir:
  - Tüm projeksiyonlar olay kaydından baştan üretildiğinde aynı sonucu verir (yeniden oynatma testi).
  - Dışa aktar → içe aktar → dışa aktar zinciri birebir aynı çıktıyı verir.
  - v1 olaylarından oluşan örnek dosyalar repoda kalıcı olarak saklanır; her yeni sürüm onları hâlâ
    okuyabilmelidir.
  - Güncelleme ve silme girişimleri veritabanında reddedilir; sıra numarası boşluğu reddedilir.
  - Ortadaki bir olayı değiştirmek hash zinciri doğrulamasında yakalanır.
  - Bir sonuç düzeltmesi geçmişi silmeden sıralamayı değiştirir.
  - Arşivden geri yükleme, orijinaliyle aynı sıralamayı üretir.
- Arayüzü Playwright ile 390 px ve 1280 px genişlikte dene: konsolda hata yok, yatay kaydırma yok, ekran
  görüntüsü al.
- İki tarayıcı sekmesiyle uçtan uca bir çevrimiçi maç oynat (Supabase'e ulaşılamıyorsa bellek adaptörüyle;
  bunu açıkça belirt).
