# NAKLİYE BARONU — Oyun Tasarım Dokümanı (GDD) v0.1

> **Yön değişikliği (v0.2 taslağı):** Oyun sadece nakliye olmaktan çıkıp **"Sıfırdan Holding"** adıyla genişletildi: 11 şehir, küçük işletmeler (çay ocağı, büfe, döner salonu…), inşaat ve daire satışı, sektör şirketleri, şirketleşme basamakları (Şahıs → Ltd. → A.Ş. → Holding → Halka Açık Holding), ihaleler, altın ve döviz. Oynanabilir taslak: `demo/sifirdan-holding.html`. Aşağıdaki ekonomi, para kazanma ve teknik bölümler geçerliliğini korur; tema ve içerik bölümleri yeni kapsama göre güncellenecek. Nakliye artık holdingin sektörlerinden biridir.

> Tür: 2D arayüz tabanlı, metin ve istatistik odaklı ticaret / yatırım / yönetim simülasyonu
> Platform: iOS + Android (tek kod tabanı)
> Hedef kitle: 18–45 yaş, Türkiye; "Müteahhit Simülasyonu", futbol menajerlik ve borsa uygulaması kullanıcıları
> Oturum hedefi: Günde 6–10 kısa oturum (2–5 dk) + 1–2 uzun oturum (15–25 dk)

---

## 1. Özgün Konsept ve Tema

### 1.1 Alternatif Temalar

| # | Tema | Kanca (Hook) | Viral Potansiyel | Risk / Zayıf Yön |
|---|------|--------------|------------------|------------------|
| A | **Nakliye Baronu – Lojistik İmparatorluğu** | Babadan kalma tek kamyonetten Kapıkule'yi, Mersin Limanı'nı ve Orta Koridor'u yöneten holdinge | Çok yüksek: tırcı kültürü, akaryakıt zamları, Kapıkule kuyruğu, "Tır şoförü maaşı" gündemleri, kısa video formatına uygun "ilk tırımı aldım" anları | Global rakipler (trucking tycoon) var; Türkiye'ye özgü olaylarla ayrışmak zorunlu |
| B | **Bereket Holding – Tarım ve Gıda** | Ege'de 20 dönüm zeytinlikten fındık, çay, un fabrikası ve ihracat markasına | Yüksek: gıda fiyatları her gün gündemde, "domates 80 lira" esprileri, köyden kente/kentten köye göç trendi | Döngü yavaş (hasat mevsimi), aksiyon hissi düşük |
| C | **Rezerv – Enerji ve Maden Baronu** | Trakya'da küçük gaz kuyusundan Gabar petrolüne, Beylikova nadir toprak elementlerine | Çok yüksek: "petrol bulduk" anları milli gurur ve ekran görüntüsü paylaşımı üretir | Referans oyundaki "kuru kuyu" mekaniğine fazla benzer, ilerleme dar; içerik çeşitliliği sınırlı |

Elenen öneri: Teknoloji ve Savunma Sanayi. Hype'ı yüksek, ancak mağaza politikaları, gerçek kurum/ürün isimlerini kullanamama ve hassas içerik riski nedeniyle ilk oyun için uygun değil. İleride "Teknopark" genişlemesi olarak değerlendirilebilir.

### 1.2 Seçilen Tema: **NAKLİYE BARONU** (A)

Neden en güçlüsü:
- **Anlaşılır ilerleme:** Kamyonet → kamyon → TIR → depo → liman → demiryolu → kargo uçağı. Her basamak görsel olarak ve rakam olarak hissedilir.
- **Doğal olay motoru:** Akaryakıt zammı, asgari ücret artışı, köprü/otoyol zammı, sınır kapısı kuyruğu, kar yağışında kapanan geçitler, kanal tıkanması, gümrük mevzuatı. Türkiye gündemi her ay yeni içerik verir (canlı operasyon için ideal).
- **Risk mekaniklerine uygun:** İhale, rota seçimi ve gümrük müzayedesi kumar değil, bilgiye dayalı karar mekanikleridir.
- **Genişleme:** B teması ileride "Holding" katmanında tarım ürünü taşıma sözleşmeleri olarak eklenebilir. C teması (enerji, kuyu, rezerv) rakip oyuna fazla yakın olduğu için yol haritasından çıkarıldı (bkz. 1.4).

### 1.3 Ana Hikaye

- **Başlangıç:** Oyuncu, 30 yıl direksiyon sallamış **Rahmi Usta**'nın çocuğudur. Rahmi Usta emekli olurken geriye 2009 model bir kamyonet, 1,5 milyon ₺ birikim ve tefeciye ödenmemiş bir senet bırakır.
- **Antagonist:** Sektörün devi **Demirkol Lojistik** ve patronu **Cevdet Demirkol**. İhalelerde rakip, krizlerde fırsatçı, final bölümünde satın alma (devralma) hedefi.
- **Mentor:** Rahmi Usta, kahvehanedeki "Usta'nın Tavsiyesi" kartlarıyla öğretici rolünü üstlenir (tutorial metin olarak, sıkıcı değil, esprili).
- **Bölümler (Çağlar):**

| Çağ | Konum | Açılan Sistem | Hikaye Hedefi |
|-----|-------|---------------|---------------|
| 1. Esnaf | İstanbul içi dağıtım | Araç alımı, sefer, bakım | Senedi öde, ilk kamyonu al |
| 2. Şehirlerarası | Ankara, İzmir, Bursa hatları | Şoför istihdamı, ihale | Demirkol'dan ilk ihaleyi kap |
| 3. Filo | Gebze / Hadımköy depo | Depo, filo müdürü, kredi notu | 25 araçlık filo |
| 4. Uluslararası | Kapıkule, Habur, Sarp | Gümrük, döviz, rota riski | Avrupa ve Irak hattı |
| 5. Liman | Mersin, Ambarlı | Konteyner, müzayede | Kendi liman terminalin |
| 6. Koridor | Kars–Tiflis–Bakü demiryolu | Çok modlu taşımacılık | Orta Koridor'un baş oyuncusu |
| 7. Holding | Borsa İstanbul | Halka arz (prestij sıfırlaması) | Demirkol'u satın al |

- **İlerleme hissi:** Her çağda ekran teması değişir (kahvehane masası → plaza ofisi → holding toplantı salonu), unvan yükselir (Şoför → Esnaf → Patron → Ağa → Baron → Holding Başkanı), "Net Değer" bir sonraki unvana ilerleme çubuğu olarak her zaman görünür.

### 1.4 Rakip Analizi ve Özgünlük Kuralları

Referans oyun: **Müteahhit – Builder Tycoon** (App Store, geliştirici Emrecan Yardımcı). Mağaza bilgisine göre oyuncu Türkiye veya Almanya'da başlar, 81 ilde arsa alır, proje tasarlar, katları yükseltir, daireleri satar; son sürümlerde oyuncular arası ortak canlı borsa eklenmiştir. Oyuncunun paylaştığı görselde ayrıca "kuru kuyu / rezerv bulma" tipi bir şans mekaniği bulunmaktadır.

**Bilinçli olarak kaçındığımız şeyler**

| Müteahhit'te olan | Nakliye Baronu'nda yerine gelen |
|-------------------|--------------------------------|
| Arsa al → bina dik → daire sat (stok birikimi ve satış) | **Akış ekonomisi:** Para, yolda olan seferlerden ve sözleşmelerden gelir. Binalar satılmaz, operasyon tesisidir (depo, terminal) |
| İl il arsa haritası, ülke seçimi | Tek başlangıç (Türkiye), büyüme **hatlar ve koridorlar** üzerinden: Marmara → Ankara → Kapıkule → Orta Koridor |
| Arsa spekülasyonu | **Hat ruhsatları ve geçiş belgeleri** (CEMT kotası, liman slotu): kotalı, devredilebilir, gelire kalıcı bonus |
| Oyuncular arası ortak borsa | Sosyal katman olarak **konsorsiyum ihaleleri** (oyuncular büyük ihaleye birlikte girer) ve sezonluk koridor ligi |
| Kuru kuyu / rezerv şans mekaniği | Olasılığı açık **rota seçimi**, **kapalı zarf ihale** ve **gümrük müzayedesi**; enerji/kuyu teması tamamen yok |
| Kat/daire görseli | Yol levhası, plaka, irsaliye ve takograf görsel dili |

**Yalnızca bizde olan imza sistemler**
1. **Şoför kadrosu:** Memleketi, huyu ve seviyesi olan isimli şoförler (Rizeli Temel: hızlı; Sivaslı Hüsniye: dikkatli; Karslı Cemal: kış kurdu). Sefere kimin çıkacağı rota riskini ve kârı değiştirir; başarılı seferle seviye atlarlar. Oyuncunun duygusal bağ kurduğu katman budur.
2. **Rota kararları:** Her sefer küçük bir strateji anıdır (süre, risk, sigorta, şoför eşleşmesi).
3. **Hat ruhsatları:** Gerçek sektör belgelerinden esinlenen kotalı ve devredilebilir yatırım.
4. **Türkiye lojistik gündemi olay motoru:** Kapıkule kuyruğu, kantar cezası, akaryakıt gece zammı, asgari ücret farkı, Süveyş tıkanması.

**Hukuki ve mağaza kuralları**
- Rakip oyunun adını, görselini, metnini, menü yapısını ve ikonlarını kullanmıyoruz; mağaza açıklamasında rakibin adı geçmeyecek.
- Mağaza anahtar kelimelerinde "müteahhit" kullanılmayacak (ASO'da marka çakışması ve şikâyet riski).
- Yayından önce "Nakliye Baronu" adının App Store, Google Play ve TÜRKPATENT'te boş olduğu kontrol edilecek.

---

## 2. Çekirdek Oyun Döngüsü ve Mekanikler

### 2.1 Zaman Modeli

- Aktif oyunda **1 oyun günü = 10 saniye** → 1 ay = 5 dk, 1 yıl = 1 saat.
- Uzun seferler gerçek zamanlı zamanlayıcı ile çalışır (15 dk – 8 saat). Zamanlayıcı sunucu saatine bağlanır (hile koruması).
- Çevrimdışı kazanç: en fazla 8 saat, %40 verimle (reklamla 2 katı).

### 2.2 Çekirdek Döngü

```
Sermaye ─► Yatırım (araç/depo/ruhsat) ─► Sefer/İhale/Sözleşme ─► Gelir
   ▲                                                              │
   │                                                              ▼
Büyüme / Unvan  ◄── Vergi + Bakım + Kriz (para eritme) ◄── Risk kararı
```

**Mikro döngü (30 sn – 2 dk):** Sefer ata → tamamlananı tahsil et → olay kartına karar ver.
**Orta döngü (5–30 dk):** İhaleye gir, araç al, kredi çek/öde, şoför işe al.
**Makro döngü (gün – hafta):** Yeni çağ aç, depo/liman kur, halka arz (prestij) yap.

### 2.3 Oyuncunun İlk 15 Dakikası (Adım Adım)

1. **0:00** Ara sahne metni: Rahmi Usta'nın vedası, anahtarı ve senedi teslim etmesi.
2. **0:30** İlk sefer: Kadıköy → Ümraniye mobilya teslimatı. Tek tuş, 20 saniye. İlk gelir animasyonu.
3. **1:30** İlk olay kartı: "Kantar memuru tonajı fazla diyor." (Ceza öde / itiraz et) — risk/ödül kavramı öğretilir.
4. **3:00** İkinci kamyonet satın alma (öğretici para hediyesi ile garanti).
5. **5:00** İlk **aylık kapanış**: gelir, gider, vergi tablosu. Enflasyon kavramı tanıtılır ("Kasadaki para eriyor, yatırıma çevir").
6. **8:00** İlk **ihale** (kazanması kolay ayarlanmış).
7. **10:00** İlk **riskli rota** teklifi; olasılık ve beklenen kâr gösterilir.
8. **12:00** Banka kredisi tanıtımı; kredi notu ve faiz.
9. **15:00** Senet ödeme hedefi + "Çağ 2'ye 3 adım kaldı" ilerleme çubuğu. Oturum sonunda çevrimdışı kazanç vaadi.

### 2.4 Ana Sistemler

| Sistem | Açıklama |
|--------|----------|
| **Sermaye Yönetimi** | Nakit, borç, kredi notu (AAA → CCC). Nakit enflasyonla erir; yatırım ve borç dengesi ana stratejidir. |
| **Ruhsat / Belge** | K1 (yurtiçi), C2 (uluslararası), R2 (depo), Liman işletme ruhsatı. Her ruhsat bir çağı açar; ücretli ve bekleme süreli (reklamla kısalır). |
| **Filo** | Araç yaşı, bakım seviyesi, arıza olasılığı, ikinci el değeri. |
| **Personel** | Şoför (yevmiye, yorgunluk), filo müdürü (yönetim maliyetini düşürür), muhasebeci (vergi optimizasyonu), avukat (ceza indirimi). |
| **İtibar** | 0–100. Zamanında teslimat ve dürüst kararlarla artar; ihale kazanma şansı ve navlun fiyatına çarpan olarak etki eder. |
| **İflas** | Nakit 15 gün boyunca ekside kalırsa haciz/iflas. Bir defalık "Konkordato" kurtarma hakkı (reklam veya altın). İflas = kalıcı kayıp değil, prestij puanının bir kısmı korunur. |

### 2.5 Şans + Strateji Mekanikleri (Kumar Hissi Vermeyen Risk)

Tasarım ilkeleri (her üç mekanik için geçerli):
- **Olasılık her zaman görünür.** Oyuncu "%62 başarı, beklenen kâr +180.000 ₺" bilgisini görmeden karar vermez.
- **Bilgi satın alınabilir.** Para, zaman veya ödüllü reklam ile belirsizlik daraltılır; şans değil bilgi satılır.
- **Gerçek parayla doğrudan şans satın alınamaz.** Loot box / kasa açma yoktur (mağaza ve mevzuat riski sıfırlanır).
- **Kötü şans koruması:** Üst üste 2 başarısızlıktan sonra bir sonraki denemede "Tecrübe bonusu" (+%15).
- **Kayıp sınırlı:** Tek bir risk kararı en fazla toplam varlığın %20'sini riske atabilir.

#### Mekanik 1 — Kapalı Zarf İhale

- Kamu ve özel ihaleler (ör. "Belediye çöp konteyneri taşıma, 12 ay").
- Her ihalenin **tahmini maliyeti** M gösterilir. 3–6 yapay zekâ rakip teklif verir.
- Rakip teklifleri: `b_i ~ Normal(μ = M·(1 + m_i), σ = M·s_i)`; m_i rakibin hedef kâr marjı, s_i belirsizliği.
- Oyuncu teklif `b` girer. Kazanma olasılığı: `P(kazan | b) = Π_i [1 − F_i(b)]`.
- Ekranda kaydırıcı ile teklif değiştirdikçe **kazanma olasılığı** ve **beklenen kâr** `E = P(b)·(b − M_gerçek)` canlı güncellenir.
- **Kazananın laneti:** Gerçek maliyet `M_gerçek = M·(1 + ε)`, ε ~ U(−%8, +%15). Çok düşük teklif kazanır ama zarar ettirir.
- **İstihbarat:** "Sektör dedikodusu" (para), "Ofiste çay sohbeti" (ödüllü reklam) ile bir rakibin m_i aralığı daraltılır.
- Strateji: Oyuncu matematik değil sezgi kullanır; ama sezgisi dürüst verilerle beslenir.

#### Mekanik 2 — Rota Seçimi ve Sefer Riski

Her uzun seferde 3 rota sunulur:

| Rota | Süre | Kâr | Risk Olayı Olasılığı | Örnek |
|------|------|-----|----------------------|-------|
| Güvenli | Uzun | Düşük | %5 | Otoyol, ücretli köprü |
| Standart | Orta | Orta | %15 | Devlet yolu |
| Riskli | Kısa | Yüksek | %35 | Kışın Zigana / Kop geçidi |

- Risk olayı gerçekleşirse: gecikme (itibar −), hasar (bakım maliyeti), yük kaybı (sigorta yoksa tam kayıp).
- **Hava durumu raporu** (ücretsiz, %70 doğru) ve **meteoroloji uzmanı** (ücretli, %90 doğru) olasılığı netleştirir.
- **Sigorta seçimi** (hedge): Prim = Yük değeri × olasılık × 1,25. Oyuncu riski satın alarak değil, devrederek yönetir.
- Beklenen değer formülü ekranda: `E = (1 − p)·Kâr_rota − p·Kayıp_beklenen − Prim`.

#### Mekanik 3 — Gümrük Müzayedesi (Sahipsiz Konteyner)

- Haftalık müzayede: Limanda sahipsiz kalmış 5 konteyner.
- Her konteynerin **manifest ipucu** vardır: "Tekstil, 18 ton, menşei Çin".
- Değer dağılımı kategoriye göre bilinir (ör. tekstil 400 bin – 2,2 milyon ₺). Oyuncu bunu açık artırma ekranında görür.
- **Ekspertiz** (para veya ödüllü reklam): Değer aralığını %50 daraltır.
- Açık artırma, 3 yapay zekâ alıcıya karşı 3 turdur; rakipler de aynı ipuçlarına göre teklif verir.
- İçerik nadiren "kaçak eşya" çıkabilir: oyuncu yetkililere teslim eder → para kaybı yok değil, ama **itibar +10** (ahlaki ödül; kayıp telafi edilir).
- Kumar değildir, çünkü: dağılım açık, bilgi alınabilir, rakip davranışı okunabilir, gerçek para ile konteyner alınamaz.

---

## 3. Matematiksel Ekonomi ve Denge

### 3.1 Başlangıç Değerleri

| Parametre | Değer |
|-----------|-------|
| Başlangıç nakdi | 1.500.000 ₺ |
| Başlangıç aracı | 1 × Kamyonet (piyasa değeri 900.000 ₺) |
| Başlangıç borcu (hikaye senedi) | 600.000 ₺, 6 ay vade, faizsiz |
| Aylık enflasyon (başlangıç) | %2,5 (yıllık ≈ %34) |
| Kurumlar vergisi | %25 (aylık kâr üzerinden, zarar devreder) |
| İflas toleransı | 15 gün eksi bakiye |

Tüm parametreler **Remote Config** üzerinden canlıda değiştirilebilir olmalıdır (güncelleme yayınlamadan denge ayarı).

### 3.2 Enflasyon ve Fiyat Endeksi

```
Fiyat endeksi:      I(t+1) = I(t) · (1 + π(t))                 (her ay)
Enflasyon yürüyüşü: π(t+1) = clamp(π(t) + κ·(π* − π(t)) + ε, π_min, π_max)
                    κ = 0,3   π* = %2,5   ε ~ U(−0,6%, +0,6%)   π ∈ [%0,8 ; %6]
Tüm fiyatlar:       Fiyat(t) = Fiyat_baz · I(t)
```

- Gelirler ve giderler endeksle birlikte büyür; **nakit büyümez**. Bu, oyuncuyu sürekli yatırıma iten ana "sessiz para eritici"dir.
- Şok olayları: "Kur şoku" (π bir ay +%3), "Sıkı para politikası" (π düşer, faiz yükselir).

### 3.3 Faiz ve Kredi

```
Politika faizi (yıllık):  r_p = (1 + π)^12 − 1 + reel_marj      reel_marj = %3
Kredi faizi:              r_k = r_p + risk_primi(not)           AAA:+%2 … CCC:+%15
Mevduat faizi:            r_m = r_p − %6
Kredi limiti:             L = 0,5 · (Filo değeri + Gayrimenkul değeri) − Mevcut borç
Kredi notu skoru:         S = 40·(1 − Borç/Varlık) + 30·min(1, NakitAkışı/Taksit) + 30·(İtibar/100)
```

- Mevduat faizi her zaman enflasyonun altındadır → nakitte beklemek kaybettirir.
- Kredi faizi enflasyonun üzerindedir → kaldıraç ancak ROI'si yüksek yatırımlarda kârlıdır (öğretici ve gerçekçi).

### 3.4 Sefer Ekonomisi

```
Gelir   = Mesafe(km) · Yük(ton) · Navlun(₺/ton-km) · I(t) · Talep(t) · (1 + İtibar/200)
Yakıt   = Mesafe · Tüketim(L/km) · YakıtFiyatı(t)
Şoför   = Gün · Yevmiye(t)
Gider   = Yakıt + Şoför + Otoyol/Köprü + Sigorta + Amortisman
Net     = Gelir − Gider
Talep(t) = 1 + 0,15·sin(2π·ay/12) + şok          (mevsimsellik: Kasım–Aralık zirve)
```

### 3.5 Araç Değeri ve Arıza

```
Değer(yaş)      = Fiyat · (1 − 0,15)^yaş
Arıza olasılığı = 0,01 · (1 + yaş/5) · (1 − Bakım/100) · RotaÇarpanı     (sefer başına)
```

### 3.6 Yönetim Karmaşası (Yumuşak Tavan)

```
Günlük genel gider = (4.000 + 800 · N^1,15) · I(t)      N = araç sayısı
Filo müdürü etkisi: üs 1,15 → 1,08 (her müdür 15 aracı yönetir)
```

Süper-lineer genel gider, oyuncunun sonsuz araç yığmasını engeller ve bir sonraki çağa (depo, liman) geçişi teşvik eder.

### 3.7 Vergi

| Vergi | Formül |
|-------|--------|
| Kurumlar vergisi | Aylık kâr > 0 ise %25; zararlar 12 ay devreder |
| MTV | Yıllık, araç başına `Fiyat · %1,5 · I(t)` |
| SGK primi | Personel başı `Maaş · %22,5` |
| KDV (basitleştirilmiş) | Gelir · %20 − Gider · %20, pozitif fark ödenir |
| Denetim | Bkz. 3.9 |

### 3.8 ROI (Geri Dönüş Süresi) Hedefleri

```
ROI_gün = Yatırım / Günlük net nakit akışı
Çağın amiral yatırımı için hedef (aktif oyun, 1 gün = 10 sn):
T_ROI(çağ) = 14 dk · 1,5^(çağ − 1)
```

| Çağ | Örnek Yatırım | Fiyat (I=1) | Günlük Net | ROI (oyun günü) | ROI (gerçek, aktif) |
|-----|---------------|-------------|-----------:|----------------:|--------------------:|
| 1 | Kamyonet | 900.000 ₺ | 11.000 ₺ | ~82 | ~14 dk |
| 2 | Kamyon | 2.400.000 ₺ | 26.000 ₺ | ~92 | ~15 dk |
| 3 | TIR + dorse | 6.500.000 ₺ | 65.000 ₺ | ~100 | ~17 dk |
| 3 | Depo (Gebze) — amiral | 45.000.000 ₺ | 240.000 ₺ | ~188 | ~31 dk |
| 5 | Liman terminali — amiral | 1,2 Mr ₺ | 2.800.000 ₺ | ~430 | ~72 dk |
| 6 | Demiryolu vagon filosu — amiral | 4 Mr ₺ | 6.300.000 ₺ | ~635 | ~106 dk |

Kurallar:
- Her yeni seviye **mutlak kazancı** büyük oranda artırır ama **ROI süresini uzatır**. Böylece oyuncu her zaman "bir sonraki büyük yatırım" için biriktirir.
- Araçlar "küçük yatırım"dır ve eğrinin altında kalır (hızlı dopamin); amiral yatırımlar eğriyi belirler (uzun hedef).
- Çevrimdışı süre de %40 verimle ilerlemeye sayılır; geç çağlarda ROI'nin önemli kısmı çevrimdışı tamamlanır (geri dönme motivasyonu).

### 3.9 Para Eritme (Money Sink) Mekanikleri

Hedef: Orta oyunda toplam para eritme brüt gelirin **%35–45'i** olmalı.

**Zorunlu (sürekli) giderler**
- Bakım: Araç başı aylık `Fiyat · %1,2 · I(t)`; ihmal edilirse arıza olasılığı katlanır.
- Sigorta, MTV, otoyol/köprü, SGK, ofis kirası.
- **Asgari ücret artışı:** Ocak ve Temmuz'da yevmiyeler %20–40 artar (Türkiye gerçekliği, takvim olayı).
- **Akaryakıt zammı:** Rastgele, haftada ~1; "gece yarısı zammı" bildirimi.

**Olay tabanlı krizler** (servet ile ölçeklenir; zengin oyuncu daha çok etkilenir)
```
Kriz olasılığı (günlük) = 0,03 + 0,05 · min(1, NetDeğer / UnvanEşiği)
Kriz kaybı = min(Nakit · k, Tavan · I(t))     k = 0,05 … 0,15
```
- Sınır kapısı kapanması (seferler 7 gün durur), kanal tıkanması (konteyner gecikmesi), deprem (depo hasarı), şoför grevi, kur şoku, siber saldırı (fatura sistemi çöker).
- Sigorta, yedek fon ve avukat bu kayıpları azaltır → para eritici, aynı zamanda karar alanıdır.

**Ceza ve denetim**
```
Denetim olasılığı (aylık) = 0,02 + 0,08 · min(1, AylıkKâr / Eşik) + 0,10 · (Kayıt dışı işlem var mı)
Ceza = Vergi farkı · 3 + İtibar −15
```
- Tonaj cezası, takograf ihlali, sürücü dinlenme süresi ihlali.

**Ahlaki ikilem olayları (rüşvet/kayırma)**
- Ör. "Gümrükte bir görevli 'işini hızlandırabilirim' diyor."
- Kabul: kısa vadeli kazanç; ancak %40–60 olasılıkla soruşturma → büyük ceza, itibar çöküşü, ihale yasağı.
- Red: itibar +5, "Temiz Şirket" rozeti ilerlemesi.
- Tasarım dili rüşveti **özendirmez**; uzun vadede her zaman kaybettirir. (Mağaza politikası uyumu.)

**Statü giderleri (gönüllü sink, viral)**
- Makam aracı, plaza katı, yat, **Anadolu kulübüne forma sponsorluğu** (itibar ve ihale bonusu), vakıf/okul yaptırma (itibar + sosyal paylaşım kartı).
- Bunlar gelir getirmez ama unvan, kozmetik ve küçük kalıcı bonuslar verir; geç oyunun ana para eriticisidir.

**Prestij sıfırlaması — Halka Arz**
- Net değer eşiği aşılınca şirket Borsa İstanbul'da halka arz edilir.
- Oyun sıfırlanır; oyuncu `Prestij = floor((NetDeğer / 10^9)^0,5)` "Hisse Yıldızı" kazanır.
- Her yıldız kalıcı +%5 gelir, +%2 ihale şansı. Bu, uzun vadeli tutundurmanın (retention) ana motorudur.

---

## 4. Para Kazanma (Monetization) Stratejisi

### 4.1 Ödüllü Reklam (Rewarded Ads) Yerleşimleri

| # | Yerleşim | Ödül | Sınır |
|---|----------|------|-------|
| 1 | **Seferi hızlandır** | Kalan sürenin %50'si veya 30 dk (hangisi azsa) | Sefer başı 1, günde 15 |
| 2 | **Çevrimdışı kazanç ×2** | Geri dönüşte gelen kazancı ikiye katla | Her dönüşte 1 |
| 3 | **İhale istihbaratı** | Bir rakibin teklif aralığını göster | İhale başı 1 |
| 4 | **Ücretsiz ekspertiz** | Müzayedede konteyner değer aralığını daralt | Müzayede başı 2 |
| 5 | **Konkordato (iflastan kurtarma)** | Eksi bakiye krediye dönüştürülür + başlangıç nakdi | Günde 1 |
| 6 | **Avukat tut** | Ceza/kriz kaybını %50 azalt | Olay başı 1 |
| 7 | **Ruhsat işlemini hızlandır** | Bekleme süresini 2 saat kısalt | Ruhsat başı 3 |
| 8 | **Günlük piyasa raporu** | Ertesi günün akaryakıt / talep tahmini | Günde 1 |

Kurallar:
- İlk 10 dakika ve ilk 2 günde **geçiş reklamı (interstitial) yok**.
- Sonrasında geçiş reklamı yalnızca doğal kesintilerde (ay kapanışı ekranı), en az 4 dakika arayla, oturum başına en fazla 3.
- Herhangi bir satın alma yapan oyuncuya geçiş reklamı gösterilmez.
- Reklam, ödülün **değerini** gösterir: "Reklam izle: +420.000 ₺" (somut rakam dönüşüm oranını artırır).
- Türkiye eCPM değerleri Batı pazarlarının belirgin şekilde altındadır; reklam gelirini tamamlamak için IAP ve İngilizce/Azerice yerelleştirmeyle bölge dışı kitle hedeflenmelidir.

### 4.2 Uygulama İçi Satın Alma (IAP)

Para birimleri:
- **₺ (oyun içi nakit):** Oynayarak kazanılır, enflasyona tabidir.
- **Altın (premium):** Hızlandırma, kozmetik, ek ihale hakkı, kurtarma. Enflasyondan etkilenmez. Oyunda da az miktarda kazanılır (görev, başarım).

| Paket | Fiyat (yaklaşık) | İçerik | Mantık |
|-------|------------------|--------|--------|
| **Başlangıç Paketi** (ilk 72 saat, tek sefer) | 49,99 ₺ | 1 Kamyon + 2.000.000 ₺ + 100 Altın | Dönüşüm: ilk ödemeyi düşük eşikle aldırma |
| **Reklamsız Lisans** | 149,99 ₺ | Geçiş reklamları kalkar | Rahatsız olan kullanıcıyı geliri kaybetmeden dönüştürme |
| **Patron Kulübü** (aylık abonelik) | 199,99 ₺ / ay | Ödüllü reklamlar izlemeden alınır, günlük 30 Altın, +%20 çevrimdışı kazanç, ek sefer kuyruğu | Düzenli gelir, en yüksek LTV |
| **Sezon Karnesi** (30 gün) | 129,99 ₺ | Sezon görev ödülleri, özel araç kaplaması, unvan çerçevesi | Canlı operasyon etkinlikleriyle |
| Altın – Cep | 29,99 ₺ | 80 Altın | Giriş |
| Altın – Çanta | 79,99 ₺ | 250 Altın (+%15) | |
| Altın – Kasa | 179,99 ₺ | 650 Altın (+%30) — **"En popüler"** | Fiyat çapası |
| Altın – Kamyon Dolusu | 399,99 ₺ | 1.600 Altın (+%50) | |
| Altın – Holding | 899,99 ₺ | 4.000 Altın (+%70) | Balina segmenti |
| **Çağ Geçiş Teklifi** (bağlamsal) | 99,99 ₺ | Yeni çağa girişte ruhsat + 1 araç | Motivasyonun en yüksek anında, 24 saat süreli |

Fiyatlandırma ilkeleri:
- Fiyatlar App Store / Google Play TRY fiyat basamaklarına göre ayarlanır; TRY basamakları kur nedeniyle sık güncellendiği için **sunucu tarafında yönetilir**.
- Merdiven yapısı: Her basamakta bonus oranı artar; orta paket "En popüler" ile çapalanır.
- **Etik sınırlar:** Gerçek parayla şans satın alınmaz, iflas anında agresif satın alma penceresi açılmaz (önce ücretsiz/reklam seçeneği sunulur), 18 yaş altı için harcama uyarısı.
- **Pay-to-win dengesi:** Altın zamanı satın alır, ihaleyi değil. İhale kazanma yalnızca istihbaratla (reklamla da alınabilir) etkilenir.

### 4.3 Hedef KPI'lar (Soft Launch)

| Metrik | Hedef |
|--------|-------|
| D1 / D7 / D30 tutundurma | ≥ %40 / ≥ %15 / ≥ %6 |
| Ortalama oturum sayısı / gün | ≥ 6 |
| Ödüllü reklam izleyen DAU oranı | ≥ %45 |
| Ödeme yapan kullanıcı oranı | %2–4 |

---

## 5. Teknik Altyapı ve Yol Haritası

### 5.1 Teknoloji Seçimi: **Flutter**

| Kriter | Flutter | React Native | Unity |
|--------|---------|--------------|-------|
| UI ağırlıklı (liste, kart, grafik, form) | Çok güçlü | Güçlü | Zayıf (UI zahmetli) |
| Tek geliştirici hızı | Hot reload, tek dil (Dart) | Hızlı ama native bağımlılık sorunları | Yavaş UI iterasyonu |
| Performans / tutarlı görünüm | Kendi render motoru, her cihazda aynı | Platforma göre farklılık | Yüksek ama gereksiz |
| Reklam / IAP / Firebase | Resmi paketler (google_mobile_ads, in_app_purchase, Firebase) | Var | Var |
| Uygulama boyutu | Orta | Orta | Büyük |

**Karar:** Oyun bir "oyun motoru" değil, bir **canlı arayüz + ekonomi motoru**dur. Flutter bu iş için en hızlı ve en temiz seçimdir. Unity yalnızca fizik/3D gerektiğinde mantıklı olurdu.

### 5.2 Önerilen Yığın

| Katman | Teknoloji |
|--------|-----------|
| UI | Flutter (Material 3, özel tema) |
| Durum yönetimi | Riverpod |
| Yerel kayıt | Drift (SQLite) veya Isar |
| Uzak denge ayarı | Firebase Remote Config |
| Analitik / hata | Firebase Analytics + Crashlytics |
| Bulut kayıt / liderlik | Firestore + Cloud Functions (sunucu saati, IAP makbuz doğrulama) |
| Reklam | Google AdMob (gerekirse AppLovin MAX / LevelPlay mediation) |
| IAP | RevenueCat (abonelik yönetimini büyük ölçüde basitleştirir) veya in_app_purchase |

### 5.3 Yol Haritası

| Faz | Süre | Çıktı |
|-----|------|-------|
| 0 – Prototip (bu repo) | 1 hafta | Bakiye, filo, tick ekonomisi, risk butonu, iflas |
| 1 – MVP | 4–6 hafta | Çağ 1–2, ihale mekaniği, olay kartları, kayıt sistemi, tutorial |
| 2 – Monetizasyon | 2 hafta | AdMob ödüllü reklam, IAP, Remote Config |
| 3 – Soft launch | 4 hafta | Tek ülke / sınırlı kitle, KPI ölçümü, denge iterasyonu |
| 4 – Global / Canlı operasyon | Sürekli | Çağ 3–7, sezonlar, halka arz, liderlik tablosu |

### 5.4 Prototip

Çalışan prototip kodu: [`app/lib/main.dart`](../app/lib/main.dart). Kurulum: [`app/README.md`](../app/README.md).

Prototipte bulunanlar:
- Kasa, net değer, günlük gelir/gider, enflasyon, kredi faizi göstergeleri
- 3 araç tipiyle "Yatırım Yap" (geri dönüş süresi gösterilir)
- "Risk Al": olasılık + beklenen kâr gösteren riskli sefer, tecrübe bonusu (kötü şans koruması), bekleme süresi
- Aylık kapanış: %25 kurumlar vergisi, enflasyonun fiyat endeksine işlenmesi
- Rastgele olaylar (akaryakıt zammı, tonaj cezası, arıza, acil talep)
- Banka kredisi çek / öde
- 15 gün eksi bakiyede iflas + bir defalık "Konkordato" (ödüllü reklam yerleşimi simülasyonu)
- Oyun hızı: duraklat / 1x / 3x

---

## 6. Sonraki Adım (Onayınla)

1. Veritabanı şeması (oyuncu, şirket, filo, sefer, ihale, olay, ekonomi parametreleri, IAP makbuzları)
2. Riverpod + Drift ile katmanlı mimari ve kayıt sistemi
3. İhale ekranı ve olay kartı motoru (JSON tabanlı, Remote Config'ten beslenen)
