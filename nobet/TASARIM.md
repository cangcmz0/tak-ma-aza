# Nöbet: tasarım notu (v0.1)

## Fikir

Türkiye'de acil servis gecesi herkesin bildiği bir sahne: gece 3'te rapor almaya gelen, "bir iğne vurun geçer" diyen, internette okuyup kalp krizi geçirdiğine inanan hastalar ve onların arasında gerçekten ağır olan biri. Oyuncu stajyer doktor. Gerçek iş **önceliklendirme**: tıbbi aciliyet ile sosyal baskı (şikâyet, CİMER) arasında denge.

Tür: zaman yönetimi + çıkarım. Mobil, dikey, tek elle, 2,5–3 dakikalık geceler.

## Çekirdek döngü

1. Hasta bekleme salonuna gelir (6 sandalye; doluysa hasta geri çevrilir).
2. Hastaya dokun → kart açılır: şikâyet, söylediği söz, 4 yaşam bulgusu (nabız, SpO₂, tansiyon, ateş).
3. Alan seç: **Kırmızı** (resüsitasyon), **Sarı** (müşahede), **Yeşil** (poliklinik). En kötü bulgu rengi belirler.
4. Kart tedavi seçimine geçer: şikâyete uygun aleti seç (göğüs ağrısı → EKG, kırık şüphesi → röntgen…).
5. Tedavi süresi dolunca hasta ✓ olur; dokununca taburcu (kırmızı hasta servise yatırılır), yatak boşalır.

Bekleyen hasta kötüleşir: kırmızı ~30 sn, sarı ~70 sn içinde. Durumu sıfırlanan hasta **Kod Mavi**: dünya durur, halka kalbe değdiği an basarak 10 vuruşluk kalp masajı (7 doğru = kurtuldu). Yeşil hastanın sabrı biter: "CİMER'e yazacağım!" deyip gider.

## Kurallar (oyun eşikleri, tıbbi bilgi değil)

| Bulgu | Normal | Sarı | Kırmızı |
|---|---|---|---|
| Nabız /dk | 55–100 | 101–130 ya da 45–54 | >130 ya da <45 |
| SpO₂ % | ≥95 | 90–94 | <90 |
| Büyük tansiyon | 100–159 | 160–189 ya da 90–99 | ≥190 ya da <90 |
| Ateş °C | <38 | 38–39,9 | ≥40 |

Aynı şikâyet farklı aciliyetle gelebilir (göğüs ağrısı: kriz de olabilir, üç Türk kahvesi de). Şikâyet tedaviyi, bulgular alanı belirler. Oyuncu iki ayrı şey öğrenir.

## Hatalar ve bedelleri

| Durum | Sonuç |
|---|---|
| Hafife alma (kırmızıyı sarıya) | Başhekim −5, hasta yatakta da kötüleşir, tedavi 1,6 kat uzun |
| Gereksiz yüksek alan | Başhekim −2, değerli yatak boşa gider |
| Yanlış tedavi | Başhekim −4, hasta biraz kötüleşir |
| CİMER şikâyeti | Başhekim −12 |
| Salon dolu, hasta geri çevrildi | Başhekim −6 |
| Kod Mavi başarısız, yoğun bakıma sevk | Başhekim −25 |

Başhekim memnuniyeti 80'den başlar, her taburcu +2. Sıfırlanırsa "Başhekim seni odasına çağırdı": gece biter.

**Yıldızlar:** 1 = sabaha kadar dayan · 2 = gelenlerin %60'ı taburcu ve Başhekim 50+ · 3 = %75 taburcu, %85 doğru triaj, hiç sevk yok. 1 yıldız sonraki geceyi açar.

## Geceler

| # | Ad | Yenilik |
|---|---|---|
| 1 | İlk Nöbet | Eğitim: ilk 3 hasta elle seçilmiş (yeşil, sarı, kırmızı), adım adım ipucu, doğru alan ve alet gösterilir |
| 2 | Cuma Gecesi | Oksijen ve serum, nefes darlığı, kusma, ateş. 112 ambulansları. Öneri yok, bulgular hâlâ renkli |
| 3 | Derbi Gecesi | İğne: alerji, tansiyon, "iğne isteyen" hasta. Göğüs ağrısı çok |
| 4 | Bayram Arifesi | Renk ipuçları kapanır. 3. kırmızı yatak açılır. Kusma çok |
| 5 | Kar Fırtınası | En hızlı akış. Düşme ve nefes darlığı çok |
| 6+ | Sonsuz | Her gece biraz daha hızlı ve ağır |

## Denge

`test/game.test.ts` içindeki bot doktor her geceyi oynar. Hamle başına ~1,1 sn düşünen, %95 doğru oyuncu her geceyi en az 2 yıldızla bitirmeli; ~3 sn düşünen, %70 doğru oyuncu 5. gecede kovulmalı. Bütün sayılar `src/game.ts` içindeki `BAL` nesnesinde.

## v0.1'de olmayanlar (sıradaki adaylar)

- **Günün Nöbeti:** tarihten tohum, herkese aynı gece, Wordle gibi paylaşım kartı (kod hazır: üretici tohumlu).
- **Hasta yakını olayları:** "Hocam önce bize bakın!" diye bağıran refakatçi, dokunup sakinleştirme.
- **Kırmızı hastada iki adımlı tedavi** (EKG → ilaç gibi).
- **Yorgunluk ve çay molası:** sabaha doğru dokunuşlar yavaşlar.
- Emoji yerine tek tip çizim karakterler, müzik.
- Capacitor ile Android paketi, ödüllü reklam (Kod Mavi'de ikinci şans, puanı ikiye katla).

## Bilinen eksikler

- Kod Mavi sırasında uygulamadan çıkılırsa masaj başarısız sayılır.
- Yazı tipleri Google Fonts'tan gelir; Android paketinde dosyaya gömülmeli.
