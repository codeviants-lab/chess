# Satranç Kulübü

Bir WhatsApp grubu için satranç ve turnuva uygulaması: kayıt, uygulama içinde saatli oyunlar (canlı ve
yazışmalı), turnuvalar, galibiyet / mağlubiyet / beraberlik, puan ve maç geçmişi. Oyun kayıtları değişmez,
hash zinciriyle mühürlenmiş bir olay kaydında tutulur; biten her oyun ayrıca bir arşiv reposuna PGN olarak
yazılır.

Durum: planlama bitti, kod henüz yok. Gereksinimler ve kararlar [SPEC.md](SPEC.md), ilerleme
[PROGRESS.md](PROGRESS.md).

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

MIT — bkz. [LICENSE](LICENSE).
