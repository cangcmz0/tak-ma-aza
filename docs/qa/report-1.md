# QA Raporu 1 — "Kum Akışı" ilk test sürümü öncesi

> Test edilen sürümler: `93b401a` ve `5227288` (96×160 ızgara, Nasıl oynanır kartı, yol göstergesi).
> Ortam: Playwright + Chromium (headless, mobil öykünme, dokunmatik), Vitest. Gerçek cihaz/reklam/satın alma test edilmedi.
> Yeniden çalıştırma: `cd game && npm run build && npx vite preview --port 4173 &` → `node scripts/qa-run.cjs [bölümler] --out <klasör>`
> Kanıtlar: `docs/qa/report-1/` (ekran görüntüleri, JSON sonuçlar). QA ajanı .md yazamadığı için bu dosyayı Yapımcı kaydetti.

## 1. Özet
- **Not:** 7/10 — motor, puan, hedefler, ekonomi ve reklam kuralları sağlam ve GDD'ye uygun; sorunlar arayüz cilası, ses döngüsü yönetimi, öğretici/akış ayrıntıları ve **bölüm dengesi**.
- **Test sürümü:** Hazır değil. Engeller: QA-001, QA-002. Çıkmadan önce önerilen: QA-003, QA-005, QA-008.
- **Hatalar:** Kritik 0 · Yüksek 2 · Orta 8 · Düşük 12 · Düzeltildi 1.
- **Otomatik testler:** build geçti; 237 geçti / 1 atlandı (`5227288`).

## 2. Hata listesi
| ID | Önem | Konu | Kök neden / dosya |
|---|---|---|---|
| QA-001 | Yüksek | Mağaza: fiyat düğmeleri satır genişliğinde, metni örtüyor, kartı taşıyor | `main.css:536` `.card .btn{width:100%}` → `economy.css` `.shop-buy`'ı eziyor |
| QA-002 | Yüksek | Tehlike ses döngüsü duraklat / harita / yeniden başla sonrası durmuyor | `stopLoops()` yalnız won/lost'ta; `ui/play.ts` pause/exit'te kesilmeli |
| QA-003 | Orta | Yeniden başla ve Bölümler onay sormuyor (GDD §15) | `ui/pause.ts` |
| QA-004 | Orta | Duraklat → Yeniden başla aynı denemeyi veriyor (attempts artmıyor) | `ui/pause.ts` / `play.ts` |
| QA-005 | Orta | İki kese havadayken biri yere değince diğeri de kuma dönüyor | `engine/sim.ts` `stepFalling` (kese başına düşüş) |
| QA-006 | Orta | Android geri tuşu ana menüde onaysız çıkıyor | `ui/menu.ts`, `platform/native.ts` |
| QA-007 | Orta | İlk açılışta doğrudan bölüm 1'e girilmiyor (GDD §15) | `main.ts` |
| QA-008 | Orta | Uygulama ikonu / adaptive arka plan / splash eski mor palette | `scripts/make-icons.cjs` |
| QA-009 | Orta | 320×640'ta sonuç kartı düğmeleri ekran altında; kayıp kartında iki birincil düğme | `ui/result.ts`, `main.css` |
| QA-010 | Orta | Öğretici t3: döndürmeden oynayan oyuncu adım 1'de takılı kalıyor | `ui/tutorial.ts` `TUTORIAL_STEPS.t3[0]` |
| QA-011 | Düşük | Sonuç kartında puan binlik ayırıcısız | `ui/result.ts` |
| QA-012 | Düşük | "Parça" / "Kese" terim tutarsızlığı | `i18n/tr.ts` |
| QA-013 | Düşük | 320 px'te HUD hedef etiketi kısalıyor | `tr.ts`, `main.css` |
| QA-014 | Düşük | İptal edilen sürüklemeden sonra hayalet eski yükseklikte kalıyor (`wantY`) | `ui/play.ts` |
| QA-015 | Düşük | Hayalet iniş yerini değil bırakma yüksekliğini gösteriyor — iniş gölgesi önerisi | `render/boardRenderer.ts`, `play.ts` |
| QA-016 | Düşük | Patlama yanıp sönerken bırakılan kese ~383 ms havada asılı | `game/session.ts` `tick()` |
| QA-017 | Düşük | Devam +5 / arka plandan dönüşte tehlike sesi yeniden başlamıyor | QA-002 ile aynı |
| QA-018 | Düşük | Bozuk kayıtta yıldız sayısı sınırlanmıyor | `platform/storage.ts` `sanitize` |
| QA-019 | Düşük | İki metin rengi kontrast eşiğinin altında (`--faint`, `--parchment-muted`) | `render/theme.ts` |
| QA-020 | Düşük | Acı biber bloğunda renk körü sembolü yok; semboller küçük/soluk | `render/piecePreview.ts` |
| QA-021 | Düşük | "Hediye: …" bildirimi tahtanın üstünü örtüyor; booster ipucu diğer düğmelerin üstüne açılıyor | `ui/play.ts`, `boosterBar.ts` |
| QA-023 | Düşük | Belgeler güncel değil (README/pointer.ts "dokunarak bırak", duraklat/döngü iddiası) | README, `input/pointer.ts` |
| — | Düzeltildi | HUD "BOLUM" (Ö/Ü/İ noktaları kesiliyordu) | `839f0d9` |

## 3. Bölüm dengesi (ön değerlendirme, `93b401a`, açgözlü bot × 3 deneme)
- Başlangıçta hazır yol: hiçbir bölümde yok.
- Öğretici 1–3: bot hep kazanıyor; rastgele oyuncu 1'i 5/10, 2'yi 8/10, 3'ü 10/10 kaybediyor (GDD: ilk denemede ≥%95).
- **Botun hiç kazanamadığı bölümler (18/30):** 6, 8, 9, 10, 13, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 30. 9, 19, 26'da hiç yol kurulamadı.
- Aşırı kolay: 2, 21, 29 (29'da tek hamle 11.220 puan).
- Testere dişi eğri yok; 11'den sonra düz duvar. `SAND_REPOSE=2` dar boşlukları doldurmayı zorlaştırıyor olabilir.

## 4. İyi çalışanlar
Puan formülü (GDD §4.7) birebir; booster ve devam kuralları; ekonomi (negatif yok); geçiş reklamı kurallarının hepsi saat enjeksiyonuyla doğrulandı; sonsuz mod kilidi; kayıt ve bozuk kayıt dayanıklılığı; sürükle-bırak (çıkıntı altına sokamama, tahta dışına bırakınca hak harcanmaması); çoklu dokunuş/pencere/arka plan dayanıklılığı; performans (3 dk sonsuz mod: ort. 16,7 ms, sızıntı yok, heap ~8,5 MB); hiçbir turda konsol hatası yok.

## 5. Öneriler
Ayarlar ekranı (sarsıntı, renk körü, ses kaydırıcı, gizlilik); hayalet için iniş gölgesi; affedici öğretici; tek birincil düğme; uygulama adı kararı ("Kum Akışı" / "Tutam!"); `qa-run.cjs` hızlı bölümlerini CI'a eklemek; gerçek cihaz turu; dış testten önce AdMob test kimlikleri + UMP onayı.
