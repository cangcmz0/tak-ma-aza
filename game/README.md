# Kum Akışı — oyun projesi

Kum bulmacası mobil oyunu. **Vite + TypeScript (strict) + saf Canvas 2D + Vitest**, Android/iOS paketleme için **Capacitor** hazır.
Oyun motoru kütüphanesi kullanılmaz.

## Çalıştırma

```bash
cd game
npm install
npm run dev        # geliştirme sunucusu (http://localhost:5173, LAN'dan telefonla da açılır)
npm test           # vitest birim testleri (motor, hedefler, oturum, bölümler, kayıt, bot)
npm run build      # tsc --noEmit + vite build -> dist/
npm run preview    # dist/ çıktısını sun (http://localhost:4173)
```

Tarayıcı smoke testi (Playwright global kurulu olmalı; `playwright install` gerekmez):

```bash
npm run build && npx vite preview --port 4173 &
NODE_PATH=$(npm root -g) node scripts/smoke.cjs /tmp/ekranlar
```

Hata ayıklama: URL'ye `?debug=1` ekle → `window.__app`, oynarken `window.__kum.session` / `window.__kum.scene`.
`?debug=1&unlockAll` tüm bölümleri açar. Masaüstü tuşları: ←/→ kaydır, ↑ veya R döndür, Boşluk/↓ bırak, 1–3 parça seç, Esc duraklat.

### Android

Android projesi `android/` klasöründe (Capacitor 8, appId `com.takmaaza.kumbulmaca`, ad "Kum Akışı",
`versionCode 1` / `versionName "0.1.0"` → `android/app/build.gradle`). Sadece dikey ekran; arka plan koyu `#14112b`.

- **APK'yı GitHub derler:** `game/**` değişen her push'ta (`main`, `ccr-*`) veya elle (Actions → *Android APK* → *Run workflow*)
  `.github/workflows/android-apk.yml` çalışır: `npm ci` → `npm test` → `npm run build` → `npx cap sync android` → `./gradlew assembleDebug`.
  APK: Actions → çalışma → Artifacts → `kum-akisi-debug-apk`. Telefona kurulum ve Play Store adımları: [`docs/release.md`](../docs/release.md).
- **Web kodu değişince:** `npm run cap:sync` (build + `cap sync`). `android/app/src/main/assets/public` ve Capacitor'un ürettiği
  config dosyaları git'e girmez; CI her seferinde yeniden üretir.
- **Yerelde derleme** (Android SDK + JDK 21 gerekli): `cd android && ./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.
- **İkon / açılış görseli:** `NODE_PATH=$(npm root -g) node scripts/make-icons.cjs` (Playwright ile canvas → PNG; mipmap'ler,
  adaptive ön plan, `splash.png`'ler ve mağaza ikonu `store/icon-512.png`). Adaptive arka plan rengi `res/values/ic_launcher_background.xml`.
- Renk değişirse üç yer birlikte güncellenir: `src/render/theme.ts` (`--bg`), `capacitor.config.ts`, `android/app/src/main/res/values/colors.xml`.
- `vite.config.ts` içinde `base: './'` — WebView içinde göreli yollarla çalışır.

## Mimari

```
src/
  config.ts               Sabitler: ızgara 48×80 tane, blok 4×4, sim tick hızı, adım/tick, flaş süresi, puan
  main.ts                 Açılış: tema, kayıt, servisler, sahne yığını, rAF döngüsü, resize, arka plana geçince duraklat
  core/rng.ts             mulberry32 seed'li RNG + deriveSeed (bağımsız akışlar)
  core/events.ts          Tipli event emitter
  engine/grid.ts          SandGrid: Uint8Array color / shade / flags (FLAG_STATIC, FLAG_BOMB), STONE=255
  engine/sim.ts           step(): kum fiziği (aşağı, sonra çapraz); statik hücreler düşmez; hareket sayısı döner (0 = duruldu)
  engine/clear.ts         findClears(): 4-komşuluk, sol duvar↔sağ duvar aynı renk bölgeleri; ClearResult önceden ayrılmış tamponlar
  engine/specials.ts      Özel tane kaydı (bomba). Patlama temizliğe dahil olunca onClear() ek hücre işaretler
  engine/pieces.ts        Tetrominolar (I O T L J S Z), önceden hesaplanmış dönüşler, canStamp/stamp, fitsAnywhere
  game/session.ts         Bir bölüm denemesi: tepsi, skor, zincir, hamle sayısı, hedefler, kazan/kaybet; sabit tick ile deterministik
  game/goals.ts           Hedef türleri kaydı (GOAL_TYPES), GoalTracker, yıldız hesabı
  game/setup.ts           Başlangıç tahtası: engeller + prefill (none/random/pattern), durultma, kazara yolları bozma
  levels/schema.ts        LevelDef tipi + validateLevel() (okunur hata mesajları, bilinmeyen alanlar korunur)
  levels/levels.ts        levels/data/*.json otomatik yüklenir (import.meta.glob), doğrulanır, id'ye göre sıralanır
  levels/data/001..005    5 örnek bölüm
  render/theme.ts         Tüm renkler + CSS değişkenleri tek yerde; ImageData için paketlenmiş palet
  render/boardRenderer.ts 1:1 ImageData → en yakın komşu büyütme (tam sayı cihaz pikseli/tane), hayalet parça, patlama yanıp sönmesi
  render/piecePreview.ts  Tepsi önizlemesi
  input/pointer.ts        Tepsiden sürükle-bırak, tahtaya dokun-kaydır-bırak, seçili parçaya tekrar dokun = döndür; tek parmak takibi
  input/keyboard.ts       Masaüstü tuşları
  ui/app.ts               App bağlamı + SceneManager (replace/push/pop, overlay)
  ui/menu.ts, levelSelect.ts, play.ts, pause.ts, result.ts, goalText.ts, dom.ts
  platform/storage.ts     SaveStore (bellek içi görünüm, asenkron kalıcılık); KeyValueBackend: LocalStorage / Memory
  audio/audio.ts          AudioService arayüzü + NoopAudio
  fx/haptics.ts           HapticsService arayüzü + NoopHaptics
  fx/feedback.ts          Oyun olayları → ses/titreşim eşlemesi (tek yer)
  i18n/tr.ts, index.ts    Tüm oyuncu metinleri (Türkçe), fmt() yer tutucu doldurma
  dev/bot.ts              Açgözlü otomatik oyuncu (bölüm QA/denge; pakete girmez)
  styles/main.css         Sade koyu tema, güvenli alanlar, min 44–48px dokunma hedefleri
tests/                    vitest
scripts/smoke.cjs         Playwright smoke testi
```

### Oyun döngüsü kuralları

- Simülasyon `SIM_TICK_HZ` (60) sabit tick'le ilerler, her tick `SIM_STEPS_PER_TICK` (3) fizik geçişi; ekran yenileme hızından bağımsız.
  Sıcak döngüde bellek ayırma yok (typed array'ler, önceden ayrılmış tamponlar).
- Parça her zaman tahtanın **en üstüne** (y=0) seçilen sütuna damgalanır, sonra kuma dönüşüp akar.
- Parça çakışırsa bırakma **reddedilir** (`blocked` olayı, "Kum akıyor…" / "Buraya sığmıyor" uyarısı). Çakışma asla tek başına kaybettirmez.
- Kum durulunca `findClears` çalışır → yol varsa `CLEAR_FLASH_TICKS` yanıp söner → silinir.
  Puan (GDD §4.7): aynı kontroldeki yollar **büyükten küçüğe** ayrı zincir adımıdır; her yol `(tane × SCORE_PER_GRAIN + PATH_BONUS) × min(Z, CHAIN_MAX)` (100, tavan 5).
  Bombayla silinen her tane `1 × Z` (yol bonusu yok). Kazanınca kalan her parça için `END_BONUS_PER_PIECE` (100) eklenir (puan hedefine sayılmaz).
- Zincir (Z): tahta durulup yol bulunmayınca sıfırlanır; `CHAIN_RESET_ON_DROP` (şu an `true`, prototip kuralı) her bırakışta da sıfırlar. GDD açık soru #7 onaylanırsa `false` yapın.
- Tepsi: 3 yuva, üçü de bitince yeniden dolar (limit < 3 kaldıysa kalan kadar). Parçalar **adil torbadan** gelir: şekiller karıştırılmış torba (izinli şekiller), renkler her renk 2 kez olan torba (`PieceBag`).
- Döndürme: seçili tepsi parçasına tekrar dokun. Ayrı "Döndür" düğmesi `SHOW_ROTATE_BUTTON` ile açılır (GDD §4.3 gereği varsayılan kapalı).
- **Kazanma:** kum durulmuş ve bekleyen patlama yokken tüm hedefler tamam.
- **Kaybetme** (yalnızca kum durulmuşken): parça limiti bitti ve hedefler eksik (`out_of_pieces`) ya da tepsideki hiçbir parça hiçbir dönüşte/sütunda sığmıyor (`no_space`).
- Yıldız: kazanınca en az 1; `stars` eşiklerinden her biri için +1 (en fazla 3).
- RNG akışları ayrı: tahta kurulumu, parça dizisi, fizik, kozmetik gölge. Aynı seed + aynı hamleler = aynı sonuç.
  Tahta her denemede aynıdır (`level.seed`); parça ve fizik akışları `seed + deneme × 7919` (`ATTEMPT_SEED_STEP`). Deneme sayısı kayıtta (`LevelProgress.attempts`), ayrıca `lossStreak` (GDD yardım kuralı için) tutulur.

## Bölüm şeması

`src/levels/data/NNN.json` (dosya eklemek yeterli; kayıt otomatik):

```jsonc
{
  "id": 1,                       // pozitif tamsayı, benzersiz; sıralama id'ye göre
  "name": "İlk Tutam",
  "colors": [1, 2, 3],           // kum renk id'leri (GDD §18.1): 1 pul biber, 2 zerdeçal, 3 nane, 4 sumak, 5 çivit, 6 tarçın
  "pieceLimit": 15,              // toplam parça; null/yok = sınırsız
  "goals": [
    { "type": "clear_paths", "count": 2 },              // herhangi renkte 2 yol
    { "type": "clear_paths", "count": 1, "color": 1 },  // belirli renkte yol
    { "type": "score", "value": 1500 },
    { "type": "clear_color_grains", "color": 1, "count": 300 }  // o renkten tane (bomba ile silinenler dahil)
  ],
  "stars": [1000, 2000, 3000],   // artan 3 puan eşiği
  "prefill": { "type": "none" },
  "obstacles": [],
  "specials": { "bombChance": 0 },
  "seed": 12345,                 // yoksa id*7919
  "pieces": ["I", "O", "T"],     // EKLENDİ, opsiyonel: parça havuzu (varsayılan 7 tetromino)
  "hint": "Kısa ipucu"           // EKLENDİ, opsiyonel: bölüm başında gösterilen Türkçe ipucu
}
```

**prefill**
- `{ "type": "none" }`
- `{ "type": "random", "rows": 12, "density": 0.9, "colors": [1,2] }` — alttan `rows` **tane satırı** (4 = bir blok satırı) 4×4 renk öbekleriyle doldurulur. `density` (0..1, vars. 1) ve `colors` (vars. bölüm renkleri) opsiyonel. Kazara oluşan duvar-duvar yollar otomatik bozulur.
- `{ "type": "pattern", "rows": ["1..........3", "232313213232"], "legend": { "R": 1, "X": "stone" } }` — alta hizalı resim.
  Satır genişliği **12** (1 karakter = 1 blok = 4×4 tane) ya da **48** (1 karakter = 1 tane). `.` boş, `#` taş, `1`–`9` renk id, diğerleri `legend` ile.
  Kum desenleri başlangıçta durulur (bloklar kenarlardan biraz yayılır). Desende hazır yol bırakma (testler kontrol eder).

**obstacles** — taş dikdörtgenleri, sol üstten: `{ "x": 0, "y": 10, "w": 3, "h": 1, "unit": "block" }` (`unit` vars. `block`; `grain` da olur; `w`/`h` vars. 1).
Taşlar düşmez, temizlenmez, kumu taşır.

**specials** — `bombChance` (0..1): dağıtılan parçanın bir bloğu bomba olur. Bomba taneleri bir yolla temizlenince `BOMB_RADIUS` (8 tane) içindeki taş dışı her şeyi siler (zincirleme). Diğer anahtarlar korunur (ileride kullanmak için).

Doğrulama: `validateLevel()` hatalı bölümü atlar ve konsola yazar; `npm test` tüm bölümlerin geçerli olduğunu, hazır yol olmadığını ve botun her bölümü sonuçlandırdığını kontrol eder.
Denge için: `tests/bot.test.ts` çıktısı her bölümde açgözlü botun sonucunu (kazandı/kaybetti, puan, kullanılan parça) yazar — `npx vitest run tests/bot.test.ts --silent=false`.

## Diğer ajanlar için genişleme noktaları

| İş | Nereye |
|---|---|
| **Tema / renkler** (Sanat) | `src/render/theme.ts`: `defaultTheme` (kum gölgeleri, taş, arka plan, flaş, bomba tonu, hayalet, `css` değişkenleri). Başka tema: yeni `Theme` nesnesi + `setTheme()`. UI biçimi: `src/styles/main.css` (yalnızca CSS değişkenlerini kullanır). Renk adları: `src/i18n/tr.ts` → `colors`. Tane dokusu gölge sayısı `config.ts` → `SHADES`. |
| **Ses** (Ses) | `AudioService` uygula (`src/audio/audio.ts`; ses adları `SoundName`), `main.ts`'de `NoopAudio` yerine ver. Olay→ses eşlemesi `src/fx/feedback.ts`. `unlock()` ilk dokunuşta çağrılır (Menü "Oyna"/"Bölümler"). |
| **Titreşim** | `HapticsService` uygula (`src/fx/haptics.ts`), ör. `@capacitor/haptics`; `main.ts`'de bağla. |
| **Kayıt → Capacitor Preferences** | `KeyValueBackend` uygula (`get/set/remove`, async) ve `SaveStore.load(backend)`'e ver (`main.ts`). |
| **Yeni hedef türü** (Oynanış) | `src/game/goals.ts`: `GoalDef` birleşimine tip ekle, `GOAL_TYPES`'a `{ validate, create }` kaydet (create → `onClear(res)` / `onScore(score)` ile `current` güncelle). HUD metni: `src/ui/goalText.ts` + `src/i18n/tr.ts` → `goals`. Test ekle. |
| **Yeni özel tane** (Oynanış) | `src/engine/grid.ts`'de boş bir `FLAG_*` biti (2..7) ayır; `src/engine/specials.ts`'de `SPECIALS` listesine `{ id, flag, onClear(g, i, mark) }` ekle (`SpecialId` tipini genişlet). Parçaya dağıtma: `randomPiece()` (`pieces.ts`) + şemada şans alanı (`specials`). Görünüm: `boardRenderer.upload()` şu an tüm özel taneleri bomba tonuyla boyar — türe göre palet eklenebilir. Temizlenmeyen/taş benzeri davranış için `FLAG_STATIC` kullan. |
| **Yeni prefill / engel türü** | `levels/schema.ts` (`PrefillDef` + `validatePrefill`) ve `game/setup.ts` (`buildBoard`). |
| **Oturum olayları** (efekt, analitik) | `session.events.on(e => …)` — `placed, blocked, rotated, trayRefill, clearStart, cleared, goalComplete, settled, won, lost`. Patlama sırasında işaretli hücreler `session.clear.marked`/`cells` içinde (parçacık efekti için). |
| **Metinler / İngilizce** | `src/i18n/tr.ts` (`Strings` tipi). `en.ts` aynı şekilde yazılıp `setStrings()` ile seçilir. |
| **Android geri tuşu** | `@capacitor/app` `backButton` → `app.scenes.back()` (Esc ile aynı yol). |
| **Hız / his / puan ayarı** | `src/config.ts` (`SIM_STEPS_PER_TICK`, `CLEAR_FLASH_TICKS`, `SCORE_PER_GRAIN`, `PATH_BONUS`, `CHAIN_MAX`, `END_BONUS_PER_PIECE`, `CHAIN_RESET_ON_DROP`, `SHOW_ROTATE_BUTTON`, `GRID_W/H`, `BLOCK`). |

## Bilinen eksikler / sonraki adımlar

GDD §18.6'daki farklardan **yapılanlar**: puan formülü + zincir tavanı + Tezgâh Bonusu, deneme başına tohum, adil torba, renk id eşlemesi, ayrı döndür düğmesi kaldırıldı, "Burası dolu!" metni.
**Yapılmayanlar** (Oynanış Mühendisi, dalga 2): `clear_obstacles` hedefi ve çuval (`obstacles[].type: "sack"`, `hp`), joker tane (`specials.jokerChance`, legend `"joker"`), ikili kese (`twoColorChance`), `scriptedPieces`, `tutorial` / `intro` / `customer` (şimdilik korunur ama yok sayılır), yardım kuralı (×1,5 renk ağırlığı; `lossStreak` hazır), sürüklenen kesenin parmağın 64 dp üstünde çizilmesi, tehlike uyarısı (üst 8 satır), "Çifte!" yazısı, Sonsuz mod. `obstacles[].type` alanı yok sayılır (hepsi raf/taş).

- Görseller placeholder; patlama parçacıkları, puan uçuşu, kum dokusu yok.
- Ses ve titreşim no-op.
- Öğretici (ilk açılış) yok; yalnızca bölüm `hint` metni.
- Kalan parça bonusu, ödüllü reklam, "devam et" mekanikleri yok.
- Örnek 5 bölüm yalnızca teknik örnek; denge Bölüm Tasarımcısının işi.
- Android platformu eklendi (debug APK CI'da). Release imzalama yok (bkz. `docs/release.md`).
