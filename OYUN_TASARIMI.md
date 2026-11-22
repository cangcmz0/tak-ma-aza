# Oyun Tasarım Notları

> Başlangıç: 19 Kasım 2026
> Bu dosya, birlikte tasarladığımız oyunun tüm fikirlerini ve kararlarını toplar.
> Sabah son hali derli toplu metin olarak teslim edilecek.

## 0. Pazar Araştırması (20 Kasım 2026)
Ayrıntılı rapor: `reports/2026-11-20-insight-report.md`

**Türkiye'de şu an popüler olanlar:**
- Mobil: bulmaca (Türk stüdyolarının gelirinin ~%97'si), merge/çiftlik (Hay Day, Gossip Harbor, Travel Town), MOBA/battle royale (MLBB, PUBG), yerel kart oyunları (101 Okey)
- PC (Steam TR): CS2, Euro Truck Simulator 2, Football Manager 27, EA FC 27
- Küresel yükselenler: kedili sudoku (Meowdoku), kum blok bulmacası (Sand Blocks), halka döndürme (Rotate Rings), ip sıralama (Yarn Loop)

**Aday yönler (seçilecek):**
- A) Sevimli tema + klasik mantık bulmacası
- B) "Satisfying" fizik bulmacası (kum, ip, sıvı, döndürme)
- C) Türk kültürü temalı casual oyun (çay ocağı, simitçi, çarşı, mahalle)
- D) PC: küçük simülasyon / menajerlik

**Kaçınılacaklar:** match-3, merge + hikâye, battle royale/MOBA (devlerin sahası)

## 1. Oyunun Fikri
**Karar (20 Kasım 2026):** Bir **bulmaca oyunu** yapılacak.
Gerekçe: Para bulmaca oyunlarında. Türk stüdyolarının gelirinin ~%97'si bulmacadan geliyor (bkz. Pazar Araştırması).

- Bulmaca oyunu çiftlik temalı **olmak zorunda değil**; çiftlikle bağlantı kurulmayacak.
- Çiftlik oyunu fikri ileride, para kazanılırsa ayrı bir proje olarak düşünülebilir.

**Mekanik seçimi (20 Kasım 2026):** 1 numara — **kum bulmacası** ile başlanacak.
- Kural: Parçalar tahtaya bırakılınca kuma dönüşüp akar; aynı renk kum soldan sağa kesintisiz yol oluşturunca patlar.
- İlk oynanabilir örnek: `prototip/kum-akisi.html` (çalışma adı "Kum Akışı")
- Referans oyun: Sand Blocks: Drop Puzzle (Ekim 2026'da aylık +%419 büyüme)

**✅ KESİN KARAR (20 Kasım 2026): Bu oyunu yapıyoruz — kum bulmacası.**

**Taslak yol haritası:**
| Aşama | İş | Tahmini süre |
|---|---|---|
| 1 | Farklılaştırma + tema kararı; oyun hissi (ses, titreşim, patlama efekti) | 1–2 hafta |
| 2 | Bölüm sistemi (hedefli bölümler), ilk 30 bölüm, kayıt | 2 hafta |
| 3 | Görsel tema, menüler, ilk açılış öğreticisi | 2 hafta |
| 4 | Test: web portalı ve/veya Play Store kapalı test; TikTok/Reels videoları | 1–2 hafta |
| 5 | Ödüllü reklam + mağazaya çıkış | 1 hafta |

**Teknik öneri:** Web teknolojisiyle devam (prototip zaten web'de). Önce web'de test,
sonra aynı kod Android/iOS uygulamasına paketlenir. Ucuz ve hızlı.

**Sıradaki kararlar:** bizi farklı kılacak özellik, tema, ekip (kim kodlar/kim çizer), bütçe.

**Tema fikri:** Baharat çarşısı — kum yerine renkli baharatlar (pul biber, zerdeçal, sumak, nane).

## 2. Tür / Platform
- **Tür:** Kum bulmacası (casual puzzle)
- **Platform: MOBİL** (karar: 20 Kasım 2026)
  - Önerilen sıra: önce **Android** (Play Store tek seferlik ~25 $), sonra **iOS** (Apple yıllık ~99 $, derleme için Mac gerekir)
  - Önerilen teknik: Web teknolojisi (TypeScript + Canvas) + **Capacitor** ile Android/iOS uygulamasına paketleme
    - Artısı: prototip zaten bu teknolojide, hızlı ilerler, reklam (AdMob) eklentisi var
    - Eksisi: bazı yayıncılar Unity ile yapılmış oyunları tercih eder (yayıncıyla çalışılacaksa tekrar değerlendirilir)

## 3. Temel Oynanış (Core Loop)
_(henüz belirlenmedi)_

## 4. Karakterler / Dünya / Hikâye
_(henüz belirlenmedi)_

## 5. Mekanikler ve Kurallar
_(henüz belirlenmedi)_

## 6. Görsel ve Ses Tarzı
_(henüz belirlenmedi)_

## 7. Açık Sorular
- 

## 8. Not Defteri (konuşma sırasında gelen ham fikirler)
- **20 Kasım 2026:** Hay Day tarzı bir çiftlik oyunu konuşuldu. Birebir o ölçekte yapmak küçük ekip için çok zor
  (yüzlerce ürün, üretim zincirleri, oyuncular arası ticaret, sunucu, sürekli etkinlik, dev reklam bütçesi).
  Küçültülmüş seçenekler:
  1. **Mini çiftlik (offline):** 10–15 ürün, kısa üretim zinciri, tek oyunculu
  2. **Idle / tycoon çiftlik:** Oyun kapalıyken de üretim; içerik ihtiyacı az
  3. **Çiftlik + bulmaca karışımı:** Çiftlik temayı ve ilerlemeyi taşır, asıl oynanış bulmaca
  4. **Yerel tema:** Karadeniz çay/fındık bahçesi, köy fırını, Ege zeytinliği vb.
  - Açık soru: Hay Day'de seni çeken ne? (sakin çiftçilik, üretim zinciri, süsleme, arkadaşlarla ticaret)
