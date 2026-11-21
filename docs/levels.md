# Bölümler 1–30: tasarım ve kalibrasyon

> **Yazan:** Bölüm Tasarımcısı · **Dayanak:** GDD §4, §5, §7, **§8**, §13, §18
> **Veri:** `game/src/levels/data/001.json … 030.json` · **Araç:** `game/scripts/calibrate-levels.mjs` (+ `calibrate-levels.core.ts`)

## 1. Bölüm tablosu

Bot oranları, her bölümün **30 denemesinden** (deneme 0–29; GDD §4.2'ye göre tahta sabit, parça ve fizik denemeye göre değişir) gelir.
"Hedef oran" = GDD §8'deki zorluk → ilk denemede geçme oranı (aradaki değerler doğrusal).
Yıldızlar hedef-bilinçli botun **kazandığı** oyunlardan hesaplandı: 2★ = medyan, 3★ = 80. yüzdelik; puan hedefi olan bölümde 1★ = hedef puanı (GDD §8).

<!-- TABLE -->

Bütün bölümler GDD §18 alanlarını taşır: `id, name, difficulty, customer, colors, pieceLimit, goals, stars, prefill, obstacles, specials (bomb/joker/twoColor), seed (= id × 1001), intro, hint`; öğreticiler (1–3) ayrıca `tutorial` ve `scriptedPieces`, 1. bölüm `pieces: ["I","O"]`. Tanıtım bölümlerinde sabit ilk kese var: 6 (bombalı T), 13 (jokerli L), 22 (ikili I).

## 2. GDD §8'den sapmalar ve nedenleri

GDD tablosu "ilk tahmin" olarak verilmişti. Hedefler, renkler, mekanik sırası, ön dolum yoğunlukları ve zirve yerleri korunarak aşağıdakiler değişti:

| Konu | Değişiklik | Neden |
|---|---|---|
| Parça limitleri | Çoğu bölümde GDD'den yüksek (tabloda "GDD n" notu); 9 ve 10'da düşük | Bot kalibrasyonu. Bot 4 renkte ortalama ~6–8 kesede bir yol açabiliyor; GDD sayıları bu hızla tutmuyordu. 9 ve 10 ise beklenenden kolaydı. |
| Ön dolum desenleri | Öğretici boşlukları 45° "V" çentiği (tane çözünürlüğünde, 48 karakter) | Blok çözünürlüklü boşluklar yüklemede yanlardan çöküp kendiliğinden yol oluyordu (1. bölümde hazır yol çıktı). 45° eğim kumda duraklı. |
| 3 Zincir | Alt nane şeridindeki "kazık" kırmızı | Sarı kazık zincirde nane yolunu da açıp bölümü tek kesede bitiriyordu; şimdi kırmızı → sarı zinciri (×2) olur, 3. yol serbest oyundan gelir. |
| 12, 18, 23 (gram), 14, 21, 28, 29, 30 | "Domino bantlar": tam şeritler, her şeridin içinde bir üst şeridin renginde tek blokluk tıkaç; üst şeridin çentiği doldurulunca zincir aşağı doğru ilerler, "kırık" (yabancı renk) tıkaç zinciri durdurur | Rastgele ön dolum gömülü kalıyor, gram ve puan hedefleri yalnızca yeni kesenin tanesiyle tutmuyordu. GDD 21/29 "bantlar neredeyse tamam, yüksek zincir" tarifinin kumda çalışan karşılığı bu. |
| 12 Elek | 500 g → **400 g** sumak | 26 kesede bile 500 g'ye bot yaklaşamadı. |
| 23 Çifte Sipariş | 500 + 500 g → **400 + 400 g** | Aynı neden. |
| 24 Raf Labirenti | 5 yol → **4 yol**; raflar duvardan 1 blok içeride ve daha yukarıda | Duvara yapışık raflar altında boşluk bırakıp her satırın duvar temasını kesiyordu; bot 49 kesede ancak kazanıyordu. |
| 14 Rafta Sıra | Merdiven rafları 4 yerine **2'şer blok** | 4 bloklu merdiven kumu çapraz şeritlere ayırıp neredeyse hiç yol bırakmıyordu (24 denemede 13'ü hiç kazanamadı). |
| Çuvallar (16, 17, 20, 27, 30) | Çuvallar ön dolumun **yüzeyine** (üstü yüzeyle aynı hizada) taşındı; 17'de 1, 20'de 3, 27'de 1 çuvalın canı GDD'den 1 düşük | Gömülü çuvala yol değmiyor (yollar yüzeyde oluşur). Can 2–3'lü çok çuval botla kazanılamıyordu. |
| 30 Çarşı Ağası | Ön dolum 9 → 8 satır domino; ortadaki çuval çentiği örtmeyecek yerde | Final yine en zor bölüm; üç hedefin üçü de tek tahtada ulaşılabilir kalmalı. |

## 3. Kalibrasyon yöntemi

- **Deneme kuralı:** Her deneme `new Session(level, { attempt })`. Tahta bölüm `seed`'iyle hep aynı, parça ve fizik akışları `seed + deneme × 7919` (GDD §4.2). Varsayılan 30–40 deneme (GDD 200 öneriyor; `--trials 200` ile çalışır, 4 çekirdekte ~1,5 saat).
- **İki bot** (ikisi de tek hamle ileriyi görür, plan yapmaz):
  - **Açgözlü** = `src/dev/bot.ts` (GDD'deki QA botu). Yalnızca aynı renk bölgelerini genişletir; hedefleri, jokeri ve çuvalı bilmez.
  - **Hedef-bilinçli** = `scripts/calibrate-levels.core.ts` içindeki `chooseSmartMove`. Aynı arama (her yuva × dönüş × blok sütunu), puanlama ise şöyle: hamlenin tetiklediği temizliğin hedef katkısı (yol, hedef renk tanesi, çuval vuruşu, puan), ardından tahtanın şekli (gereken renkler ağırlıklı, joker her renge sayılır, çuvala değen bölge ödüllü) ve yığın yüksekliği cezası. **Zorluk ve yıldızlar bu botla ayarlandı**; açgözlü botun oranı karşılaştırma için tabloda.
- **Parça limiti taraması** (`--sweep`): Bot sınırsız parçayla oynar ve her denemede hedeflerin kaçıncı kesede bittiğini kaydeder. Botun seçimi limite bağlı olmadığı için herhangi bir L limitinde kazanma oranı ≈ P(gereken ≤ L). Tek koşu bütün eğriyi verir; önerilen limit, zorluğun hedef oranına ulaşan en küçük L'dir.
- **Yıldızlar** (`--apply`): Kazanılan oyunların bitiş puanı (Tezgâh Bonusu dahil) → 2★ = medyan, 3★ = 80. yüzdelik, 50'ye yuvarlanır. 1★ = puan hedefi varsa hedef değeri, yoksa kazanılanların 10. yüzdeliği (yalnızca ilerleme çubuğu işareti; kazanınca 1★ zaten garanti). En az 5 galibiyet yoksa yıldızlar yazılmaz.
- **Doğrulama:** `--show N` başlangıç tahtasını ASCII olarak basar ve hazır yol sayısını yazar (GDD §8: ön dolumda hazır yol olamaz). `tests/levels.test.ts` aynı kuralı CI'da denetler. `tests/calibrate.test.ts` her bölümün hatasız hazırlandığını ve motorda olmayan bir mekanik kullanmadığını denetler.

### Bot neden insandan farklı?
- Bot **tek hamle** ileriyi görür. "Önce şu rengi alta koyayım, iki hamle sonra yol olur" diye plan yapamaz, tepsi sırasını da kullanmaz. Kum dökülürken çapraz renk şeritleri biriktirir (özellikle raflı tahtalarda), insan bunu görüp kaçınır. Bu yüzden insan büyük olasılıkla daha **az** keseyle bitirir. Limitler botla ayarlandığı için gerçek oyuncu için bölümler tablodakinden **daha kolay** olacaktır; kapalı testte ilk denemede geçme oranı ölçülüp limitler 1–3 kese düşürülebilir.
- Buna karşılık bot hiç hata yapmaz (yanlış sütuna bırakma, dalgınlık) ve tüm konumları dener. Bu yüzden öğretici bölümlerde (1–3) insanla bot yakın olmalı.
- Açgözlü bot hedef bilmediği için gram, renkli yol ve çuval bölümlerinde çok düşük kalır (örn. çuvallarda %0–10). Bu sayılar zorluk ölçüsü değil, bilgi amaçlı.
- Yıldız eşikleri bot puanından geldiği için iyi bir oyuncu 3★'ı görece kolay alabilir. Hedef: 3★ ustalık göstergesi olsun; testte 3★ oranı %40'ı geçerse eşikler yükseltilmeli.

## 4. Yeniden kalibrasyon (Oynanış Mühendisi bitince / kural değişince)

Motor kuralı (puan, zincir, bomba yarıçapı, çuval hasarı vb.) değişince oranlar ve yıldızlar kayar. `game/` klasöründe:

```bash
# 1) Hangi mekaniklerin motorda olduğunu ve hazır yol olmadığını kontrol et
node scripts/calibrate-levels.mjs --show 1-30 | grep "hazır yol"
# 2) Parça limitlerini tara (sınırsız parça; önerilen limit = zorluğun hedef oranı)
node scripts/calibrate-levels.mjs --sweep --trials 40
#    -> önerilen limitleri ilgili JSON'lara elle yaz (pieceLimit)
# 3) Tam kalibrasyon (iki bot) + yıldızları JSON'a yaz
node scripts/calibrate-levels.mjs --trials 40 --apply --md /tmp/kalibrasyon.md
# 4) Testler
npm run build && npm test
```

Seçenekler: `--levels 10,15,20-25`, `--bot smart|greedy|both`, `--jobs 4`, `--json out.json`. Vitest ile (tek iş parçacığı, yavaş): `CALIBRATE=1 CAL_TRIALS=20 npx vitest run tests/calibrate.test.ts --silent=false`.
Motorda henüz olmayan bir mekanik kullanan bölüm tabloda "mekanik bekleniyor" diye işaretlenir. `--apply` o bölümün yıldızlarını yazmaz. Şu an dört mekaniğin dördü de (sabit tepsi, joker, ikili kese, çuval) motorda var.
