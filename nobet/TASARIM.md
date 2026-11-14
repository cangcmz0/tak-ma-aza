# Nöbet: tasarım notu (v0.2)

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

## Günün Nöbeti

Menünün en üstünde. Tarihten tohum alır: o gün herkese aynı hastalar aynı sırayla gelir. Gelişler gece başında önceden hesaplanır, oyuncunun hamleleri sırayı değiştirmez. Tema tarihe göre döner (Polen Mevsimi, Düğün Sezonu, İlk Kar, Sınav Haftası…). Bütün şikâyetler açık, bulgular renkli ama öneri yok.

- İlk nöbeti bitirince açılır.
- Günün **ilk denemesi** kayda geçer; sonrakiler antrenman.
- Art arda günler 🔥 seri yapar.
- Sonuç Wordle gibi paylaşılır: her gelen hasta bir kare (🟥🟨🟩 doğru alanla taburcu, 🟧 yanlış alan, ⬛ kaybedildi, ⬜ sabaha devredildi).

```
🏥 NÖBET · Günün Nöbeti 14 Kasım ★★☆
🟩🟨🟩🟥🟩⬛🟨🟩
🟨🟩🟧🟩🟥🟨🟩🟩
1240 puan · 🎯 %88 · 🔥 3 gün
```

## Hasta yakını (3. geceden itibaren)

Ara sıra en uzun bekleyen hastanın yakını bağırmaya başlar ("Hocam önce bize bakın!", "Benim dayım burada müdür!"). Jetonda 📢 ve azalan bir halka çıkar. 9 saniye içinde:

- jetona dokunursan sakinleşir (+5 puan), ya da
- hastayı yatağa alır veya tedaviye başlarsan kendiliğinden susar.

Bekletirsen kavga çıkar: Başhekim −8.

## Seri ve unvan

- Art arda her doğru triaj seriyi büyütür: triaj puanı 5, 8, 11… en fazla 20. Yanlış alan ya da yanlış tedavi seriyi sıfırlar.
- Toplam yıldız unvanı belirler: Stajyer (0), Asistan (3), Uzman (7), Doçent (12), Profesör (16).

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
| Hasta yakını kavga çıkardı | Başhekim −8 |

Başhekim memnuniyeti 80'den başlar, her taburcu +2. Sıfırlanırsa "Başhekim seni odasına çağırdı": gece biter.

**Yıldızlar:** 1 = sabaha kadar dayan · 2 = gelenlerin %60'ı taburcu ve Başhekim 50+ · 3 = %75 taburcu, %85 doğru triaj, hiç sevk yok. 1 yıldız sonraki geceyi açar.

## Geceler

| # | Ad | Yenilik |
|---|---|---|
| 1 | İlk Nöbet | Eğitim: ilk 3 hasta elle seçilmiş (yeşil, sarı, kırmızı), adım adım ipucu, doğru alan ve alet gösterilir |
| 2 | Cuma Gecesi | Oksijen ve serum, nefes darlığı, kusma, ateş. 112 ambulansları. Öneri yok, bulgular hâlâ renkli |
| 3 | Derbi Gecesi | İğne: alerji, tansiyon, "iğne isteyen" hasta. Bağıran hasta yakınları. Göğüs ağrısı çok |
| 4 | Bayram Arifesi | Renk ipuçları kapanır. 3. kırmızı yatak açılır. Kusma çok |
| 5 | Kar Fırtınası | En hızlı akış. Düşme ve nefes darlığı çok |
| 6+ | Sonsuz | Her gece biraz daha hızlı ve ağır |

## Denge

`test/game.test.ts` içindeki bot doktor her geceyi oynar. Hamle başına ~1,1 sn düşünen, %95 doğru oyuncu her geceyi en az 2 yıldızla bitirmeli; ~3 sn düşünen, %70 doğru oyuncu 5. gecede kovulmalı. Bütün sayılar `src/game.ts` içindeki `BAL` nesnesinde.

## Sıradaki adaylar

- **Kırmızı hastada iki adımlı tedavi** (EKG → ilaç gibi).
- **Yorgunluk ve çay molası:** sabaha doğru dokunuşlar yavaşlar.
- Emoji yerine tek tip çizim karakterler, müzik.
- Capacitor ile Android paketi, ödüllü reklam (Kod Mavi'de ikinci şans, puanı ikiye katla).

## Bilinen eksikler

- Günün Nöbeti telefonun yerel tarihine bakar; saat dilimi farklı iki oyuncu gece yarısı civarında farklı günü görebilir.
- Yazı tipleri Google Fonts'tan gelir; Android paketinde dosyaya gömülmeli.

## Sürüm notları

- **v0.2:** Günün Nöbeti, günlük seri, emoji sonuç kareleri, hasta yakınları, triaj serisi, unvanlar. Gelişler önceden hesaplanıyor. Kod Mavi sırasında uygulamadan çıkıp dönünce masaj baştan başlıyor.
- **v0.1:** İlk oynanabilir sürüm: 5 gece, triaj, tedavi, Kod Mavi.
