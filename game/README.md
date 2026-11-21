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
NODE_PATH=$(npm root -g) node scripts/wave2-smoke.cjs /tmp/ekranlar   # öğretici, sürükleme, Çifte/zincir, tehlike, çuval/joker/ikili, sonsuz mod
NODE_PATH=$(npm root -g) node scripts/economy-smoke.cjs /tmp/ekranlar # günlük ödül, mağaza, booster'lar, kaybet → devam (sahte reklam)
```

Hata ayıklama: URL'ye `?debug=1` ekle → `window.__app`, oynarken `window.__kum.session` / `window.__kum.scene` / `window.__kum.hint()` (öğretici el işaretinin önerdiği hamle).
Tahtayı elle değiştirdikten sonra `session.wake()` çağır (fizik + yol kontrolü yeniden çalışır).
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
  core/events.ts          Tipli event emitter + tüm oyun olayları (`SessionEvent`, `LoseReason`)
  engine/grid.ts          SandGrid: Uint8Array color / shade / flags (FLAG_STATIC, FLAG_BOMB); JOKER=15, SACK=254, STONE=255
  engine/sim.ts           step(): kum fiziği (aşağı, sonra çapraz); statik hücreler düşmez; hareket sayısı döner (0 = duruldu)
  engine/clear.ts         findClears(): 4-komşuluk, sol duvar↔sağ duvar aynı renk bölgeleri, joker desteği; ClearResult önceden ayrılmış tamponlar
  engine/specials.ts      Özel tane kaydı (bomba). Patlama temizliğe dahil olunca onClear() ek kum işaretler, engelleri "hit" eder
  engine/pieces.ts        Tetrominolar, dönüşler, blok başına renk (ikili kese / joker blok), PieceBag (adil torba, ağırlık, sabit parçalar)
  engine/sacks.ts         Çuval engelleri: can, temas/bomba hasarı, yırtılma
  game/session.ts         Bir bölüm denemesi / sonsuz oyun: tepsi, skor, zincir, hedefler, çuvallar, tehlike, kazan/kaybet; dış eylemler (addPieces, rerollTray, scoopColumns)
  game/endless.ts         Sonsuz mod ("Serbest Tezgâh"): puana göre renk/özel tane rampası, 9 keselik başlangıç tahtası
  game/hintMove.ts        Öğretici el işareti için en iyi hamle (karalama ızgarada deneme)
  game/goals.ts           Hedef türleri kaydı (GOAL_TYPES), GoalTracker, yıldız hesabı
  game/setup.ts           Başlangıç tahtası: engeller + prefill (none/random/pattern), durultma, kazara yolları bozma
  levels/schema.ts        LevelDef tipi + validateLevel() (okunur hata mesajları, bilinmeyen alanlar korunur)
  levels/levels.ts        levels/data/*.json otomatik yüklenir (import.meta.glob), doğrulanır, id'ye göre sıralanır
  levels/data/*.json      Bölümler (Bölüm Tasarımcısı)
  render/theme.ts         Tüm renkler + CSS değişkenleri tek yerde; ImageData için paketlenmiş palet
  render/boardRenderer.ts 1:1 ImageData → en yakın komşu büyütme (tam sayı cihaz pikseli/tane), hayalet parça, patlama yanıp sönmesi
  render/piecePreview.ts  Tepsi önizlemesi + drawPieceBlocks (sürüklenen kese de bunu kullanır)
  input/pointer.ts        Tepsiden sürükle-bırak, tahtaya dokun-kaydır-bırak, seçili parçaya tekrar dokun = döndür; tek parmak takibi
  input/keyboard.ts       Masaüstü tuşları
  ui/app.ts               App bağlamı + SceneManager (replace/push/pop, overlay)
  ui/menu.ts, levelSelect.ts, play.ts, pause.ts, result.ts, goalText.ts, dom.ts
  ui/levelIntro.ts        Bölüm başı kartı: müşteri, sipariş satırları, kese hakkı, ipucu, "Yeni!" mekanik kartları
  ui/tutorial.ts          Öğretici t1–t3: konuşma balonu, el işareti animasyonu, tek yuvaya odak
  platform/storage.ts     SaveStore (bellek içi görünüm, birleştirilmiş arka plan yazımı, flush()); KeyValueBackend: LocalStorage / Memory
  platform/preferencesBackend.ts  Capacitor Preferences arka ucu + createStorageBackend() (native: Preferences, web: localStorage)
  platform/native.ts      Android geri tuşu + arka plana geçince duraklat/kaydet (web'de no-op)
  audio/audio.ts          AudioService arayüzü, SoundName/SOUND_NAMES, NoopAudio
  audio/webAudio.ts       WebAudioService: tek AudioContext, ilk dokunuşta açılır, ana ses/sessiz, döngüler (akış, tehlike)
  audio/sounds.ts         Her sesin sentez tarifi (GDD §14.4) + cooldown/polifoni kuralı
  audio/synth.ts          Osilatör/gürültü/çan/Karplus-Strong yardımcıları, gürültü tamponu üreticileri
  audio/limiter.ts        VoiceLimiter: ses başına cooldown + en fazla eşzamanlı ses
  fx/haptics.ts           HapticsService + DeviceHaptics (native: @capacitor/haptics, web: navigator.vibrate) + NoopHaptics
  fx/feedback.ts          Oyun olayları → ses/titreşim eşlemesi (tek yer)
  fx/settingsToggle.ts    Ses / Titreşim aç-kapa düğmeleri (Duraklat ekranında)
  dev/soundLab.ts         Ses laboratuvarı (sound-lab.html, yalnızca dev sunucusunda)
  i18n/tr.ts, index.ts    Tüm oyuncu metinleri (Türkçe), fmt() yer tutucu doldurma
  dev/bot.ts              Açgözlü otomatik oyuncu (bölüm QA/denge; pakete girmez)
  styles/main.css         Sade koyu tema, güvenli alanlar, min 44–48px dokunma hedefleri
tests/                    vitest
scripts/smoke.cjs         Playwright smoke testi
scripts/wave2-smoke.cjs   Dalga 2 oynanış smoke testi
```

### Oyun döngüsü kuralları

- Simülasyon `SIM_TICK_HZ` (60) sabit tick'le ilerler, her tick `SIM_STEPS_PER_TICK` (3) fizik geçişi; ekran yenileme hızından bağımsız.
  Sıcak döngüde bellek ayırma yok (typed array'ler, önceden ayrılmış tamponlar).
- Parça her zaman tahtanın **en üstüne** (y=0) seçilen sütuna damgalanır, sonra kuma dönüşüp akar.
- Parça çakışırsa bırakma **reddedilir** (`blocked` olayı, "Kum akıyor…" / "Buraya sığmıyor" uyarısı). Çakışma asla tek başına kaybettirmez.
- Kum durulunca `findClears` çalışır → yol varsa `CLEAR_FLASH_TICKS` yanıp söner → silinir.
  Puan (GDD §4.7): aynı kontroldeki yollar **büyükten küçüğe** ayrı zincir adımıdır; her yol `(tane × SCORE_PER_GRAIN + PATH_BONUS) × min(Z, CHAIN_MAX)` (100, tavan 5).
  Bombayla silinen her tane `1 × Z` (yol bonusu yok). Kazanınca kalan her parça için `END_BONUS_PER_PIECE` (100) eklenir (puan hedefine sayılmaz).
- Zincir (Z): tahta durulup yol bulunmayınca sıfırlanır (`CHAIN_RESET_ON_DROP = false`, yapımcı onayı; `true` = prototipteki gibi her bırakışta sıfırla).
- **Joker** (`JOKER` = renk 15): yol ararken her rengin bölgesine katılır. Renkler 1→14 sırayla aranır; bir yolun kullandığı joker sonraki renkte yoktur. Yalnız-joker duvar-duvar bölge de yoldur (`regionColor = JOKER`; yalnızca renksiz `clear_paths`'e sayılır). Jokerler `clear_color_grains`'e sayılmaz.
- **Çuval** (`SACK` = 254, statik): bir temizleme olayında (bir kontrol) en fazla 1 hasar alır — temizlenen bir taneye 4-komşuysa ya da bomba dairesi çuvala değerse. Can 0 → hücreler boşalır, kum akar, `SACK_BREAK_POINTS` (200, çarpansız) ve `clear_obstacles` +1. Bomba artık engelleri (raf/çuval) silmez.
- **İkili kese**: blok 0–1 renk A, 2–3 renk B (I sol/sağ, O üst/alt, diğerleri ilk/son iki); döndürme dağılımı korur.
- **Yardım kuralı**: `lossStreak` 3'ün katıysa (3, 6, …) o deneme hedef renklerinin torba ağırlığı ×1,5 (torbada 2 yerine 3 kopya). Oyuncuya gösterilmez (`session.helped`).
- **Tehlike**: kum durulduğunda en üstteki (statik olmayan) tane üstten `DANGER_ROWS` (8) satır içindeyse `danger {on, first}`; tahta çerçevesinin üstü kırmızı nabız atar, ilk seferde "Tezgâh doluyor!".
- **Sonsuz mod**: `new Session(makeEndlessLevel(seed), { endless: true })`. Hedef yok, kazanılmaz, yalnızca `no_space` ile biter; renk sayısı 3/4/5 (0/3000/8000 puan), bomba 0,05 (2000+), joker 0,03 (5000+). Rekor `save.endlessBest`. Menüde bölüm `ENDLESS_UNLOCK_LEVEL` (8) kazanılınca açılır (`?debug=1&unlockAll` hep açık).
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
  "pieces": ["I", "O", "T"],     // opsiyonel: parça havuzu (varsayılan 7 tetromino)
  "hint": "Kısa ipucu",          // opsiyonel: bölüm başı kartında (tekrar denemede toast) gösterilen Türkçe ipucu
  "scriptedPieces": [            // opsiyonel: ilk keseler sırayla bunlar (her denemede aynı), sonra torba
    { "shape": "O", "color": 2, "rot": 0 },
    { "shape": "I", "color": 1, "bomb": 2 },          // bomb / joker: blok indeksi 0..3
    { "shape": "T", "colors": [1, 3] }                // ikili kese
  ],
  "tutorial": "t1",              // opsiyonel: "t1" | "t2" | "t3" | null (GDD §13); bitince kayda işlenir, bir daha oynatılmaz
  "intro": ["sack"],             // opsiyonel: mekanik kartı kimlikleri (GDD §13 tablosu; metinler i18n `mechanics`), her biri bir kez
  "customer": "mehmet",          // opsiyonel: "ayse" (vars.) | "mehmet" | "selim" | "anna"
  "difficulty": 4                // opsiyonel meta veri (korunur, kullanılmaz)
}
```

**prefill**
- `{ "type": "none" }`
- `{ "type": "random", "rows": 12, "density": 0.9, "colors": [1,2] }` — alttan `rows` **tane satırı** (4 = bir blok satırı) 4×4 renk öbekleriyle doldurulur. `density` (0..1, vars. 1) ve `colors` (vars. bölüm renkleri) opsiyonel. Kazara oluşan duvar-duvar yollar otomatik bozulur.
- `{ "type": "pattern", "rows": ["1..........3", "232313213232"], "legend": { "R": 1, "X": "stone" } }` — alta hizalı resim.
  Satır genişliği **12** (1 karakter = 1 blok = 4×4 tane) ya da **48** (1 karakter = 1 tane). `.` boş, `#` taş, `1`–`9` renk id, diğerleri `legend` ile (değer: renk id, `"stone"` ya da `"joker"`).
  Desen engellerin üstüne yazmaz (engeller önce yerleşir).
  Kum desenleri başlangıçta durulur (bloklar kenarlardan biraz yayılır). Desende hazır yol bırakma (testler kontrol eder).

**obstacles** — dikdörtgenler, sol üstten: `{ "type": "shelf", "x": 0, "y": 10, "w": 3, "h": 1, "unit": "block" }` (`unit` vars. `block`; `grain` da olur).
- `type: "shelf"` (varsayılan) = Raf/taş: düşmez, temizlenmez, kumu taşır. `w`/`h` vars. 1.
- `type: "sack"` = Çuval: `hp` 1–3 (vars. 1), `w`/`h` vars. 2 blok (8×8 tane). Can düğümleri tahtada gösterilir.
- Hedef `{ "type": "clear_obstacles", "count": 3, "kind": "sack" }` — `count` bölümdeki çuval sayısını aşamaz (doğrulayıcı reddeder).

**specials** — hepsi 0..1, vars. 0. `bombChance`: parçanın bir bloğu bomba (yol temizlenince `BOMB_RADIUS` = 8 tane içindeki tüm kum/joker silinir, çuvallara 1 hasar; zincirleme). `jokerChance`: bir blok joker. `twoColorChance`: ikili kese (bölümde ≥ 2 renk gerekir). Diğer anahtarlar korunur.
Renk id'leri 1..14 (15 = joker ayrılmış).

Doğrulama: `validateLevel()` hatalı bölümü atlar ve konsola yazar; `npm test` tüm bölümlerin geçerli olduğunu, hazır yol olmadığını ve botun her bölümü sonuçlandırdığını kontrol eder.
Denge için: `tests/bot.test.ts` çıktısı her bölümde açgözlü botun sonucunu (kazandı/kaybetti, puan, kullanılan parça) yazar — `npx vitest run tests/bot.test.ts --silent=false`.

## Ses ve titreşim

Ses dosyası yok: tüm efektler **Web Audio API ile sentezlenir** (`src/audio/`). `main.ts` → `createAudio()` + `new DeviceHaptics()`.

- **Tek AudioContext**, ilk kullanıcı hareketinde oluşturulur ve `resume()` edilir (pencereye `pointerup/touchend/click/keydown` dinleyicisi + Menü düğmelerindeki `unlock()`); iOS için sessiz tampon çalınır. Hareketten önce bağlam açılmaz → tarayıcı autoplay uyarısı yok.
- Beyaz/pembe gürültü tamponları bir kez, Karplus-Strong telli notaları ilk kullanımda (jingle notaları açılışta) üretilir ve önbelleklenir.
- Zincir: master → kompresör → hoparlör; kısa geri beslemeli gecikme "oda" efekti (clear/yıldız/jingle).
- **Üst üste binme sınırı:** her sesin `cooldownMs` ve `maxVoices` değeri var (`sounds.ts`); sınırı aşan çağrı sessizce atlanır.
- **Ayarlar** (`SaveStore.settings`): `sound`, `haptics`, `volume` (0..1). Menü ve **Duraklat** ekranında Ses/Titreşim düğmeleri. Ses kapalıyken hiç düğüm oluşturulmaz ve bağlam askıya alınır. Uygulama arka plana geçince döngüler durur, bağlam askıya alınır; Duraklat açılınca döngüler durur.
- Döngüler: `setFlow(0..1)` kum hışırtısı (yenilenmezse 2,5 sn'de kendiliğinden söner), `setDanger(on)` 1,2 sn'de bir iki "küt". `stopLoops()` ikisini de keser.
- WebAudio yoksa (Node/vitest, eski WebView) her çağrı güvenli no-op.

**Ses laboratuvarı** (geliştirici aracı): `npm run dev` → `http://localhost:5173/sound-lab.html`. Her ses için düğme, zincir/yıldız seçici, ana ses, akış/tehlike döngüleri, `feedback.ts` üzerinden oyun olayı simülasyonu ve titreşim düğmeleri. Production build'e girmez (Vite yalnızca `index.html`'i paketler).

| Olay (`core/events.ts`) | Ses | Titreşim |
|---|---|---|
| `placed` | `drop` + akış döngüsü başlar | light |
| `blocked` | `blocked` (GDD `invalid`) | warning |
| `rotated` | `rotate` | — |
| tepsiden seçme (`play.ts`) | `pick` | — (öneri: `selection`) |
| `clearStart`, `settled` | akış döngüsü söner | — |
| `cleared` | `clear` (zincir başına +2 yarım ton) / 2+ yol → `double`; zincir ≥2 → `chainWord`; pul biber (renk 1) ve zincir ≥3 → `sneeze` (Zerde) | medium; zincir ≥3 → heavy |
| `bomb` | `bomb` | heavy |
| `joker` | `joker` | — |
| `sackHit` / `sackBreak` | `sackHit` / `sackBreak` | light / medium |
| `goalComplete` | `goal` | — |
| `danger` | `on` → tehlike döngüsü, `off` → durur | warning (yalnız `first`) |
| `toolCleared`, `trayRerolled` | `booster` | medium |
| `piecesAdded` | `coin` | — |
| `revived` (Devam et) | — (`piecesAdded` çalar) | medium |
| `won` | `win` (Hicaz motifi) + yıldız başına `star` (0,35 sn arayla) | success |
| `lost` | `lose` (yumuşak; GDD gereği titreşim yok) | — |

`double` ve `chainWord` olayları görsel içindir; sesleri zincir değerini taşıyan `cleared` çalar.
**Yeni olaya ses eklemek:** `feedbackFor()` içine `case 'yeniOlay': audio.play('…'); haptics.haptic('…'); break;`. Yeni ses gerekiyorsa `SoundName` + `SOUND_NAMES`'e ad, `RECIPES`'e tarif ekle; `sound-lab.html`'de dene. Testler: `tests/audio.test.ts`, `tests/haptics.test.ts`.

## Ekonomi, reklam ve satın alma

Tek para birimi **altın** (GDD §9.3, §10–§12). Reklam ve satın alma şimdilik **sahte** (geliştirme yedeği); arayüzler gerçek eklentiye göre tasarlandı.

```
src/game/economy.ts      Altın + booster cüzdanı (Economy) ve saf kurallar: bölüm/sonsuz ödülü, bölge sandığı, devam teklifi, booster açılış/hediye
src/game/daily.ts        Günlük ödül + seri (7 günlük döngü), saat enjekte edilebilir (core/clock.ts)
src/game/meta.ts         App.meta: economy + daily + ads + iap; bölüm sonu muhasebesi (onSessionEnd), 2× altın, günlük ödül alma, satın alma teslimi
src/core/clock.ts        Clock { now, tzOffsetMin } + fixedClock() (testler) + localDay() (yerel gün numarası)
src/platform/ads.ts      AdPolicy (sıklık kuralları, kayıtlı sayaçlar) + AdProvider (SDK) + PolicyAdService; FakeAdProvider
src/platform/iap.ts      PRODUCTS kataloğu + IapService arayüzü; FakeIap
src/ui/createMeta.ts     App.meta'yı kurar: hangi reklam/IAP uygulaması kullanılacağı TEK yer
src/ui/boosterBar.ts     Tepsinin altındaki booster çubuğu (+ altın göstergesi), Kepçe/Elek hedefleme katmanı
src/ui/boosterOffer.ts   Booster bitti: "X altına al" / "İzle, 1 tane al ▶" / Mağaza
src/ui/continueOffer.ts  Kaybettin kartındaki Devam teklifi
src/ui/rewardPanel.ts    Kazandın kartı altın + sandık + "2 katına çıkar ▶"; leaveResult() = bölüm sonu sayacı + geçiş reklamı
src/ui/shop.ts           Mağaza (overlay; menüden ve oyundan açılır)
src/ui/dailyReward.ts    Günlük ödül penceresi (menüye girişte; bölüm 1 bitmeden çıkmaz; `?debug=1&nodaily` kapatır)
src/ui/menuMeta.ts       Menü şeridi: altın (+ → mağaza), seri, Mağaza düğmesi
src/ui/econWidgets.ts    Altın rozeti, altın/booster SVG ikonları, ödül metni, flash mesajı
src/ui/adOverlay.ts      Sahte reklam katmanı ("Reklam (deneme)", 1,5 sn) ve sahte satın alma penceresi
src/styles/economy.css   Bu ekranların stili (yalnızca tema CSS değişkenleri)
```

**Kurallar (GDD ile aynı; sabitler `economy.ts` / `ads.ts` başında):**
- Başlangıç 200 altın. Bölüm ilk galibiyet 1★ 20 · 2★ 30 · 3★ 40; tekrar oynayıp yıldız artırınca fark; diğer tekrar galibiyetler 5. Bölge sonu (10/20/30) ilk galibiyet: +150 altın, +1 Kepçe, +1 Elek (sandık bir kez). Sonsuz mod `floor(puan/500)`, en fazla 30. Kazanç `won` olayında, `recordResult`'tan **önce** (`meta.onSessionEnd`) verilir.
- Bakiye tam sayıdır, **asla negatife düşmez** (yetmeyen harcama hiçbir şey değiştirmeden `false` döner), NaN/negatif/kesirli miktarlar reddedilir, tavan `GOLD_CAP`.
- Booster'lar: Tezgâhı Yenile 100 (bölüm 4), Kepçe 150 (bölüm 7; 4 tanelik sütun, seç → Onayla), Elek 250 (bölüm 12; taneye dokun, en yakın tane ±3 alınır, joker elenmez). Açıldıkları an 2'şer hediye (`grantUnlockGifts`, ilerlemeye göre; tekrar oynanan eski bölümde de görünür). Kilitli booster gizli. Bölüm başına her birinden en fazla 3. Kepçe/Elek tanesi 1 puan, renk/gram hedefine sayılır (Elek yol hedefine sayılmaz). Hedefleme sırasında tahta girişi kapalı; Vazgeç / geri tuşu iptal eder; booster ancak başarılı kullanımda düşer. Sayı 0 iken: fiyat rozeti (altın yetmiyor ve reklam hakkı varsa ▶).
- Devam (+5 kese, `Session.revive`): 1.: reklam **veya** 300 altın; 2.: 600 altın; 3. yok. Bölüm 1–5'te ilki ücretsiz. "Tezgâh doldu" kaybında üstteki 20 tane satırı da boşalır (hedefe/puana sayılmaz). Devam edilen deneme aynı denemedir (`save.undoLastLoss` kaybı geri alır: tohum, yardım kuralı, reklam sayaçları bozulmaz). Altın yetmezse düğme Mağaza'yı açar (başka satış kutusu yok).
- Günlük ödül: 25 · 50 · 1 Yenile · 75 · 1 Kepçe · 100 · 150+1 Elek. Dün alındıysa sonraki kutu ve seri +1; bir gün kaçarsa 1. gün, seri 1. 7'den sonra 1. kutuya döner, seri artmaya devam eder. Gün değişimi cihaz yerel saatiyle 00:00 (`localDay`; saat dilimi/DST `Clock.tzOffsetMin`'den). Saat geri alınırsa takılmaz, 1. günden başlar (GDD: hile MVP'de engellenmez). "2 katı ▶" günde 1.
- Ödüllü reklam sınırları (yerel gün): bedava altın 3 (30 altın), booster 3, günlük ×2 1, toplam 12. Devam reklamı deneme başına 1, 2× altın yalnızca ilk galibiyette (akış sınırlar).
- Geçiş reklamı (`AdPolicy.decideInterstitial`, nedeni `ads.lastDecision.reason`): yalnızca sonuç kartından **haritaya / sonraki bölüme** geçişte (Tekrar dene, duraklat, menü: asla); bölüm 8 bu bölüm bitmeden önce kazanılmış olmalı (ilki en erken 9'un sonunda); son geçiş reklamından beri ≥ 3 bölüm sonu; son reklamdan (ödüllü dahil) ≥ 90 sn; uygulama oturumu ≥ 3 dk; bu bölümde art arda 3 kayıp varsa yok; son 1 saatte ≤ 4, son 24 saatte ≤ 20; "Reklamları Kaldır" varsa hiç.
- IAP: `remove_ads` (kalıcı, $2,99, geçiş reklamları kapanır + 500 altın), `gold_small` (1.000, $0,99), `gold_large` (6.000, $4,99). Teslim `Economy.deliverProduct` (kalıcı ürün bir kez; geri yükleme tekrar altın vermez).

**Kayıt alanları** (`SaveData`, `kumakisi.save.v1`; eski kayıtlar varsayılanlarla dolar, `sanitize*` bozuk değerleri onarır):
- `economy`: `gold`, `boosters {shuffle, scoop, sieve}`, `gifts` (hediyesi verilmiş booster'lar), `chests` (açılmış sandık bölümleri), `noAds`, `owned` (kalıcı ürünler), `earned`, `spent`.
- `daily`: `lastDay` (son alınan yerel gün numarası), `index` (0–6), `streak`, `best`.
- `ads`: `levelEnds` (son geçişten beri bölüm sonu), `lastAdAt`, `interstitials` (son 24 saatin zamanları), `rewardDay`, `rewarded {yer: sayı}`, `rewardedTotal`.

**Olaylar:** `SessionEvent` + `revived {pieces, rows, grains}` (ardından `piecesAdded`); Elek/Kepçe `toolCleared`, Yenile `trayRerolled` (sesleri `fx/feedback.ts`'de). Cüzdan olayları `app.meta.economy.events`: `gold {delta, balance, reason}`, `booster {id, delta, count, reason}`, `noAds` — analitik (`booster_use`, `continue_use`, `iap_purchase`) buraya bağlanabilir; `reason` alanı kaynağı söyler (`level_win`, `level_chest`, `daily`, `daily_x2`, `endless`, `double_win`, `ad_free_gold`, `ad_booster`, `continue_1/2`, `buy_<id>`, `use_<id>`, `gift`, `iap_<id>`).

**Gerçek reklam / satın alma takmak** (paket eklemek gerekir; bu dalgada `package.json`'a dokunulmadı):
1. Reklam: `@capacitor-community/admob` kur, `npx cap sync`. `AdProvider`'ı uygulayan `AdMobProvider` yaz: `init()` → `AdMob.initialize()` + UMP onayı (`AdMob.requestConsentInfo()` / `showConsentForm()`; GDD §15: bölüm 1 bittikten sonra, ilk reklam isteğinden önce) + ödüllü/geçiş reklamı önyükleme; `showRewarded()` → `prepareRewardVideoAd` + `showRewardVideoAd`, ödül olayı geldiyse `true`; `showInterstitial()` → `prepareInterstitial` + `showInterstitial`. Hata/doluluk yoksa `false` döndür (asla fırlatma). Sıklık kuralları `AdPolicy`'de kalır, eklentiye taşınmaz. Android `AndroidManifest.xml`'e AdMob uygulama kimliği (`com.google.android.gms.ads.APPLICATION_ID`), test reklam kimlikleriyle başla.
2. Satın alma: RevenueCat (`@revenuecat/purchases-capacitor`, önerilen: makbuz doğrulama + geri yükleme hazır) ya da bir Google Play Billing eklentisi (ör. `cordova-plugin-purchase`). `IapService`'i uygula: `init()` → yapılandır + ürünleri getir; `price()` → mağazanın yerelleştirilmiş fiyatı; `purchase()` → satın al, tüketilebilirleri tüket / kalıcıyı onayla (acknowledge), sonucu `{ok}` döndür; `restore()` → sahip olunan kalıcı ürün kimlikleri. Play Console'da ürün kimlikleri `PRODUCTS` ile aynı olmalı (`remove_ads`, `gold_small`, `gold_large`).
3. `src/ui/createMeta.ts`'te `Capacitor.isNativePlatform()` ise gerçek sağlayıcıları, değilse sahteleri seç. Sahte/gerçek ayrımı UI'da `ads.fake` / `iap.fake` ile görünür (mağazadaki "Deneme sürümü" notu yalnızca sahtede çıkar).

Testler: `tests/economy.test.ts`, `tests/daily.test.ts`, `tests/ads.test.ts` (sıklık kuralları, sahte sağlayıcı), `tests/meta.test.ts` (revive, Elek, ödüller, günlük ödül kalıcılığı, sahte satın alma).
Tarayıcı: `NODE_PATH=$(npm root -g) node scripts/economy-smoke.cjs /tmp/ekranlar` (günlük ödül, mağaza, sahte reklam/satın alma, üç booster, booster teklifi, kaybet → reklamla devam, 600 altınla 2. devam).
Debug: `window.__app.meta` (ör. `__app.meta.economy.earn(1000, 'debug')`, `__app.meta.ads.lastDecision`).

## Diğer ajanlar için genişleme noktaları

| İş | Nereye |
|---|---|
| **Tema / renkler** (Sanat) | `src/render/theme.ts`: `defaultTheme` (kum gölgeleri, taş, arka plan, flaş, bomba tonu, hayalet, `css` değişkenleri). Başka tema: yeni `Theme` nesnesi + `setTheme()`. UI biçimi: `src/styles/main.css` (yalnızca CSS değişkenlerini kullanır). Renk adları: `src/i18n/tr.ts` → `colors`. Tane dokusu gölge sayısı `config.ts` → `SHADES`. |
| **Ses / titreşim** | Bkz. yukarıdaki **Ses ve titreşim** bölümü. Yeni olay → `src/fx/feedback.ts`'e `case`; yeni ses → `SoundName` + `src/audio/sounds.ts` tarifi. |
| **Kayıt** | Yapıldı: `createStorageBackend()` native'de `PreferencesBackend` (eski localStorage kaydını okuyup taşır), web'de localStorage. `SaveStore` açılışta yükler, bellekte senkron çalışır, değişiklikleri arka planda birleştirerek yazar; `save.flush()` arka plana geçişte çağrılır. Yeni alanlar: `endlessBest`, `endlessGames`, `seenIntros`, `tutorialsDone`. |
| **Yeni hedef türü** (Oynanış) | `src/game/goals.ts`: `GoalDef` birleşimine tip ekle, `GOAL_TYPES`'a `{ validate, create }` kaydet (create → `onClear(res)` / `onScore(score)` ile `current` güncelle). HUD metni: `src/ui/goalText.ts` + `src/i18n/tr.ts` → `goals`. Test ekle. |
| **Yeni özel tane** (Oynanış) | `src/engine/grid.ts`'de boş bir `FLAG_*` biti (2..7) ayır; `src/engine/specials.ts`'de `SPECIALS` listesine `{ id, flag, onClear(g, i, mark, hit) }` ekle (`SpecialId` tipini genişlet). Parçaya dağıtma: `randomPiece()` (`pieces.ts`) + şemada şans alanı (`specials`). Görünüm: `boardRenderer.upload()` şu an tüm özel taneleri bomba tonuyla boyar — türe göre palet eklenebilir. Temizlenmeyen/taş benzeri davranış için `FLAG_STATIC` kullan. |
| **Yeni prefill / engel türü** | `levels/schema.ts` (`PrefillDef` + `validatePrefill`) ve `game/setup.ts` (`buildBoard`). |
| **Oturum olayları** (efekt, analitik) | `session.events.on(e => …)` — tam liste `src/core/events.ts` (`SessionEvent`). Patlama sırasında işaretli hücreler `session.clear.marked`/`cells` içinde (parçacık efekti için). |
| **Metinler / İngilizce** | `src/i18n/tr.ts` (`Strings` tipi). `en.ts` aynı şekilde yazılıp `setStrings()` ile seçilir. |
| **Android geri tuşu** | Yapıldı (`platform/native.ts`): `backButton` → `app.scenes.back()`; `back()` `false` dönerse (ana menü) `App.exitApp()`. Oyun → Duraklat, Duraklat → devam, Bölümler → menü, bölüm kartı → bölümler. Web'de no-op. |
| **Ekonomi / booster** | Yapıldı — bkz. **Ekonomi, reklam ve satın alma**. Oturum API'si: `addPieces(n)`, `rerollTray()`, `scoopColumns(x0, w)`, `sieveColor(color)`, `revive(pieces, clearRows)`. Yeni booster: `BOOSTERS` + `BoosterId` (`economy.ts`), akış `ui/boosterBar.ts`, metin `tr.ts` → `boosters`. |
| **Oyun hissi** (Sanat) | `ui/play.ts`: `showWord()` (zincir/Çifte yazısı), `floatText()` (+puan), `flyGrains()` (sipariş kesesine uçan taneler — sade yer tutucu), sürüklenen kese `.drag-piece` (`DRAG_LIFT_PX` = 64). Tehlike: `.board-frame.danger .danger-edge`. Öğretici eli `.tut-hand`, balon `.tut-bubble`. Joker renk döngüsü `theme.joker` (0,8 sn), çuval `theme.sack` / `sackKnot`. |
| **Hız / his / puan ayarı** | `src/config.ts` (`SIM_STEPS_PER_TICK`, `CLEAR_FLASH_TICKS`, `SCORE_PER_GRAIN`, `PATH_BONUS`, `CHAIN_MAX`, `END_BONUS_PER_PIECE`, `CHAIN_RESET_ON_DROP`, `SHOW_ROTATE_BUTTON`, `GRID_W/H`, `BLOCK`). |

## Bilinen eksikler / sonraki adımlar

GDD §18.6'daki farklardan **yapılanlar**: puan formülü + zincir tavanı + Tezgâh Bonusu, deneme başına tohum, adil torba, renk id eşlemesi, ayrı döndür düğmesi kaldırıldı, "Burası dolu!" metni.
Dalga 2 (Oynanış Mühendisi) **yapılanlar**: çuval + `clear_obstacles`, joker, ikili kese, `scriptedPieces`, yardım kuralı, zincir kuralı (`CHAIN_RESET_ON_DROP = false`), sürüklenen kese 64 dp yukarıda, tehlike uyarısı, Çifte/zincir yazıları, taneler sipariş kesesine uçar (yer tutucu), bölüm başı kartı + mekanik kartları, öğretici t1–t3, Sonsuz mod + rekor, Android geri tuşu, Preferences kaydı.

- Görseller placeholder (Sanat): el işareti düz daire, müşteri avatarı baş harf, mekanik kartı animasyonu genel "düşen tane" döngüsü, çuval yırtılma/sallanma efekti yok, ekran sarsıntısı yok.
- Öğretici t2 adım 2 yalnızca sayaç nabzı + dokunma işareti; ekranı karartma (GDD §13 %60) yok. İlk açılışta doğrudan bölüm 1'e girme (GDD §15) yok; menüden "Oyna".
- "Günün bulmacası" yok (GDD v1.1).
- Müzik yok (GDD: MVP sonrası). Ana ses seviyesi kayıtta (`settings.volume`) ama oyunda kaydırıcısı yok (Ayarlar ekranı gelince eklenmeli).
- Reklam ve satın alma sahte (geliştirme yedeği); gerçek AdMob / Play Billing eklentisi takılmadı, UMP onayı yok. Analitik (Firebase) yok. Ayarlar ekranında "Satın alımları geri yükle" yok (Mağaza'da var). Başlangıç/Esnaf paketleri (GDD "Sonra") yok. Harita ekranında altın göstergesi yok (menü ve oyunda var).
- Örnek 5 bölüm yalnızca teknik örnek; denge Bölüm Tasarımcısının işi.
- Android platformu eklendi (debug APK CI'da). Release imzalama yok (bkz. `docs/release.md`).
