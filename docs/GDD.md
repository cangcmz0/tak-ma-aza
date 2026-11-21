# Oyun Tasarım Dokümanı (GDD) — Çalışma adı: "Tutam!" (Baharat Çarşısı kum bulmacası)

> **Sürüm:** 0.1 (taslak) · **Tarih:** 20 Kasım 2026 · **Yazan:** Kıdemli Oyun Tasarımcısı
> **Dayanak:** `OYUN_TASARIMI.md` (kararlar), `reports/2026-11-20-insight-report.md` (pazar), `prototip/kum-akisi.html` (prototip), `docs/STUDIO.md` (ekip)
> **Kapsam:** Tek kodlayıcı (AI) ile 6–8 haftada çıkacak Android MVP. Bu doküman **karar** verir; alternatifler en sondaki "Açık sorular" bölümündedir.
> **Doğrulama notu:** Pazar rakamları, rakip özellikleri ve KPI kıyasları bu oturumda birincil kaynaktan doğrulanamadı. Bunlar metinde **(doğrulanmadı)** ya da **(tahmin)** diye işaretlendi.

---

## İçindekiler
1. Özet, vaat, hedef kitle
2. İsim önerileri
3. Tema: Baharat Çarşısı
4. Çekirdek kurallar
5. Farklılaşma mekanikleri
6. Modlar
7. Bölüm hedef türleri
8. İlk 30 bölüm
9. İlerleme ve meta
10. Ekonomi ve güçlendiriciler
11. Para kazanma
12. Elde tutma
13. Öğretici (onboarding)
14. Oyun hissi (juice) ve ses
15. Ekranlar (UI akışı)
16. MVP kapsamı ve sonrası
17. KPI hedefleri
18. Bölüm veri formatı
19. Açık sorular
- Ek A: 8 haftalık iş planı

---

## 1. Özet, vaat, hedef kitle

**Özet.** Tutam!, dikey ekranda oynanan bir kum bulmacasıdır. Tepside 3 baharat kesesi (tetromino parça) durur. Oyuncu birini sürükleyip tahtanın üstünden bırakır. Kese yırtılır ve içindeki baharat taneleri kum gibi akıp yığılır. Aynı renkteki baharat sol duvardan sağ duvara kesintisiz bir yol kurunca bu bölge patlar. Üstteki taneler aşağı kayar ve yeni yollar kurabilir. Art arda gelen patlamalar zincir olur ve puanı katlar. Ana mod, müşteri siparişi gibi sunulan hedefleri olan bölümlerden oluşur ("400 g pul biber", "3 yol patlat", "çuvalları yırt"). Her bölümde parça hakkı sınırlıdır. Rakiplerden ayrıldığımız yerler şunlar: **çarşı kimliği** (baharat renkleri, çarşı kedisi Zerde, sipariş kartları), **taneyi gram gram toplama** hedefleri, **raf ve çuvallarla şekillenen tahtalar**, **karışık baharat (joker)**, **acı biber bombası** ve **iki renkli keseler**.

**Vaat (tek cümle):** *"Baharatı dök, renkleri soldan sağa bağla, çarşıyı rengârenk patlat — her hamlesi dokunması tatmin edici bir kum bulmacası."*

**Hedef kitle.**
| Katman | Tanım | Neden |
|---|---|---|
| Birincil | Türkiye'de 25–55 yaş, ağırlıkla kadın, casual bulmaca oyuncusu (match-3/sort/block oyunlarını bilen) | TR'de bulmaca indirmede önde; TikTok TR'de yeni oyuncuların %73'ü kadın (rapor, **doğrulanmadı**) |
| İkincil | Küresel (İngilizce), aynı profil; "satisfying" video izleyen kitle | Kum mekaniği dilden bağımsızdır, tema "egzotik ama sıcak" görünür |
| Oturum tipi | Günde 3–5 kısa oturum (3–10 dk): otobüs, çay molası, yatmadan önce | Bölümler 1,5–3 dakikada biter |

---

## 2. İsim önerileri

> **Uyarı:** Google Play / App Store'da aynı ya da benzer isimli uygulama ve marka tescili olup olmadığını bu oturumda **doğrulayamadım**. Karar vermeden önce mağaza araması, TÜRKPATENT ve EUIPO/WIPO taraması yapılmalı.

| # | Türkçe | Uluslararası | Mağaza başlığı (ASO önerisi) | Not |
|---|---|---|---|---|
| 1 | **Tutam!** | **Pinch!** | Tutam! Baharat Kum Bulmacası / Pinch! Spice Sand Puzzle | **Önerim.** Kısa, eylem bildiriyor ("bir tutam baharat"). İkonda tek kelime. |
| 2 | Zerde'nin Çarşısı | Zerde's Bazaar | Zerde's Bazaar: Sand Puzzle | Maskot adını markalaştırır. Kedi tema trendine uyar. |
| 3 | Baharat Akışı | Spice Flow | Spice Flow: Sand Blocks Puzzle | Prototip adı "Kum Akışı"nın devamı. Jenerik olduğu için çakışma riski yüksek. |
| 4 | Çarşı Kumu | Bazaar Sands | Bazaar Sands: Color Drop | Atmosferik ama ne oyunu olduğu az anlaşılıyor. |
| 5 | Elekçi | Spice Sifter | Spice Sifter: Pour & Match | Akılda kalıcı, "elek" güçlendiricisiyle bağlantılı. |

Bu dokümanda çalışma adı olarak **Tutam!** kullanılıyor.

---

## 3. Tema: Baharat Çarşısı

### 3.1 Görsel yön
- **Ortam:** Akşamüstü bir kapalı çarşı. Sıcak koyu ahşap zemin, kemerli tavan silueti, asılı bakır lambalar. Hepsi kodla çizilen basit vektör şekiller.
- **Tahta:** Koyu ahşap bir baharat tepsisi. Arka plan `#2A1E17`, kenarında 4 px açık ahşap çerçeve `#8A5A36`.
- **Taneler:** Her renk 3 tonla çizilir (taban / açık / koyu), prototipteki gibi. Her tanenin tonu oluştuğu anda rastgele seçilir. Bu ton, "toz" dokusunu verir.
- **Yazı tipi:** Başlıklarda Baloo 2, metinlerde Nunito. Prototipte de bunlar var; ikisi de OFL lisanslı ve uygulamaya gömülecek.

### 3.2 Renk ve isim eşlemesi (tema dosyasından değiştirilebilir)
Motor yalnızca **renk indeksini** (1–6) bilir. İsim, hex, doku ve sembol `theme` dosyasından okunur. Tema değiştirmek için kod değişmez.

| İndeks | İç ad | Baharat Çarşısı adı | Taban / Açık / Koyu | Renk körü sembolü (tepside) | İlk görüldüğü bölüm | Alternatif tema "Klasik Kum" |
|---|---|---|---|---|---|---|
| 1 | red | **Pul Biber** | `#E0432F` / `#F2705C` / `#B83322` | ▲ üçgen | 1 | Mercan |
| 2 | yellow | **Zerdeçal** | `#F4B526` / `#FFD261` / `#D09310` | ● daire | 1 | Kum Sarısı |
| 3 | green | **Nane** | `#5DAE4B` / `#86CC73` / `#43893A` | ♣ yaprak | 2 | Yosun |
| 4 | purple | **Sumak** | `#9B3D8C` / `#C064B0` / `#762B6A` | ◆ elmas | 11 | Ametist |
| 5 | blue | **Çivit** | `#3D6FD8` / `#6E95EC` / `#2B53AA` | ■ kare | 25 | Deniz |
| 6 | brown | **Tarçın** | `#C27A3E` / `#DDA066` / `#97592A` | ✚ artı | 31+ (sonra) | Toprak |
| J | joker | **Karışık Baharat** | 6 rengin tonları arasında 0,8 sn'de dönen renk | ★ yıldız | 13 | Gökkuşağı |

| Öğe | Baharat Çarşısı | Klasik Kum |
|---|---|---|
| Parça | Kese | Blok |
| Engel (kalıcı) | **Raf** (ahşap, `#6B4426`) | Kaya |
| Engel (kırılır) | **Çuval** (çuval bezi `#C9A66B`, düğüm sayısı = can) | Sandık |
| Bomba | **Acı Biber** (tanelerde kıvılcım) | Dinamit |
| Para | **Altın** (sikke ikonu üstünde "akçe" deseni) | Altın |
| Hedef kartı | **Sipariş** (müşteri avatarı + kese) | Görev |

Renk seçiminde ölçüt şuydu: koyu ahşap zeminde her rengin parlaklık farkı yüksek olsun. Kırmızı–mor ve sarı–kahve çiftleri birbirinden ton **ve** parlaklıkla ayrılsın. Tarçın, kırmızıya yakın olduğu için ilk 30 bölümde kullanılmaz.

### 3.3 Maskot: Çarşı kedisi **Zerde**
- **Kim:** Çarşıda yaşayan turuncu tekir bir kedi. Baharatçıların gözdesi. Hem oyuncuya yol gösterir hem tepki verir. Kedi seçmemin nedeni şu: İstanbul çarşılarıyla özdeşleşmiş bir figür ve "sevimli hayvan + bulmaca" kombinasyonu şu an yükselişte (rapor: Meowdoku, **doğrulanmadı**). Tasarımı tamamen orijinaldir, başka bir oyunun kedisine benzetilmez.
- **Kodla çizim (tek SVG/Canvas fonksiyonu, ~10 şekil):**
  - Kafa: daire r=40, `#F0A040`. Kulaklar: iki üçgen; iç kısımları pembe `#F7B8B0`.
  - Alında 3 koyu turuncu yay (tekir çizgisi). Gözler: iki koyu elips, her birinde beyaz parıltı noktası.
  - Burun: küçük pembe üçgen. Ağız: iki küçük yay ("ω"). Bıyık: her yanda 3 çizgi.
  - Gövde: elips. Boyunda küçük bir **kese** (çaprazlama ip + kahverengi yuvarlak). Kuyruk: kalın bir kübik Bezier eğrisi.
- **Animasyonlar (kodla):** 3–5 sn'de bir göz kırpma (göz scaleY 0.1, 120 ms). Kuyrukta sinüs salınımı. Kazanınca zıplama (y −20 px, ease-out). Kaybedince kulaklar 20° düşer. **Pul biberde ×3 ve üstü zincir olunca hapşırır** ("Hapşu!" yazısı ve küçük kırmızı toz bulutu). Bu, imza anımız ve TikTok videoları için tekrar eden bir şaka.
- **Müşteriler (sipariş kartları):** 4 basit avatar. Daire kafa, saç ya da başörtüsü şekli, renk varyantı: **Ayşe Teyze**, **Mehmet Amca**, **Aşçı Selim**, **Gezgin Anna**. Her bölüm başında içlerinden biri "sipariş" verir. Bu tamamen görsel bir sunumdur; mekaniği değiştirmez.

---

## 4. Çekirdek kurallar

Prototipin kuralları korunuyor. Aşağıda netleştirilen ya da değiştirilen her şey **kalın** yazıldı.

### 4.1 Tahta
| Parametre | Değer | Gerekçe |
|---|---|---|
| Tahta boyutu | **48 × 80 tane** (genişlik × yükseklik) | Prototipte 40×64 vardı. Genişliği 12 bloğa çıkardım. Bir yol, aynı renkte en az ~3 kese ister; bu da planlama gerektirir. 10 blokta yollar fazla kolay kuruluyordu. |
| Blok | **4 × 4 tane = 16 tane** | Kese başına 64 tane düşer. Bu, akışın "kum" gibi görünmesi için yeterli bir incelik. 360 dp genişlikte bir tane ≈ 7 dp olur ve göz tek tek taneyi seçebilir. |
| Blok cinsinden | 12 × 20 blok | 20 blok yükseklik, tahta dolmadan 25–35 kese oynamaya yetiyor (tahmin). Bölüm parça limitleri bu aralıkta tutuldu. |
| Toplam hücre | 3.840 | Simülasyon maliyeti düşük. Orta seviye Android'de 60 FPS rahat tutulur. |
| En-boy oranı | 0,6 | 360×740 dp ekranda üst bar 56 dp + tahta ~576 dp + tepsi 104 dp sığar. Daha kısa ekranlarda tane boyutu `min(genişlik/48, yükseklik/80)` ile küçültülür. |
| Tane türleri | boş, renk 1–6, joker, raf (= motorda `STONE`, statik), çuval (statik, canlı) | Ek bayraklar: `FLAG_BOMB`, `FLAG_STATIC` (motorda mevcut) |

Motor bu sayıları sabit kodlamamalı, `config`'den okumalı. Bölüm dosyası isterse `board` alanıyla bunları ezebilir (bkz. §18). MVP'deki tüm bölümler varsayılanı kullanır.

### 4.2 Parça seti
- **7 tetromino:** I, O, T, L, J, S, Z. Prototipteki 7 şekil budur.
- Bir bölüm `pieces` alanıyla şekilleri kısıtlayabilir (motorda mevcut). Örneğin öğreticide yalnızca I ve O çıkar.
- **Renk:** Her kese tek renktir. Bölümün `colors` listesinden seçilir. İstisnalar **İkili Kese** ve **Joker blok** (bkz. §5).
- **Üretim (adil torba):**
  - Şekiller 7'li torbadan çekilir (torba boşalınca karıştırılıp yeniden doldurulur).
  - Renkler, her rengin 2 kez bulunduğu bir renk torbasından çekilir.
  - Bu sayede "hep aynı renk geliyor" hissi oluşmaz.
- **Rastgelelik tohumlu:** `seed` bölüm dosyasındadır. Motor her akışı `deriveSeed(seed, akış)` ile ayrı türetir (tahta, parça, fizik, kozmetik). Tasarım kuralı:
  - **Ön dolum:** Her denemede **aynı** tahta gelir (bölüm `seed`'i). Oyuncu tahtayı öğrenebilir.
  - **Parça ve fizik:** Her denemede **farklıdır** (`seed + deneme_no × 7919`).

  Prototipteki `Math.random` kaldırılır. Bu, QA botunun ve tekrar oynatmanın deterministik çalışması için şart. (Motora etkisi için bkz. §18.6.)
- **Yardım kuralı:** Aynı bölümde art arda 3 kez kaybedilirse, sonraki denemede hedefte geçen renklerin torbadaki ağırlığı ×1,5 olur. Bu oyuncuya gösterilmez ve 1 deneme sürer.

### 4.3 Tepsi kuralı
- Tepside her zaman **3 yuva** vardır. Parçalar **istenen sırayla** kullanılır.
- **Üçü de kullanılınca** tepsi yeniden dolar (prototipteki gibi). Kısmi dolum yapılmaz.
- Parça limitli bölümde: kalan hak 3'ten azsa, tepsiye yalnızca kalan sayı kadar parça gelir. Üst bardaki sayaç "kalan parça" gösterir: `pieceLimit − bırakılan`.
- **Döndürme:** Tepsideki keseye **dokunmak** onu 90° saat yönünde döndürür. **Sürüklemek** yerleştirir. Ayrı bir "Döndür" düğmesi yoktur (prototiptekini kaldırıyoruz; tek parmak kontrolü daha temiz).

### 4.4 Bırakma kuralı
1. Oyuncu keseyi tepsiden sürükler. Kese parmağın **64 dp yukarısında** gösterilir, böylece parmak onu örtmez.
2. Parmak tahtanın yatay aralığındayken (tahtanın üst kenarından 40 dp yukarısı dahil) bir hayalet önizleme görünür:
   - kesenin düşeceği sütun bandı (%6 beyaz),
   - tahtanın tepesinde kesenin yarı saydam silueti.
3. Yatay konum **1 tane** hassasiyetle tutulur ve tahta sınırına kenetlenir (`clampGhost`).
4. Parmak tahta üstünde bırakılırsa kese tahtanın **en üst satırına (y=0)** damgalanır ve tüm taneleri anında serbest kalır.
5. **Damga alanı doluysa** (kum o sütunda tepeye kadar yığılmışsa) kese **tepsiye geri döner**. Hak harcanmaz. Kese kırmızı yanıp sallanır, "Burası dolu!" yazar ve uyarı titreşimi verilir. *(Prototipte bu durumda oyun bitiyordu. Bunu kaldırıyoruz; oyuncu yanlış bir dokunuşla kaybetmemeli.)*
6. Parmak tahta dışında bırakılırsa kese tepsiye döner.
7. Kum akarken de yeni kese bırakılabilir (tempo hissi için).

### 4.5 Akış (fizik)
- Her karede **3 simülasyon adımı** çalışır (60 FPS'te 180 adım/sn, prototipteki gibi).
- Satırlar alttan üste taranır. Her satırda tarama yönü rastgeledir (sol→sağ ya da sağ→sol), böylece yönsel bir eğilim oluşmaz.
- Her tane için kural sırası:
  1. **Altı boşsa** aşağı iner.
  2. Değilse, **sol-alt ve sağ-alt** boşsa rastgele birine geçer.
  3. Yalnızca biri boşsa ona geçer.
  4. Hiçbiri boş değilse yerinde durur.
- **Raf ve çuval** hücreleri hiç hareket etmez ve diğer taneler için "dolu" sayılır.
- **Duruldu:** Bir simülasyon adımında hiçbir tane hareket etmediyse tahta durulmuş sayılır.

### 4.6 Temizleme kuralı (yol)
- **Ne zaman kontrol edilir:** Yalnızca tahta **duruldu** olduğunda (prototipteki gibi).
- **Yol:** Aynı renkteki tanelerin **4-komşuluk** (yukarı/aşağı/sol/sağ) ile bağlı bir bölgesi. Bu bölgede hem **x = 0 (sol duvar)** hem **x = 47 (sağ duvar)** sütunlarında en az bir tane olmalı. Bölgenin **tamamı** temizlenir, yalnızca en kısa yol değil.
- **Joker** tane her rengin bölgesine dahil olabilir (bkz. §5.2). Yalnız jokerlerden oluşan bir bölge de yol sayılır; rengi "karışık"tır.
- Bir kontrolde birden fazla yol bulunabilir. Bunlar **büyükten küçüğe** sırayla zincir adımı olarak işlenir.
- **Temizleme animasyonu:** 380 ms süren beyaz yanıp sönme (prototipte 70 ms aralıkla), ardından taneler parçacığa dönüşür (§14). Bu sırada simülasyon durur, giriş açık kalır.

### 4.7 Puanlama
| Olay | Puan |
|---|---|
| Yol temizleme | `(tane_sayısı + 100) × Z` (Z = zincir çarpanı) |
| Bomba ile silinen tane | `1 × Z` / tane (yol bonusu yok) |
| Çuval yırtma (can 0'a inince) | `200` |
| Kepçe / Elek ile silinen tane | `1` / tane (çarpan yok) |
| Bölüm sonu "Tezgâh Bonusu" | Kalan her parça için `100` (sayaç animasyonuyla eklenir) |

**Zincir çarpanı (Z):**
- Bir temizlemeden sonra tahta akıp durulur ve yeni bir yol bulunursa Z 1 artar: 1 → 2 → 3 → 4 → 5. **Tavan ×5.**
- Tahta duruldu ve **yol bulunmadıysa** Z sıfırlanır.
- *(Prototipte Z her bırakışta sıfırlanıyordu. Değiştirdik: kum akarken hızlı bırakma cezalandırılmasın, akış devam etsin.)*
- Aynı kontrolde iki yol çıkarsa Z ve Z+1 ile puanlanır, ekranda **"Çifte!"** yazar.

### 4.8 Oyun bitti koşulları
| Mod | Kazanma | Kaybetme |
|---|---|---|
| Bölüm | Tüm hedefler tamamlanır. Biten kaskad durulunca "Kazandın" açılır. | (a) Parça hakkı biter ve tahta durulduğunda hedefler eksiktir → **"Parçalar bitti"** (b) Tahta doldu → **"Tahta doldu"** |
| Sonsuz | — | Tahta doldu |

- **Tahta doldu:** Tahta durulduğunda tepsideki **hiçbir** kese, 4 dönüşün **hiçbirinde**, **hiçbir** x konumunda damgalanamıyorsa.
- **Tehlike uyarısı:** En yüksek tane üstten 8 satırın (2 blok) içine girince tahtanın üst kenarı kırmızı nabız atar. Kalp atışı sesi çalar ve bir kez uyarı titreşimi verilir.

### 4.9 Çekirdek döngü
`Siparişi oku → keseyi seç / döndür → sürükle ve bırak → kum akar → yol patlar (zincir) → sipariş ilerler → (hedef tamam) yıldız ve altın → haritada sonraki dükkân`

---

## 5. Farklılaşma mekanikleri

> Rakip (Sand Blocks: Drop Puzzle ve yakında çıkacak klonları) hakkındaki bilgimiz, pazar raporundaki tek satırlık özetten ibaret: "bloklar kum gibi dağılıyor, renk hatları temizleniyor". Rakibin hangi özel mekanikleri olduğunu **doğrulamadım**. Aşağıdakiler bilinçli olarak türün temel kuralının **üstüne** eklenen ve kimliğimizle bağlantılı mekaniklerdir.

| # | Mekanik | MVP? | Tanıtıldığı bölüm | Zorluk |
|---|---|---|---|---|
| 5.1 | Sipariş ve Gram Toplama | **Evet** | 5 (renkli yol), 7 (gram) | Düşük |
| 5.2 | Karışık Baharat (joker tane) | **Evet** | 13 | Orta |
| 5.3 | Acı Biber (bomba tanesi) | **Evet** | 6 | Düşük |
| 5.4 | Raf ve Çuval (tahta şekillendiren engeller) | **Evet** | Raf 9, Çuval 16 | Raf düşük, Çuval orta |
| 5.5 | İkili Kese (iki renkli parça) | **Evet** | 22 | Düşük |
| 5.6 | Nemli Baharat (topak tane) | Sonra (v1.1) | 31+ | Düşük–orta |
| 5.7 | Lodos (rüzgâr) | Sonra (v1.2) | 41+ | Orta |

### 5.1 Sipariş ve Gram Toplama — *imza sunum ve hedef farkı*
- **Kural:** Her bölümün hedefleri bir müşterinin **sipariş kartı** olarak gösterilir.
  - Renkli tane hedefi **gram** cinsinden yazılır: **1 tane = 1 g**. Örnek: "Ayşe Teyze: 400 g Zerdeçal".
  - Temizlenen hedef renkli taneler patlayınca parçacık olarak uçar ve üst bardaki sipariş kesesine dolar. Kesenin içi dolma animasyonuyla yükselir; terazi ibresi oynar.
- **Neden eğlenceli:** Soyut "X tane temizle" hedefi somut bir "sipariş hazırlama" hissine dönüşür. Uçan taneler her patlamayı ödüllendirir. Kimlik de akılda kalır: oyuncu "kum oyunu" değil "baharat siparişi oyunu" hatırlar.
- **Uygulama:** Düşük. Hedef sayaçları zaten gerekiyor. Ek iş: parçacık hedef noktası ve kese dolum çizimi.

### 5.2 Karışık Baharat (joker tane)
- **Kural:**
  - Bir kesenin 4 bloğundan biri **joker blok** olabilir (`jokerChance`; kese başına bu olasılıkla 1 blok, 16 tane).
  - Joker taneler, yol aranırken **her rengin bölgesine dahil** sayılır. Algoritma her renk `c` için ayrı flood-fill çalıştırır; geçilebilir hücre `grid == c || grid == JOKER` olur.
  - Yol tamamlanınca bölgedeki jokerler de silinir. Renk sırası 1→6'dır. Silinen joker sonraki rengin aramasında artık yoktur.
  - Jokerler **renk gram hedeflerine sayılmaz**, yol hedeflerine sayılır.
- **Neden eğlenceli:** "Şuraya biraz joker dökersem iki rengi birden köprülerim" gibi planlar mümkün olur. Kurtarıcı ve parlak bir an yaşatır. Yanıp dönen renkleri de görsel olarak çekicidir.
- **Uygulama:** Orta. Flood-fill renk sayısı kadar tekrarlanır (5 × 3.840 hücre, ihmal edilebilir maliyet). Renk döngüsü render'da çözülür.

### 5.3 Acı Biber (bomba tanesi)
- **Kural:**
  - Bir kesenin 1 bloğu **acı biber** olabilir (`bombChance`). Bu blok kesenin rengindedir ve tanelerinde kıvılcım parlaması vardır (`bomb` bayrağı).
  - Acı biber tanelerinden **en az biri temizlenen bir yolun içindeyse**, patlama olur. Her bomba tanesinin çevresindeki **yarıçapı 8 tane** (`BOMB_RADIUS`, config'den ayarlanır) olan daire temizlenir.
  - Patlama, dairenin içindeki **tüm renkli ve joker taneleri** siler (raf hariç). İçinde kalan her çuvala 1 hasar verir.
  - Silinen taneler renk gram hedeflerine **sayılır**, yol hedefine sayılmaz.
  - Bomba yolda değilse beklemede kalır; süre sınırı yoktur.
- **Neden eğlenceli:** Büyük, sarsıcı bir patlama verir. Karışmış ve "kirlenmiş" bölgeleri temizler. Zincir başlatma aracıdır. Zerde'nin hapşırma şakasıyla da birleşir.
- **Uygulama:** Düşük. Bir bayrak dizisi ve daire içi silme yeterli.

### 5.4 Raf ve Çuval — *tahtayı şekillendiren engeller*
- **Raf:**
  - Kalıcı ve kırılmaz ahşap hücreler. Blok hizalı dikdörtgenlerdir; tipik olarak 1 blok yüksekliğinde, 2–6 blok genişliğinde.
  - Kum rafın üstünde birikir ve kenarından dökülür. Huni, merdiven, dar geçit gibi desenler kurmayı sağlar.
  - Raf hücresi yolun parçası **olamaz**. Duvara dayalı bir raf o satırın duvar temasını keser.
- **Çuval:**
  - 2×2 blok (8×8 tane) boyutunda statik bir engeldir. **Canı 1–3**'tür; can, çuvalın üstündeki düğüm sayısıyla gösterilir.
  - Temizlenen bir yolun herhangi bir tanesi çuvalın bir hücresine 4-komşuysa çuval **1 hasar** alır. Her temizleme olayı en fazla 1 hasar verir.
  - Acı biber patlamasının dairesi çuvalla kesişirse yine 1 hasar verir.
  - Can 0 olunca çuval yırtılır (hücreler boşalır, üstteki kum akar) ve `clear_obstacles` hedefine sayılır.
- **Neden eğlenceli:** Rakipte de olabilecek boş tahtalar yerine her bölüm farklı bir "dükkân yerleşimi" sunar. Bölüm tasarımı tek mekanikle çok çeşitlenir; ucuz içerik üretimi demektir. Çuval ise "yolu oraya getir" diye yönlendirilmiş bir hedef verir.
- **Uygulama:** Raf düşük (statik hücre türü). Çuval orta (can, komşuluk kontrolü, yırtılma animasyonu).

### 5.5 İkili Kese (iki renkli parça)
- **Kural:** `twoColorChance` olasılığıyla bir kese iki renk taşır. 4 bloğun 2'si renk A, 2'si renk B olur. Bölme, şeklin kendi düzenine göre yapılır: I'da sol iki / sağ iki, O'da üst / alt, diğerlerinde ilk iki ve son iki blok. Döndürme renk dağılımını da döndürür.
- **Neden eğlenceli:** Tek bir bırakışla iki ayrı yola katkı yapılabilir. Ama yanlış konumda iki rengi birbirine "bulaştırma" riski vardır. Basit bir parçaya derin bir karar ekler.
- **Uygulama:** Düşük. Parça modelinde blok başına renk tutulur.

### 5.6 Nemli Baharat — Sonra (v1.1)
- **Kural:** Nemli kesenin taneleri yalnızca **düz aşağı** düşer, çapraz kaymaz. Dik sütunlar ve duvarlar kurmayı sağlar. Nem 6 bırakış sonra kurur (tane normale döner).
- **Neden:** Kum fiziğinin kendisiyle oynayan, gerçekten yeni bir hamle türüdür.
- **Uygulama:** Düşük–orta. Tane başına bayrak ve kuruma sayacı gerekir.

### 5.7 Lodos (rüzgâr) — Sonra (v1.2)
- **Kural:** Her N bırakışta bir, ekrandaki ok yönünde rüzgâr eser. En üstteki açık tane katmanı 2–4 tane yana kayar. Sayaç önceden gösterilir.
- **Neden:** Zamanlama ve önceden planlama ekler.
- **Uygulama:** Orta. Yüzey tanelerini tespit etmek ve yatay akış eklemek gerekir.

---

## 6. Modlar

| Mod | Tanım | MVP? |
|---|---|---|
| **(a) Bölüm modu** (ana mod) | Haritada sıralı bölümler. Hedefler, parça limiti ve yıldızlar var. MVP'de 30 bölüm (3 bölge × 10). | **Evet** |
| **(b) Sonsuz mod** ("Serbest Tezgâh") | Prototipin cilalı hâli. Parça limiti yok, rekor puan peşinde koşulur. **Bölüm 8 kazanılınca açılır.** | **Evet** (motor aynı, maliyeti çok düşük) |
| **(c) Günlük bulmaca** | Günün tarihinden üretilen tohumla herkese aynı tahta: 20 parça, en yüksek puan. Seri takibi ve küçük ödül var. | **Sonra (v1.1)** |

**Sonsuz mod kuralları:**
- Ön dolum: 9 rastgele kese (prototipteki gibi), tahtanın en altına yerleşir. Başlangıçta yol oluşmuşsa temizlenir.
- **Renk sayısı:**
  - 0 puanda 3 renk,
  - 3.000 puanda 4 renk,
  - 8.000 puanda 5 renk.
- **Özel taneler:**
  - 2.000 puandan sonra `bombChance` 0,05,
  - 5.000 puandan sonra `jokerChance` 0,03.
- Sonsuz modda raf, çuval ve ikili kese **yoktur**. Mod sade kalır.
- Rekor yerel olarak kaydedilir. Oyun bitince "Yeni rekor!" kutlaması yapılır.
- Ödül: oyun sonunda `floor(puan / 500)` altın verilir, **en fazla 30**.

---

## 7. Bölüm hedef türleri

Bir bölümün **tüm** hedefleri tamamlanmalıdır (VE bağlantısı). Bir bölümde en fazla **3 hedef** olur. Parça limiti bir hedef değil, bölümün kaybetme koşuludur.

| Tür (`type`) | Alanlar | Kesin tanım | Neler sayılır | Neler sayılmaz |
|---|---|---|---|---|
| `clear_paths` | `count`, opsiyonel `color` | `count` adet **yol temizleme olayı** gerçekleşir. `color` verildiyse yolun rengi `color` olmalı. Yolun rengi, flood-fill'i başlatan renktir. Joker içeren bir kırmızı yol kırmızı sayılır. Yalnız-joker yol yalnızca renksiz `clear_paths`'e sayılır. | Her yol 1 sayılır. Aynı kontroldeki 2 yol 2 sayılır. | Bomba, Kepçe ve Elek silmeleri |
| `score` | `value` | Bölüm puanı `value` değerine ulaşır ya da geçer. Tezgâh Bonusu bu kontrolden **sonra** eklenir; hedefe sayılmaz. | Tüm puan kaynakları | Tezgâh Bonusu |
| `clear_color_grains` | `color`, `count` | `color` renginde **toplam `count` tane** tahtadan silinir. Ekranda "g" ile gösterilir. | Yol, bomba, Kepçe ve Elek ile silinen o renk taneler | Joker taneler |
| `clear_obstacles` | `count`, opsiyonel `kind` (`"sack"`; varsayılan `"sack"`) | `count` adet çuval yırtılır, yani canı 0'a iner. Bölümdeki çuval sayısı `count` değerinden az olamaz (doğrulayıcı kontrol eder). | Yol temasıyla ya da bombayla yırtılan çuvallar | Raflar (kırılmaz) |
| *(bölüm alanı)* `pieceLimit` | sayı | Bölümde bırakılabilecek toplam kese sayısı. 0 kalınca ve tahta durulunca hedefler eksikse bölüm kaybedilir. | — | Tezgâhı Yenile booster'ı hak harcamaz |

**Hedef ilerleme göstergesi:** Her hedef üst barda bir sipariş satırıdır: ikon + "2/4" ya da "180/400 g". Tamamlanan satıra yeşil tik konur ve kısa bir "tık" sesi çalar.

---

## 8. İlk 30 bölüm

**Ön dolum ölçeği** (blok satırı cinsinden, tahta 20 satır):
- **Boş:** 0
- **Az:** 1–4 satır
- **Orta:** 5–8 satır
- **Yoğun:** 9–12 satır

Ön dolum hiçbir zaman hazır bir yol içermez. Yükleyici ön dolumu durultur; hazır yol varsa doğrulayıcı bölümü reddeder.

**Zorluk hedefi** (ilk denemede geçme oranı, QA botuyla kalibre edilir):

| Zorluk | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 |
|---|---|---|---|---|---|
| İlk denemede geçme | ≥ %95 | %80 | %60 | %40 | %25–30 |

**Yıldız eşikleri:**
- `stars[0]` ilerleme çubuğundaki ilk işarettir. Puan hedefi olan bölümde `stars[0] = score.value` olmalı.
- **Hedefler tamamsa en az 1★** garantidir.
- `stars[1]` 2★, `stars[2]` 3★ için gereken puandır.
- Tablodaki değerler **ilk tahmindir**. Kalibrasyon yöntemi: bot her bölümü 200 kez oynar. 2★ eşiği = başarılı oyunların medyan puanı, 3★ eşiği = 80. yüzdelik.

### Bölge 1 — Biber Sokağı (1–10)
| No | Ad | Hedef(ler) | Renk | Parça | Ön dolum (desen) | Yeni mekanik / tanıtım | Özel | Yıldız (1/2/3) | Zorluk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | İlk Tutam | 2 yol | 2 [1,2] | 10 | **Az.** 2 satır: altta zerdeçal (5. sütunda 1 blok boşluk), üstte pul biber (ortada 4 blok boşluk). Yalnızca I ve O şekilleri. Tepsi sabit: sarı O → kırmızı I. | Sürükle-bırak, yol temizleme (öğretici t1) | — | 500/1000/1400 | 1 |
| 2 | Doğru Renk | 2 yol | 3 [1,2,3] | 12 | **Az.** 3 satır: nane, pul biber, zerdeçal şeritleri. Her birinin farklı yerinde 2–4 blokluk boşluk var. İlk tepsi sabit: [kırmızı, nane, sarı]. | Tepsiden renk seçme, parça sayacı (öğretici t2) | — | 500/1100/1600 | 1 |
| 3 | Zincir | 3 yol | 3 | 14 | **Az.** 4 satır, zincir düzeneği: kırmızı şerit eksik. Kırmızı tamamlanınca üstteki iki ayrı sarı yığın aşağı inip birleşir ve yol olur. | Dokun = döndür, zincir (öğretici t3) | — | 800/1600/2400 | 2 |
| 4 | Puan Peşinde | 1.500 puan | 3 | 15 | **Az–orta.** 4 satır rastgele blok (tohumlu). | Puan hedefi, **Tezgâhı Yenile** booster'ı (2 hediye) | — | 1500/2200/3000 | 2 |
| 5 | Kırmızı Sipariş | 2 yol, bunlardan 1'i pul biber | 3 | 15 | **Az.** 3 satır; pul biber ağırlıklı dağınık adacıklar. | Renkli yol hedefi, ilk **sipariş kartı** (Ayşe Teyze) | — | 600/1200/1800 | 3 |
| 6 | Acı Biber | 3 yol | 3 | 16 | **Orta.** 6 satır "dama" deseni: 2×1 bloklar değişen renkte, kendiliğinden yol kurulmaz. İlk tepside 1 bombalı kese sabit. | **Acı Biber** bombası | bomba 0,20 | 900/1800/2700 | 3 |
| 7 | Gram Gram | 400 g zerdeçal | 3 | 16 | **Az.** 3 satır, zerdeçal cepleri. | **Gram hedefi** (uçan taneler), **Kepçe** booster'ı (2 hediye) | bomba 0,10 | 700/1400/2100 | 3 |
| 8 | Pazar Kalabalığı | 4 yol | 3 | 20 | **Orta.** 7 satır rastgele. | — (kazanınca **Sonsuz mod** açılır) | bomba 0,10 | 1000/2100/3100 | 4 |
| 9 | Raflar | 3 yol | 3 | 18 | **Az.** 2 satır + 2 raf: sol duvardan 3 blok ve sağ duvardan 3 blok, 10. satırda. Ortada 6 blok açıklık. | **Raf** | — | 800/1600/2400 | 4 |
| 10 | Biber Ustası | 5 yol + 300 g pul biber | 3 | 20 | **Yoğun.** 10 satır, 3 renk rastgele karışık; dar boşluklar. | İlk zor bölüm (zorluk yoğunluk ve hedef sayısından gelir; yeni mekanik yok) | bomba 0,10 | 1300/2500/3700 | **7** |

### Bölge 2 — Sumak Hanı (11–20)
| No | Ad | Hedef(ler) | Renk | Parça | Ön dolum (desen) | Yeni mekanik / tanıtım | Özel | Yıldız (1/2/3) | Zorluk |
|---|---|---|---|---|---|---|---|---|---|
| 11 | Han Kapısı | 3 yol | 3 [1,3,4] | 18 | **Az.** 3 satır. | **Sumak** rengi (kart ile tanıtılır) | bomba 0,10 | 800/1600/2400 | 3 |
| 12 | Elek | 500 g sumak | 4 | 20 | **Orta.** 6 satır, sumak adacıkları başka renklerle çevrili. | **Elek** booster'ı (2 hediye) | — | 900/1700/2600 | 4 |
| 13 | Karışık Baharat | 4 yol | 4 | 20 | **Orta.** 6 satır. İlk tepside 1 joker bloklu kese sabit. | **Karışık Baharat** (joker) | joker 0,20 | 1100/2100/3200 | 4 |
| 14 | Rafta Sıra | 4 yol + 3.000 puan | 4 | 22 | **Az.** 3 satır + 3 raf merdiven (soldan sağa inen, her biri 4 blok). | — | joker 0,10 | 3000/3800/4800 | 5 |
| 15 | Han Avlusu | 5 yol, 2'si nane | 4 | 22 | **Yoğun.** 10 satır yatay şeritler. Her şerit bir başka renkle 1 blokluk dikey "kazık"la bölünmüş. | — | bomba 0,10 | 1400/2600/3900 | **7** |
| 16 | Çuvallar | 3 çuval | 3 | 18 | **Az.** 4 satır. 3 çuval (can 1) en alt satıra gömülü. | **Çuval** (`clear_obstacles`) | — | 900/1800/2700 | 4 |
| 17 | Ağır Yük | 4 çuval + 2 yol | 4 | 22 | **Orta.** 5 satır. 4 çuval: 2'si can 1, 2'si can 2. | Can 2'li çuval | bomba 0,10 | 1200/2300/3400 | 5 |
| 18 | Sumak Kervanı | 600 g sumak + 400 g nane | 4 | 24 | **Orta.** 6 satır. | — | joker 0,10, bomba 0,10 | 1200/2300/3500 | 6 |
| 19 | Dar Geçit | 4 yol | 4 | 20 | **Az.** 2 satır + ortada uzun raf (8 blok, 11. satır). İki yanda 2'şer blok açıklık var (huni). | — | — | 1100/2100/3200 | 6 |
| 20 | Hancı Bey | 4 çuval + 3 yol | 4 | 26 | **Yoğun.** 9 satır. 4 çuval (can 2–3). | Bölge sonu (sandık ödülü) | bomba 0,15 | 1500/2800/4200 | **8** |

### Bölge 3 — Zerdeçal Çarşısı (21–30)
| No | Ad | Hedef(ler) | Renk | Parça | Ön dolum (desen) | Yeni mekanik / tanıtım | Özel | Yıldız (1/2/3) | Zorluk |
|---|---|---|---|---|---|---|---|---|---|
| 21 | Sarı Kapı | 3.500 puan | 4 | 20 | **Orta.** 6 satır, zincir dostu: renkler yatay bantlar hâlinde ve neredeyse tamam. | — (rahatlama) | joker 0,10 | 3500/4300/5300 | 4 |
| 22 | İkili Kese | 4 yol | 4 | 22 | **Az.** 4 satır. İlk tepside 1 ikili kese sabit. | **İkili Kese** | ikili 0,30 | 1100/2200/3300 | 5 |
| 23 | Çifte Sipariş | 500 g zerdeçal + 500 g pul biber | 4 | 24 | **Orta.** 6 satır. | — | ikili 0,25 | 1300/2500/3700 | 5 |
| 24 | Raf Labirenti | 5 yol | 4 | 24 | **Az.** 3 satır + 4 raf zikzak (sol-sağ-sol-sağ, 3'er blok). | — | bomba 0,10 | 1400/2600/3900 | 6 |
| 25 | Çivit Mavisi | 5 yol | 5 [1–5] | 26 | **Orta.** 6 satır, 5 renk. | **Çivit** rengi (5. renk) | joker 0,15 | 1400/2700/4000 | **8** |
| 26 | Çay Molası | 3 yol | 4 | 20 | **Az.** 3 satır. | — (rahatlama, bol bomba) | bomba 0,25 | 900/1800/2800 | 3 |
| 27 | Çuval Yığını | 6 çuval | 4 | 26 | **Orta.** 5 satır + 2 raf. 6 çuval (can 1–2). | — | bomba 0,15 | 1500/2800/4200 | 6 |
| 28 | Lonca Sınavı | 5 yol, 2'si çivit + 5.000 puan | 5 | 28 | **Orta.** 7 satır. | — | ikili 0,20, joker 0,10 | 5000/6000/7500 | 7 |
| 29 | Bereket | 6.000 puan | 4 | 24 | **Yoğun.** 10 satır. Bantlar neredeyse tamam, yüksek zincir potansiyeli. | — (finalden önce nefes) | bomba 0,15 | 6000/7200/8800 | 5 |
| 30 | Çarşı Ağası | 6 yol + 3 çuval + 500 g çivit | 5 | 30 | **Yoğun.** 9 satır + 2 raf + 3 çuval (can 2). | Final (sandık ödülü) | bomba 0,10, joker 0,10, ikili 0,15 | 2000/3600/5400 | **9** |

**Zorluk eğrisi (testere dişi):**

`1,1,2,2,3,3,3,4,4,7 | 3,4,4,5,7,4,5,6,6,8 | 4,5,5,6,8,3,6,7,5,9`

Zirveler 10, 15, 20, 25 ve 30'da. Her zirveden sonra bir rahatlama bölümü geliyor (11, 16, 21, 26). Yeni mekanik hiçbir zaman zirve bölümünde tanıtılmaz.

---

## 9. İlerleme ve meta

### 9.1 Harita
- Dikey kaydırılan bir **çarşı sokağı**. Her bölüm bir dükkân tabelası (yuvarlak düğüm) olarak görünür. Düğümler yılan gibi bir yol üstündedir.
- 10 bölümde bir **bölge kapısı** (kemer) vardır.
  - Bölge 1: **Biber Sokağı**
  - Bölge 2: **Sumak Hanı**
  - Bölge 3: **Zerdeçal Çarşısı**
  - Sonra (31+): Çivit Yokuşu, Tarçın Pasajı…
- Mevcut bölüm düğümü nabız atar. Zerde düğümün yanında oturur. Tamamlanan düğümlerin altında 1–3 yıldız görünür.
- Kilitli bölümler gridir. Önceki bölüm kazanılınca kilit açılır. Bölümleri atlamak mümkün değildir.
- Bölge sonu bölümleri (10, 20, 30) büyük düğümdür ve üstünde sandık ikonu vardır.

### 9.2 Yıldız kuralı
| Yıldız | Koşul |
|---|---|
| 1★ | Tüm hedefler tamamlandı (puandan bağımsız) |
| 2★ | Bitiş puanı (Tezgâh Bonusu dahil) ≥ `stars[1]` |
| 3★ | Bitiş puanı ≥ `stars[2]` |

- Tekrar oynamada en yüksek yıldız saklanır. Toplam yıldız haritanın üstünde görünür.
- MVP'de yıldızın harcanma yeri yoktur; bir başarı göstergesidir. Sonra: dükkân süsleme (§16).

### 9.3 Altın kazanımı
| Kaynak | Miktar |
|---|---|
| Bölümü **ilk kez** kazanma | 1★: 20 · 2★: 30 · 3★: 40 |
| Tekrar oynayıp yıldızı artırma | Yeni ve eski ödül arasındaki fark |
| Kazanılmış bölümü tekrar kazanma | 5 |
| Bölge sandığı (10, 20, 30 ilk galibiyet) | 150 altın + 1 Kepçe + 1 Elek |
| Sonsuz mod | `floor(puan/500)`, en fazla 30 / oyun |
| Günlük ödül | §12 |
| Ödüllü reklam | §11 |

---

## 10. Ekonomi ve güçlendiriciler (booster)

**Tek para birimi: Altın.** İkinci bir premium para yoktur; sadelik istiyoruz. **Can sistemi yoktur** (bkz. Açık sorular). Gerekçe: Reklam gelirli bir oyunda oturum süresi = gelir. Can sistemi kısa vadede satış getirse de erken dönem elde tutmayı düşürme riski taşır **(tahmin)**.

### 10.1 Güçlendiriciler
| Booster | Etki | Kullanım | Fiyat | Açıldığı bölüm (hediye) |
|---|---|---|---|---|
| **Tezgâhı Yenile** | Tepsideki kullanılmamış keseleri yenileriyle değiştirir. Parça hakkı harcanmaz. | Dokun → anında | **100** altın | 4 (2 adet) |
| **Kepçe** | Oyuncu bir sütuna dokunur. O noktayı ortalayan **1 blok genişliğindeki (4 tane) dikey şerit** tepeden tabana boşaltılır (raf ve çuval hariç). Silinen taneler renk hedeflerine sayılır. | Dokun → sütun seç → onayla | **150** altın | 7 (2 adet) |
| **Elek** | Oyuncu bir taneye dokunur. O renkteki **tüm taneler** tahtadan silinir. Gram hedefine sayılır, yol hedefine sayılmaz. Jokere dokunulamaz. | Dokun → tane seç | **250** altın | 12 (2 adet) |
| **Devam (+5 parça)** | Yalnızca kaybetme ekranında: +5 parça hakkı. "Tahta doldu" ile kaybedildiyse ek olarak tahtanın en üstteki 20 satırı (5 blok) temizlenir. | Kaybettin ekranı | 1. kez: **ödüllü reklam veya 300 altın**. Aynı denemede 2. kez: 600 altın. 3. kez yok. | 1'den itibaren (ilk 5 bölümde reklamsız ve ücretsiz 1 kez) |

- Bir bölümde her booster'dan **en fazla 3 kez** kullanılabilir. Bu, puan ve yıldızın anlamlı kalması için.
- Booster kullanımı yıldızı engellemez.

### 10.2 Başlangıç ve kazanım hızı
- **Başlangıç bakiyesi:** 200 altın. Booster'lar açıldıkları bölümde 2'şer hediye edilir.
- **Ödeme yapmayan oyuncu için hedef:** Her 3–4 bölümde 1 booster kullanabilmeli.
- Kaba hesap (**tahmin**). İlk 30 bölüm yaklaşık 3–4 günde oynanır. Bu sürede kazanılan altın:

  | Kaynak | Hesap | Altın |
  |---|---|---|
  | Bölüm galibiyetleri | 30 × ~30 | ~900 |
  | Bölge sandıkları | 3 × 150 | 450 |
  | Günlük ödüller | 4 gün | ~200 |
  | Günlük reklam altını | 4 gün × 90 | ~360 |
  | Başlangıç bakiyesi | — | 200 |
  | **Toplam** | | **~2.100** |

  2.100 altın ≈ 13–15 booster eder. Bunlara 6 adet hediye booster eklenir.
- **Harcama baskısı:** Altının en büyük tüketicisi **Devam (300/600)** olacak. Bu tasarım gereği böyle: zor bölümde "az kaldı" anı, en güçlü satış ve reklam anıdır.

---

## 11. Para kazanma

İlke: **Oyuncu reklamı kendi seçtiğinde bol, zorla gösterildiğinde seyrek.** Reklam ağı: **AdMob** (Capacitor eklentisi) ve onay yönetimi için Google UMP (KVKK/GDPR).

### 11.1 Ödüllü reklam noktaları
| Nokta | Ödül | Sınır |
|---|---|---|
| Kaybettin → "Devam" | +5 parça (ve tahta doluysa üst temizliği) | Deneme başına 1 |
| Kazandın → "Altını 2 katına çıkar" | Bölüm altını ×2 | Bölüm başına 1, yalnızca ilk galibiyette |
| Mağaza → "Bedava altın" | 30 altın | Günde 3 |
| Booster sayısı 0 iken booster'a dokununca → "İzle, 1 tane al" | 1 adet o booster | Günde toplam 3 |
| Günlük ödül → "2 katına çıkar" | Günlük ödül ×2 | Günde 1 |

Toplam ödüllü reklam tavanı **günde 12**'dir.

### 11.2 Geçiş (interstitial) reklam kuralları
Aşağıdaki **tüm** koşullar sağlanırsa gösterilir:
1. Oyuncu **bölüm 8'i kazanmış** olmalı (ilk geçiş reklamı en erken 9. bölümün sonunda gelir).
2. Yalnızca **bölüm sonu ekranından haritaya / sonraki bölüme geçişte** gösterilir. Oyun ortasında, menüde ya da "Tekrar dene"ye basınca **asla** gösterilmez.
3. Son geçiş reklamından bu yana **en az 3 bölüm sonu** geçmiş olmalı (kazanma ya da kaybetme).
4. Son reklamdan (geçiş **veya ödüllü**) bu yana **en az 90 sn** geçmiş olmalı. Ödüllü reklam izleyene ceza olmaz: ödüllü izlendiyse sayaç sıfırlanır.
5. Oturum en az 3 dk sürmüş olmalı.
6. Aynı bölümde **art arda 3 kayıp** varsa o geçişte gösterilmez (öfke anı).
7. Tavan: saatte en fazla 4, günde en fazla 20.
8. "Reklamları Kaldır" satın alındıysa hiç gösterilmez. Ödüllü reklamlar isteğe bağlı olarak kalır.

**Banner reklam yoktur.** Tahta ekranı dolu, banner hem görüntüyü bozar hem az kazandırır **(tahmin)**.

### 11.3 Uygulama içi satın alma (IAP)
Fiyatlar USD kademesidir. TL fiyatı Play Console'daki bölgesel şablonla belirlenecek **(tahmin)**.

| Ürün | İçerik | Fiyat | MVP? |
|---|---|---|---|
| **Reklamları Kaldır** (kalıcı) | Geçiş reklamları kapanır + 500 altın | $2,99 | **Evet** |
| Altın Kesesi | 1.000 altın | $0,99 | **Evet** |
| Altın Sandığı | 6.000 altın (+%20 değer) | $4,99 | **Evet** |
| Başlangıç Paketi (tek seferlik, bölüm 10 sonrası 48 saat) | 2.000 altın + her booster'dan 3 | $1,99 | Sonra |
| Esnaf Paketi | 5.000 altın + her booster'dan 5 + Reklamları Kaldır | $6,99 | Sonra |

**Oyuncuyu kızdırmayan sınırlar (özet):**
- Ödeme duvarı yoktur. Tüm bölümler ücretsiz oynanarak geçilebilir.
- Satın alma açılır pencereleri kendiliğinden en fazla **günde 1** kez çıkar (yalnızca Başlangıç Paketi, sonra).
- Kaybettin ekranında satış kutusu yalnızca "Devam" seçeneğidir. Başka teklif gösterilmez.

---

## 12. Elde tutma

### 12.1 Günlük ödül (MVP)
7 günlük döngüdür. Uygulama günün ilk açılışında açılır pencereyle verilir.

| Gün | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Ödül | 25 altın | 50 altın | 1 Tezgâhı Yenile | 75 altın | 1 Kepçe | 100 altın | 150 altın + 1 Elek |

- **Seri (streak):** Art arda girilen günlerde gün sayacı ilerler. **Bir gün kaçırılırsa 1. güne döner.** 7. günden sonra döngü 1. güne döner, seri sayacı artmaya devam eder (ekranda vektör bir mangal ikonu ve gün sayısı gösterilir).
- Günlük ödül ödüllü reklamla ×2 alınabilir.
- Gün değişimi cihazın yerel saatiyle 00:00'dadır. Saat geri alınarak yapılan hile MVP'de engellenmez (kabul edilen risk).

### 12.2 Diğer MVP elde tutma öğeleri
- Haritada "sonraki bölüm" her zaman tek dokunuş uzaklıkta ("Oyna 12").
- Bölge sandığı hedefi haritada görünür ("Sumak Hanı sandığına 3 bölüm").
- Sonsuz modda kişisel rekor.

### 12.3 Bildirimler (Sonra, v1.1 — yerel bildirim)
| Tetik | Metin |
|---|---|
| Günlük ödül hazır, 20 saat girilmedi | "Zerde tezgâhı açtı, günlük ödülün hazır!" |
| 3 gün girilmedi | "Ayşe Teyze siparişini bekliyor: 12. bölüm seni çağırıyor." |
| Seri 5+ günde ve bugün girilmedi (19:00) | "5 günlük serin bozulmasın!" |

Kurallar: günde en fazla 1 bildirim, 22:00–09:00 arası sessiz, ayarlardan kapatılabilir.

---

## 13. Öğretici (onboarding)

İlkeler:
- Metinler en fazla ~50 karakter.
- Okumadan anlaşılsın diye her adımda **el işareti animasyonu** var: yarı saydam beyaz el, 1,2 sn döngü, başlangıçta ve bitişte "basma" küçülmesi.
- İlk 3 bölümde ekranda üst barın dışında hiçbir düğme görünmez. Booster çubuğu bölüm 4'te belirir.
- Öğretici adımında yanlış bir şey yapılsa da (ör. yanlış yere bırakma) oyun devam eder; el işareti yeniden gösterilir.

### Bölüm 1 — "İlk Tutam" (öğretici `t1`)
| Adım | Ekranda | El işareti | Metin |
|---|---|---|---|
| 1 | Tahtanın üstü dışındaki her yer %60 karartılır. Tepside yalnızca sarı O aktif. | Sarı O'dan tahtadaki sarı boşluğun (5. sütun) üstüne sürükleme yayı | **"Keseyi sürükle, tahtaya bırak!"** |
| 2 | Oyuncu bırakır, baharat akar. Sarı şerit tamamlanır ve patlar. | — | (patlama sonrası) **"Harika! Aynı renk soldan sağa uzanınca patlar."** |
| 3 | Kırmızı I aktif. Kırmızı şeritteki 4 blokluk boşluk parlar. | Kırmızı I'dan boşluğun üstüne | **"Şimdi kırmızı yolu tamamla."** |
| 4 | Kırmızı patlar, hedef tamamlanır. | — | **"Sipariş hazır!"** → Kazandın ekranı (3★ neredeyse garanti) |

İki sabit kese hedefi tamamlar. Kalan 8 hak Tezgâh Bonusu olarak sayılır; oyuncu bir şey yanlış yaparsa serbest tepsi gelir ve el işareti yeniden gösterilir.

### Bölüm 2 — "Doğru Renk" (öğretici `t2`)
| Adım | Ekranda | El işareti | Metin |
|---|---|---|---|
| 1 | Tepside [kırmızı, nane, sarı]. Nane şeridindeki boşluk parlar. | Nane kesesinden nane boşluğuna | **"Doğru rengi doğru yere bırak."** |
| 2 | Parça sayacı (üst bar) parlar ve büyüyüp küçülür. | Sayacı gösteren ok | **"Kese hakkın burada. Bitmeden siparişi tamamla."** |
| 3 | Tepside kalan 2 kese | Önce sağdaki, sonra soldaki keseyi gösteren iki kısa dokunuş | **"Keseleri istediğin sırayla kullan."** |
| 4 | Tepsi boşalınca yeniden dolar | — | **"Üçü bitince yenileri gelir."** |

### Bölüm 3 — "Zincir" (öğretici `t3`)
| Adım | Ekranda | El işareti | Metin |
|---|---|---|---|
| 1 | Tepside dikey bir I (kırmızı). Hedef boşluk dar ve yatay. | Keseye **dokunma** animasyonu (iki kez) | **"Keseye dokun, döner."** |
| 2 | Oyuncu döndürür. El, boşluğun üstüne sürüklemeyi gösterir. | Sürükleme yayı | **"Şimdi bırak!"** |
| 3 | Kırmızı patlar, sarılar düşüp birleşir, ikinci patlama olur. "Zincir ×2!" yazısı çıkar. | — | **"Zincir! Art arda patlamalar puanı katlar."** |
| 4 | Serbest oyun | — | (yok) |

### Yeni mekanik kartları (bölüm 4 ve sonrası)
Bölüm başında bir açılır pencere gösterilir: mekaniğin 2 sn'lik döngü animasyonu ve tek cümle. "Anladım" düğmesiyle kapanır, kart bir daha gösterilmez.

| `intro` kimliği | Bölüm | Metin |
|---|---|---|
| `scoreGoal` | 4 | "Bu siparişte puan topla. Zincirler puanı katlar!" |
| `boosterShuffle` | 4 | "Keseler işine yaramadı mı? **Tezgâhı Yenile**!" |
| `colorPath` | 5 | "Ayşe Teyze pul biber istiyor: kırmızı bir yol patlat." |
| `bomb` | 6 | "**Acı Biber!** Yolu patlarsa çevresini de uçurur." |
| `grains` | 7 | "Siparişi gramla doldur: o renkten tane patlat." |
| `boosterScoop` | 7 | "**Kepçe** ile bir sütunu boşalt." |
| `shelf` | 9 | "**Raf** yerinden oynamaz. Baharat üstünden dökülür." |
| `newColorSumac` | 11 | "Yeni baharat: **Sumak**!" |
| `boosterSieve` | 12 | "**Elek** bir rengi tahtadan tamamen alır." |
| `joker` | 13 | "**Karışık Baharat** her renge uyar, yolları birleştirir." |
| `sack` | 16 | "**Çuvalın** yanında yol patlat, çuval yırtılsın." |
| `twoColor` | 22 | "**İkili Kese**: iki baharat, tek hamle." |
| `newColorIndigo` | 25 | "Yeni baharat: **Çivit**!" |

---

## 14. Oyun hissi (juice) ve ses

### 14.1 Görsel efektler
| An | Efekt | Ayrıntı |
|---|---|---|
| Keseyi tutma | Kaldırma | Kese 1,15× büyür, altına 6 px yumuşak gölge düşer, 80 ms ease-out. Tepsi yuvası boş görünür. |
| Sürükleme | Hayalet | Sütun bandı + tepede %60 saydam siluet. Geçersiz konumda siluet kırmızı tonlanır. |
| Bırakma | "Puf" | Kese çerçevesi 60 ms'de kaybolur. Tepede 12 adet toz parçacığı (kese renginde) yukarı ve yana saçılır. |
| Akış | Doku | Taneler kendi ton varyasyonunu korur. Joker taneler renk döngüsünde, bomba taneleri 0,5 sn'de bir rastgele kıvılcım pikseliyle parlar. |
| Yol bulundu | Yanıp sönme | 380 ms içinde 70 ms aralıkla beyaz yanıp sönme (prototip). |
| Yol patladı | Parçacık | Bölgeden en fazla 120 temsilî parçacık çıkar, yukarı fışkırır (yerçekimiyle). Hedef renkteyse 0,5 sn'de sipariş kesesine uçar ve kese "dolum" animasyonu oynar. |
| Zincir | Yazı | Tahta ortasında büyüyüp sönen yazı (Baloo 2, 800). ×2 **"Güzel!"** · ×3 **"Harika!"** · ×4 **"Muhteşem!"** · ×5 **"Maşallah!"**. Aynı kontrolde 2+ yol olursa **"Çifte!"** |
| Puan | Uçan sayı | Patlama noktasından "+340" yazısı yükselir. Üst bardaki puan sayaç animasyonuyla artar. |
| Acı biber | Patlama | Kırmızı-turuncu daire şok dalgası (r 0→8 tane, 200 ms) + 30 kıvılcım. Pul biberde ×3 ve üstü zincirde Zerde "Hapşu!" der. |
| Çuval | Hasar / yırtılma | Hasar: çuval 4 px sallanır, bir düğüm kopar. Yırtılma: 4 çuval bezi parçası düşer + toz bulutu. |
| Tehlike | Kenar nabzı | Tahtanın üst 2 bloğunda kırmızı degrade %0→%35, 1,2 sn döngü. |
| Kazandın | Kutlama | Tahtadan konfeti gibi renkli baharat yağar (60 parçacık). Yıldızlar 0,35 sn arayla dolar. Zerde zıplar. |
| Kaybettin | Sönme | Tahta %50 karartılır, Zerde'nin kulakları düşer. Ani ya da sert bir efekt kullanılmaz. |

### 14.2 Ekran sarsıntısı
| An | Genlik | Süre |
|---|---|---|
| Yol patlaması (Z=1–2) | 2 px | 150 ms |
| Zincir Z ≥ 3 | 4 px | 220 ms |
| Acı biber | 6 px | 300 ms |
| Çuval yırtılma | 3 px | 150 ms |

Sarsıntı üstel sönümlü rastgele ofsettir. Ayarlardan **kapatılabilir** (erişilebilirlik).

### 14.3 Titreşim (haptics — Capacitor Haptics)
| An | Tür |
|---|---|
| Keseyi tutma | `selection` |
| Bırakma | `impact light` |
| Yol patlaması | `impact medium` |
| Zincir Z ≥ 3, acı biber | `impact heavy` |
| Geçersiz bırakma ("Burası dolu!") | `notification warning` |
| Tehlike bölgesine ilk giriş | `notification warning` (bölüm başına 1 kez) |
| Kazandın | `notification success` |
| Booster kullanımı | `impact medium` |

Ayarlardan kapatılabilir.

### 14.4 Ses listesi (WebAudio ile sentez, harici dosya yok)
| Ses | Ne zaman | Sentez tarifi |
|---|---|---|
| `drop` "puf" | Bırakma | Beyaz gürültü, 80 ms. Low-pass 900 Hz, hızlı atak, 70 ms sönüm. −12 dB. |
| `flow` hışırtı | Kum akarken | Sürekli pembe gürültü. Band-pass 2,5 kHz (Q 0,7). Kazanç = hareket eden tane oranına bağlı (0 → −22 dB), 100 ms yumuşatma. |
| `clear` "tıng" | Yol patlaması | Üçgen dalga arpej C5–E5–G5, her nota 60 ms, hafif reverb (kısa gecikme geri beslemesi). Her zincir adımı perdeyi **+2 yarım ton** yükseltir. |
| `chainWord` | Zincir yazısı | `clear` sesinin bir oktav üstünde sine "parıltı" (2 nota, 40 ms). |
| `double` | Çifte | İki `clear` arpeji 30 ms kaydırmalı. |
| `bomb` | Acı biber | Sine 120→40 Hz, 300 ms sweep + gürültü patlaması (low-pass 600 Hz, 200 ms). |
| `joker` | Joker tane yola katılınca | 3 rastgele sine blip, 2–4 kHz, 30 ms aralık. |
| `sackHit` | Çuval hasarı | Sine 90 Hz, 100 ms + low-pass gürültü (400 Hz). |
| `sackBreak` | Çuval yırtılma | `sackHit` + yüksek geçirgen "cırt" gürültüsü (3 kHz, 150 ms). |
| `rotate` | Döndürme | Kare dalga 600 Hz, 30 ms, −18 dB. |
| `tap` | UI dokunuşu | Kare dalga 1 kHz, 20 ms, −20 dB. |
| `invalid` | Geçersiz bırakma | Kare dalga 150 Hz → 110 Hz, 120 ms. |
| `danger` | Tehlike döngüsü | İki alçak "küt" (sine 60 Hz, 80 ms, aralarında 150 ms), 1,2 sn'de bir tekrar. |
| `goalTick` | Bir hedef tamamlanınca | Sine 880 Hz + 1320 Hz, 90 ms. |
| `star` | Yıldız dolumu | Çan: sine + 2. ve 3. harmonik, 600 ms üstel sönüm. Sırasıyla E5, G5, C6. |
| `win` | Kazandın | **Hicaz** dizisinde 5 notalık motif (D–E♭–F♯–G–A), Karplus-Strong "telli çalgı" sentezi, notalar 110 ms. Türk çarşısı imzası. |
| `lose` | Kaybettin | Aynı tını, inen 3 nota (A–G–F♯), daha yavaş, −6 dB. |
| `coin` | Altın kazanma | İki hızlı sine 1,3 kHz → 1,9 kHz, 50 ms. |
| `booster` | Booster kullanımı | Band-pass gürültü sweep 400 Hz → 3 kHz, 250 ms ("vuuş"). |
| Müzik | — | MVP'de yok. Sonra: Hicaz/Uşşak dizisinde, sentezlenmiş yumuşak bir döngü. |

Ses ayarları: Ses efektleri aç/kapa, Müzik aç/kapa (sonra), ana ses seviyesi. Ses sistemi uygulama arka plana geçince susar.

---

## 15. Ekranlar (UI akışı)

```
Açılış ──► (ilk açılış) Bölüm 1'e doğrudan ──► Kazandın ──► Harita
   │
   └──► (sonraki açılışlar) Ana Menü ──► Harita ──► Bölüm Öncesi ──► Oyun ──► Kazandın / Kaybettin ──► Harita
                    │                                     │
                    ├──► Sonsuz Mod ──► Oyun Bitti         └──► Duraklat ──► (Devam / Yeniden Başla / Harita)
                    ├──► Mağaza
                    └──► Ayarlar
```

**İlk açılış:** Ana menü atlanır, oyuncu doğrudan Bölüm 1'e girer (ilk 10 sn'de oynamaya başlamalı). Onay (UMP) penceresi bölüm 1 bittikten sonra, ilk reklam isteğinden önce gösterilir.

| Ekran | İçerik |
|---|---|
| **Açılış** | Koyu ahşap zemin, logo ("Tutam!"). Zerde göz kırpar. Yükleme çubuğu (hedef < 2 sn). Altta sürüm numarası. |
| **Ana Menü** | Üstte altın göstergesi (+ düğmesi → Mağaza) ve ayarlar dişlisi. Ortada Zerde ve logo. Büyük **"Oyna 12"** düğmesi (mevcut bölüm). **"Serbest Tezgâh"** (Sonsuz; bölüm 8 öncesi kilitli, "8. bölümde açılır" yazar). **"Günün Bulmacası"** (MVP'de gri, "Yakında"). Mağaza ikonu. Günlük ödül açılır penceresi buradan tetiklenir. |
| **Harita** | Dikey kaydırmalı sokak, bölüm düğümleri, yıldızlar, bölge kemerleri, sandık ikonları. Üst bar: geri, toplam yıldız, altın. Mevcut düğüm ekranda ortalanır. |
| **Bölüm Öncesi** (açılır pencere) | Bölüm adı ve no. **Sipariş kartı**: müşteri avatarı ve hedef satırları (ikon + sayı). Parça hakkı. Yeni mekanik varsa küçük "Yeni!" rozeti. **"Başla"** düğmesi, X kapat. |
| **Oyun** | **Üst bar (56 dp):** duraklat (sol), sipariş satırları (orta, en fazla 3, ikon + ilerleme), kalan parça sayacı (sağ, büyük rakam; ≤3 iken turuncu nabız). **Puan çubuğu:** ince yatay bar, 3 yıldız işareti, sağda sayı. **Tahta** (48×80). **Tepsi:** 3 yuva (her biri 96 dp), renk körü modunda sembollü. **Booster çubuğu:** 3 yuvarlak düğme (Yenile / Kepçe / Elek), sağ üstte adet rozeti; 0 ise "▶" reklam rozeti; kilitli booster gizli. |
| **Duraklat** | Devam, Yeniden Başla (onay: "İlerleme kaybolacak"), Haritaya Dön (onay), ses ve titreşim kısayolları. |
| **Kazandın** | Zerde zıplar. 1–3 yıldız animasyonu. Puan ve "Yeni rekor" etiketi. Tezgâh Bonusu sayacı. Kazanılan altın ve **"2 katına çıkar ▶"** (ödüllü). **"Devam"** (→ harita, düğüm ilerleme animasyonu → sonraki bölüm). Bölge sonuysa sandık açılma animasyonu. |
| **Kaybettin** | Sebep başlığı: **"Keseler bitti!"** ya da **"Tezgâh doldu!"**. Sipariş ilerlemesi ("3/4 yol — az kaldı!"). **"Devam et +5 ▶"** (ödüllü) ve **"300 altın"** düğmeleri. "Tekrar dene". "Haritaya dön". |
| **Sonsuz – Oyun Bitti** | Puan, rekor, kazanılan altın, "Tekrar", "Menü". |
| **Mağaza** | Reklamları Kaldır, 2 altın paketi, "Bedava altın ▶" (3/gün kalan), booster'ları altınla satın alma (1'li). "Satın alımları geri yükle". |
| **Ayarlar** | Ses efektleri, Titreşim, Ekran sarsıntısı, Renk körü modu (sembol katmanı), Dil (MVP: Türkçe; English "Yakında"), Gizlilik politikası (bağlantı), Gizlilik seçenekleri (UMP yeniden aç), Satın alımları geri yükle, Sürüm. |
| **Günlük Ödül** (açılır pencere) | 7 günlük şerit, bugünkü kutu parlar. "Al" ve "2 katı ▶". |

**Genel UI kuralları:**
- Dikey ekran.
- Dokunma hedefleri en az 48 dp.
- Ekran kenarında 16 dp boşluk, güvenli alan (çentik) payları uygulanır.
- Tüm metinler Türkçe ve tek bir `strings.tr.json` dosyasında tutulur (İngilizce sonra eklenecek).
- 60 FPS hedefi.
- Android geri tuşu: Oyun → Duraklat. Harita → Ana Menü. Ana Menü → "Çıkılsın mı?".

---

## 16. MVP kapsamı ve sonrası

### MVP (6–8 hafta, Android, Türkçe)
- [ ] Kum motoru: 48×80, blok 4, tohumlu RNG, 3 adım/kare, duruldu tespiti, yol bulma (4-komşu, joker destekli), zincir, puan
- [ ] Parça sistemi: 7 tetromino, adil torba, dokun-döndür, sürükle-bırak, hayalet, geri dönme
- [ ] Özel öğeler: **Acı Biber, Karışık Baharat, Raf, Çuval, İkili Kese**
- [ ] Hedefler: `clear_paths` (renkli/renksiz), `score`, `clear_color_grains`, `clear_obstacles`. Parça limiti.
- [ ] Bölüm yükleyici (JSON, §18) + bölüm doğrulayıcı (hazır yol yok, çuval sayısı yeterli, `stars[0]` kuralı)
- [ ] **30 bölüm** (3 bölge) + QA botuyla geçme oranı kalibrasyonu
- [ ] **Sonsuz mod**
- [ ] Harita, yıldızlar, altın, bölge sandığı
- [ ] Booster'lar: Tezgâhı Yenile, Kepçe, Elek, Devam
- [ ] Öğretici t1–t3 + 13 mekanik kartı
- [ ] Günlük ödül (7 gün) + seri
- [ ] Juice: efektler, sarsıntı, titreşim, **sentez sesler** (müzik hariç)
- [ ] Ekranlar: §15'teki tümü (Günlük Bulmaca "Yakında" olarak)
- [ ] Tema dosyası (renk/isim/sembol) + renk körü sembolleri
- [ ] Zerde (vektör) + 4 müşteri avatarı
- [ ] Yerel kayıt (Capacitor Preferences): ilerleme, yıldız, altın, booster, ayarlar, günlük durum
- [ ] AdMob: ödüllü + geçiş (kurallarıyla), UMP onayı
- [ ] IAP: Reklamları Kaldır + 2 altın paketi (Google Play Billing)
- [ ] Analitik (Firebase): `level_start`, `level_win`, `level_fail{reason}`, `booster_use`, `continue_use`, `ad_shown{type,placement}`, `iap_purchase`, `tutorial_step`
- [ ] Android paketleme (Capacitor) + GitHub Actions APK/AAB derlemesi

### Sonra
| Sürüm | İçerik |
|---|---|
| v1.1 (MVP + 3–4 hafta) | Günlük Bulmaca, Nemli Baharat, bölüm 31–60 (Çivit Yokuşu, Tarçın Pasajı; Tarçın rengi), yerel bildirimler, İngilizce, Başlangıç Paketi, müzik |
| v1.2 | Lodos, dükkân süsleme meta'sı (yıldız harcama), etkinlikler (Ramazan / Yılbaşı temalı bölüm paketleri, rapordaki takvime göre), bulut kayıt |
| v1.3+ | iOS, liderlik tablosu (Sonsuz/Günlük), haftalık turnuva, ek temalar (tema dosyasıyla) |
| **Yapılmayacak (bilinçli)** | Can/enerji sistemi (yeniden değerlendirilebilir), banner reklam, çok oyunculu, hikâye/sinematik |

---

## 17. KPI hedefleri

> Aşağıdakiler **hedeftir**. Casual bulmaca türü için sık anılan kıyas değerlerine dayanır ve bu oturumda birincil kaynaktan **doğrulanmadı**. Gerçek kıyas için yayın öncesi güncel bir rapora (ör. GameAnalytics, AppsFlyer, Adjust) bakılmalı.

| KPI | MVP kabul eşiği | İyi | Not |
|---|---|---|---|
| Öğretici tamamlama (bölüm 3'ü bitiren / yükleyen) | ≥ %85 | ≥ %92 | Altındaysa ilk 3 bölümü kısalt |
| Bölüm 10'a ulaşma (D0) | ≥ %50 | ≥ %65 | |
| **D1 elde tutma** | ≥ %35 | ≥ %45 | Yayıncılar genelde %40+ ister **(doğrulanmadı)** |
| **D7 elde tutma** | ≥ %10 | ≥ %18 | |
| D30 elde tutma | ≥ %3 | ≥ %6 | |
| **Ortalama oturum süresi** | ≥ 6 dk | ≥ 9 dk | |
| Günlük oturum sayısı | ≥ 2,5 | ≥ 3,5 | |
| Günlük oyun süresi (DAU başına) | ≥ 15 dk | ≥ 25 dk | |
| Ödüllü reklam / DAU | ≥ 1,5 | ≥ 3 | |
| Geçiş reklamı / DAU | 2–5 | — | 6'yı geçerse kurallar gevşemiş demektir |
| Bölüm başına ortalama deneme (1–30) | 1,3–1,8 | — | Zirve bölümler 2–3 olabilir |
| Mağaza puanı | ≥ 4,2 | ≥ 4,5 | |

**Karar kuralı (test sonrası):** D1 < %30 **ve** öğretici tamamlama < %80 ise çekirdek his ya da öğretici sorunludur; içerik eklenmez, önce bunlar düzeltilir. D1 ≥ %40 ve D7 ≥ %15 ise içerik (bölüm 31–60) ve küçük UA testine geçilir.

---

## 18. Bölüm veri formatı

Teknik liderin taslak şeması **olduğu gibi korunur**. Aşağıdaki alanlar **eklenmiştir** ve hepsi **opsiyoneldir**. Bilinmeyen alanlar motor tarafından yok sayılmalıdır, böylece şema geriye uyumlu kalır.

### 18.1 Eklenen ya da genişletilen alanlar (açık liste)
| Alan | Tür | Varsayılan | Amaç |
|---|---|---|---|
| `goals[].type: "clear_color_grains"` | `{type, color, count}` | — | Yeni hedef türü (§7) |
| `goals[].type: "clear_obstacles"` | `{type, count, kind?}` | `kind: "sack"` | Yeni hedef türü (§7) |
| `specials.jokerChance` | 0–1 | 0 | Kese başına joker blok olasılığı |
| `specials.twoColorChance` | 0–1 | 0 | Kese başına ikili kese olasılığı |
| `prefill.legend` değeri `"joker"` | `{"J": "joker"}` | — | `pattern` ön dolumunda joker tane (motordaki `legend` genişletilir) |
| `obstacles[].type` | `"shelf"` \| `"sack"` | `"shelf"` | Motordaki taş engel (`{x,y,w,h,unit}`) = **Raf**. `type` yoksa raf sayılır, mevcut veriler bozulmaz. |
| `obstacles[].hp` | 1–3 | 1 | Yalnızca `type: "sack"` için. Çuvalın `w`/`h` değeri yoksa 2×2 blok. |
| `scriptedPieces` | `[{shape, color, rot?, bomb?, joker?, colors?}]` | `[]` | Baştaki sabit keseler (öğretici/tanıtım). `colors: [a,b]` ikili kese için. `bomb`/`joker`: bloğun indeksi (0–3). |
| `tutorial` | string \| null | null | Öğretici senaryosu (`"t1"`, `"t2"`, `"t3"`) |
| `intro` | string[] | `[]` | Bölüm başında gösterilecek mekanik kartları (§13 kimlikleri) |
| `customer` | string | `"ayse"` | Sipariş kartındaki avatar (`ayse`, `mehmet`, `selim`, `anna`) |
| `difficulty` | 1–10 | — | Bot kalibrasyonu ve analitik için meta veri |
| `board` | `{w, h, block}` | `{48, 80, 4}` | İleride farklı tahta boyutu (MVP'de kullanılmaz) |

**Motorda zaten olan ve aynen kullanılan alanlar:** `pieces` (şekil kısıtı), `hint` (kısa Türkçe ipucu), `prefill` türleri `none` / `random` / `pattern`, `obstacles` için `{x, y, w, h, unit}`.

**Anlam netleştirmeleri (alan eklemeden):**
- `colors`: tema paletindeki indeksler (1=Pul Biber, 2=Zerdeçal, 3=Nane, 4=Sumak, 5=Çivit, 6=Tarçın).
- `stars`: `[1★, 2★, 3★]` eşikleri. Motordaki `computeStars` ile aynı: kazanınca en az 1★, her geçilen eşik +1. `score` hedefi varsa `stars[0] = value`.
- `seed`: §4.2'deki kural.
- `pieceLimit`: `null` ya da yoksa sınırsız (Sonsuz mod).

### 18.2 Ön dolum biçimleri (motorla aynı)
```jsonc
{ "type": "none" }

// Tohumlu rastgele 4×4 topaklar. DİKKAT: `rows` TANE satırıdır (blok satırı × 4).
// §8 tablosundaki "6 satır" = "rows": 24.
{ "type": "random", "rows": 24, "density": 0.85, "colors": [1, 2] }

// Resim: satırlar ÜSTTEN alta yazılır ve tabana hizalanır.
// Satır genişliği 12 karakter (1 karakter = 1 blok) ya da 48 karakter (1 karakter = 1 tane).
// '.' boş, '#' taş (raf), '1'–'6' renk; diğer karakterler `legend` ile ("J": "joker" eklenir).
{ "type": "pattern", "rows": ["1111....1111", "2222.2222222"] }
```
Yükleyici kuralları:
- Engeller ön dolumdan **önce** yerleştirilir; ön dolum engelin olduğu hücreye yazılmaz.
- Ön dolum yerleştirilir, sonra **durultulur** (oyuncu görmeden simüle edilir).
- Ardından yol kontrolü yapılır. Hazır yol varsa geliştirme modunda hata verilir.

### 18.3 Örnek: Bölüm 1
```json
{
  "id": 1,
  "name": "İlk Tutam",
  "colors": [1, 2],
  "pieceLimit": 10,
  "goals": [{ "type": "clear_paths", "count": 2 }],
  "stars": [500, 1000, 1400],
  "prefill": { "type": "pattern", "rows": ["1111....1111", "2222.2222222"] },
  "obstacles": [],
  "specials": { "bombChance": 0, "jokerChance": 0, "twoColorChance": 0 },
  "seed": 1001,
  "pieces": ["I", "O"],
  "scriptedPieces": [
    { "shape": "O", "color": 2, "rot": 0 },
    { "shape": "I", "color": 1, "rot": 0 }
  ],
  "tutorial": "t1",
  "intro": [],
  "customer": "ayse",
  "difficulty": 1
}
```
*Not:* Sarı boşluk 5. sütunda (indeks 4) ve kırmızı boşluğun (4–7) tam altında. Böylece durultma sırasında üstteki kırmızı bu boşluğa düşmez. Sarı O, boşluğun üstüne (blok sütunu 4–5) bırakılınca sarı boşluğu doldurur ve yol olur. Sarı patlayınca kırmızı şerit bir blok iner. Kırmızı I boşluğa bırakılınca ikinci yol tamamlanır.

### 18.4 Örnek: Bölüm 16 (çuval)
```json
{
  "id": 16,
  "name": "Çuvallar",
  "colors": [1, 2, 3],
  "pieceLimit": 18,
  "goals": [{ "type": "clear_obstacles", "count": 3, "kind": "sack" }],
  "stars": [900, 1800, 2700],
  "prefill": { "type": "random", "rows": 16, "density": 0.9 },
  "obstacles": [
    { "type": "sack", "x": 1, "y": 18, "w": 2, "h": 2, "hp": 1 },
    { "type": "sack", "x": 5, "y": 18, "w": 2, "h": 2, "hp": 1 },
    { "type": "sack", "x": 9, "y": 18, "w": 2, "h": 2, "hp": 1 }
  ],
  "specials": { "bombChance": 0, "jokerChance": 0, "twoColorChance": 0 },
  "seed": 16016,
  "intro": ["sack"],
  "customer": "mehmet",
  "difficulty": 4
}
```

### 18.5 Örnek: Bölüm 9 (raf)
```json
{
  "id": 9,
  "name": "Raflar",
  "colors": [1, 2, 3],
  "pieceLimit": 18,
  "goals": [{ "type": "clear_paths", "count": 3 }],
  "stars": [800, 1600, 2400],
  "prefill": { "type": "random", "rows": 8, "density": 0.9 },
  "obstacles": [
    { "type": "shelf", "x": 0, "y": 10, "w": 3, "h": 1 },
    { "type": "shelf", "x": 9, "y": 10, "w": 3, "h": 1 }
  ],
  "specials": { "bombChance": 0 },
  "seed": 9009,
  "intro": ["shelf"],
  "customer": "selim",
  "difficulty": 4
}
```

### 18.6 Motorla uyum: tasarımın motordan farklı olduğu noktalar
Bu GDD yazılırken `game/` klasöründeki taslak motor incelendi (yalnızca okundu). Aşağıdaki maddeler **motor tarafında küçük değişiklik** ister:

| Konu | Motor (şu an) | GDD kararı | Yapılacak |
|---|---|---|---|
| Hedef türü | `clear_paths`, `score`, `clear_color_grains` | + `clear_obstacles` | Yeni hedef türü kaydı + HUD metni |
| Engel | Yalnızca taş (`STONE`) | + çuval (`type:"sack"`, `hp`) | Canlı statik hücre, komşuluk hasarı |
| Özel taneler | `bomb` | + joker, ikili kese | `SPECIALS` listesine joker; parça modelinde blok başına renk |
| Puan | `tane × 1 × zincir` | `(tane + 100) × Z`, Z tavanı 5; Tezgâh Bonusu 100/parça | `PATH_BONUS = 100`, `CHAIN_MAX = 5`, `END_BONUS_PER_PIECE = 100` config'e |
| Zincir sıfırlama | Her bırakışta (`drop` içinde `chain = 0`) | Tahta duruldu ve yol yoksa | Açık soru #7. Onaylanırsa sıfırlama `settled && !found` anına taşınır. |
| Tohum | `deriveSeed(seed, akış)`; `opts.seed` tüm akışları değiştirir | Ön dolum sabit, parça ve fizik denemeye göre değişir | `STREAM_BOARD` her zaman `level.seed` ile; diğer akışlar `seed + deneme × 7919` ile |
| Bomba yarıçapı | `BOMB_RADIUS = 8` | 8 (uyumlu) | — |
| Tahta | 48 × 80, blok 4 | Aynı (uyumlu) | — |

---

## 19. Açık sorular (kullanıcıya)

1. **İsim:** "Tutam! / Pinch!" ile devam edelim mi, yoksa diğer 4 öneriden biri mi? Marka ve mağaza taramasını kim, ne zaman yapacak?
2. **Tema ve maskot:** Baharat Çarşısı + çarşı kedisi **Zerde** kesinleşsin mi? Alternatif: maskot yerine esnaf karakteri (ör. "Nuri Usta").
3. **Can (enerji) sistemi:** Önerim MVP'de **yok**. Gelir modelinde IAP ağırlığını artırmak isterseniz 5 can / 30 dk yenilenme eklenebilir.
4. **Banner reklam:** Önerim **yok**. Kabul mü?
5. **Tahta inceliği:** 48×80 (blok 4) önerildi. Daha "ince kum" hissi için 60×100 (blok 5) denensin mi? Biraz daha fazla işlem gücü ister; görünüş daha tatmin edici olabilir. Prototipte A/B denemesi önerilir.
6. **Döndürme:** Dokun-döndür kalsın mı? Kum dağıldığı için döndürmenin etkisi sınırlıdır. Kaldırılırsa kontrol sadeleşir ama dar raf geçitlerinde kontrol azalır.
7. **Zincir sıfırlama:** Prototipteki "her bırakışta sıfırla" yerine "tahta duruldu ve yol yoksa sıfırla" kuralını önerdim. Uygun mu?
8. **Ses kimliği:** Hicaz dizisinde "telli çalgı" imzası uygun mu? Müzik sentezle mi yapılsın, lisanssız hazır bir parça mı alınsın?
9. **Dil:** İngilizce MVP'ye mi alınsın (küresel test için), v1.1'e mi?
10. **Yayın yolu:** Kendi hesabımızla mı yayınlıyoruz, yoksa bir yayıncıya mı sunulacak? Yayıncılar Unity isteyebilir (`OYUN_TASARIMI.md`).
11. **Fiyatlar:** "Reklamları Kaldır" $2,99 ve paketler. TL fiyatlarını Play'in bölgesel şablonu mu belirlesin, elle mi?
12. **İçerik:** Bölüm 31+ için elle tasarım mı, yoksa doğrulayıcı + bot ile yarı otomatik üretim mi?

---

## Ek A: 8 haftalık iş planı (tek kodlayıcı)

| Hafta | İş | Çıktı |
|---|---|---|
| 1 | Motor: tohumlu RNG, 48×80 simülasyon, yol bulma (joker dahil), zincir, puan, tepsi, sürükle-bırak, döndürme | Oynanabilir çekirdek (prototip yerine) |
| 2 | Bölüm yükleyici + doğrulayıcı, hedefler, parça limiti, yıldız, kazan/kaybet | Bölüm 1–5 oynanır |
| 3 | Özel öğeler: Raf, Çuval, Acı Biber, Joker, İkili Kese. Booster'lar. | Tüm mekanikler hazır |
| 4 | 30 bölümün verisi + QA botu (otomatik oynama, geçme oranı, yıldız kalibrasyonu) | `levels/*.json`, kalibrasyon raporu |
| 5 | Ekranlar, harita, kayıt, günlük ödül, öğretici, mekanik kartları | Uçtan uca akış |
| 6 | Juice: parçacıklar, sarsıntı, titreşim, sentez sesler, Zerde animasyonları, tema dosyası | "Hissi" tamam |
| 7 | AdMob + UMP, IAP, Firebase analitik, Android paketleme, CI derlemesi | İmzalı AAB |
| 8 | QA turu, performans (orta seviye cihazda 60 FPS), Play kapalı test, TikTok/Reels için 5 kısa kayıt | Kapalı test sürümü |

Tampon: 6. ve 8. haftalar sıkışırsa ilk ertelenecekler, sırasıyla, İkili Kese (bölüm 22–30'daki kullanımları kaldırılır), müşteri avatarları (yalnızca Zerde kalır) ve Mağaza'daki altın paketleri (yalnızca Reklamları Kaldır kalır).
