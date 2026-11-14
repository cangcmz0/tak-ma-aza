# Değerlendirme: Nöbet (v0.2 prototip) — 2026-11-14

**Profil:** Solo, kodu Claude yazıyor (HTML5/TS → Capacitor), mobil, az bütçe, Türkiye ana pazar. Bkz. `game-trend-profile.md`.

## 1. Karar: GO (test et), 27/35

En güçlü sebep: mobilde "bulguya bakıp triaj" yapan ve Türk acil servis mizahını kullanan bir oyun yok. Prototip zaten oynanabilir durumda, yani test etmenin maliyeti çok düşük.
Bu bir "tutacak" sözü değil. Oyuncu verisi yok. GO, gerçek oyuncuyla ölçmeye değer demek.

## 2. Çekirdek döngü

Hasta gelir → bulgularını okuyup Kırmızı/Sarı/Yeşil alana yatır → doğru tedaviyi seç → taburcu et, yatağı boşalt → sabah 08:00'e kadar dayan. Bekletilen ağır hastada Kod Mavi olur, hafif hasta şikâyet edip gider, Başhekim sıfırlanırsa kovulursun.

## 3. Puan tablosu

| Ölçüt | Puan | Gerekçe |
|---|---|---|
| Sadelik | 5 | Tek ekran, 2D arayüz, sunucu yok. v0.2 tek günde oynanabilir hale geldi |
| İçerik maliyeti | 4 | Hastalar ve geceler prosedürel; bulgular renge göre üretiliyor ve testle doğrulanıyor; bot doktor dengeyi ölçüyor. Ama espriler (≈70 söz) elle yazılı, tekrar etmeye başlayacak |
| Viral | 3 | Günün Nöbeti emoji kareleri paylaşılabilir sonuç üretiyor. Ama mizah yazıyla anlatılıyor ve Türkçe; sesi kapalı 3 saniyelik video "emoji ve rakamlar" gibi görünüyor, ilk bakışta okunmuyor |
| Para kazanma | 4 | Doğal ödüllü reklam anları var: Kod Mavi'de ikinci şans, kovulunca devam, ek yatak, puanı ikiye katlama. Geceler arasında geçiş reklamı yeri var. IAP: reklamsız. Meta (bina büyütme gibi) zayıf |
| Rekabet boşluğu | 4 | Hastane teması kalabalık: Hospital Surgeon 100M+ indirme (Google Play, Kas 2026), Operate Now serisi 40M+ (Spil, Kas 2026). Ama onlar ameliyat ve tıkla-servis et. Doğrudan triaj: The Ward: ER Hospital Drama (Ara 2025, henüz puan yok), ER Doctor (0,99 $), gerisi eğitim aracı (Night Shift, Triage Trainer, gistalt). Türkçe acil mizahı olan oyun bulunamadı |
| Zamanlama | 3 | Karışık: zaman yönetimi türü düşüşte (2025'te gelir −%12, indirme −%5,4; AppMagic, 2025). Mantık/çıkarım oyunları yükselişte (Meowdoku, Brain Puzzle 3 Ekim 2026 indirme top 5; Sensor Tower, Kas 2026). PC'de kontrol noktası/denetim oyunları yükselişte (geliştirici görüşü, kanıt zayıf) |
| Profil uyumu | 4 | Programlama + prosedürel üretim + yerel bilgi (Türk acil kültürü) tam güçlü yanlar. Zayıf yan çizim: emoji görünüm mağaza vitrininde ucuz durabilir, ucuz bir karakter paketiyle çözülür |
| **Toplam** | **27/35** | 1 puan yok, kapılar geçiyor |

**Mevcut oyun notları:** Mağazaya çıkabilir MVP'ye uzaklık ≈ 7–10 gün (**tahmin**): Capacitor paketi, ödüllü reklam, gömülü yazı tipi, mağaza görselleri. Tekrar kullanılabilir parçalar: simülasyon, üretici, Günün Nöbeti altyapısı, Kod Mavi mini oyunu, kayıt sistemi.

**Kapılar:** Üçüncü taraf IP yok · bütçe ve beceri yetiyor · yapım süresi bitti · tema kalabalık ama twist (bulgu okuyup triaj + Türk acil mizahı) var. Sessiz klipte twist ancak kısmen görünüyor: zayıf nokta.

## 4. Benzer oyunlar

| Oyun | Yapımcı | Çıkış | Durum | Para modeli | Şikâyetler |
|---|---|---|---|---|---|
| The Ward: ER Hospital Drama | 73ers | Ara 2025 | iPad, henüz yeterli puan yok | Ücretsiz + IAP + reklam | Doğrulanamadı (puan yok) |
| ER Doctor – Realistic ER Triage Simulator | Doğrulanamadı | 2026 | iPhone | 0,99 $ | Doğrulanamadı |
| Operate Now: Hospital | Spil Games | 2016'dan beri | Seri 40M+ indirme | Ücretsiz + IAP | Para kazanma baskısı, hatalar, bölüm ilerleyememe (Gamebrain, Common Sense Media) |
| Hospital Surgeon: Doctor Game | Dreamland Games | — | 100M+ indirme (Google Play) | Ücretsiz + reklam | Okunamadı |
| Night Shift (eğitim) | Schell Games + Pittsburgh Üniv. | Nis 2026 (JAMA) | Tablet, hekim eğitimi; ticari değil | — | — |
| Simülasyon: Acilde İlk Nöbet | ludi.one | ? | Türkçe bir simülasyon sayfası; içeriği açılamadı | ? | Doğrulanamadı |

Mağaza sayfaları bu ortamdan açılamadı (ağ kısıtı). Bilgiler arama özetlerinden.

## 5. Kullanılacak boşluklar

1. Hastane oyunlarında yaygın şikâyet para kazanma baskısı ve ilerleyememe (Operate Now). Nöbet'te reklam yalnızca ödüllü ve oyuncunun isteğiyle olmalı.
2. Doğrudan triaj oyunları ya eğitim aracı ya da çok yeni ve sesi çıkmamış: türün eğlenceli ve mizahi bir sürümü yok.
3. Hiçbir rakipte günlük ortak bulmaca ve paylaşılabilir sonuç yok.

## 6. En çok puan artıracak tek değişiklik

**"Gecenin Sözleri" paylaşım kartı.** Gece sonunda bir görsel kart: gecenin en komik 2–3 hasta sözü ("Gece 3'te rapor istedi, Hayriye Teyze 72"), emoji kareleri, puan ve unvan. Instagram hikâyesi ve X için hazır boyutta, canvas ile üretilir. Mizah yazıyla anlatıldığı için video yerine **ekran görüntüsü** formatı daha doğal. Viral 3 → 4 beklenir (**tahmin**), toplam 28/35.

Sonraki adım: emoji yerine durumu görsel olarak okunan karakterler (terleyen, dudağı morarmış, kolunu tutan). Sessiz videoyu okunur yapar, ama çizim gerektirir.

## 7. Bırakma kuralları (kill switch)

Test: Önce Türkiye'de web bağlantısıyla organik (TikTok/Instagram/X, arkadaş çevresi), sonra bir web portalında. Ölçülecekler ve eşikler:

| Metrik | Bırak | Geliştir | Büyüt / yayıncıya götür | Kaynak |
|---|---|---|---|---|
| D1 tutma | < %22 | %22–35 | ≥ %35–40 | GameAnalytics 2026: medyan D1 ≈ %22, en iyi %10 ≈ %40 (investgame.net PDF, Oca 2026) |
| D7 tutma | < %8 | %8–12 | ≥ %12 | Hybrid casual ≈ 26/12/5 (core-mba.pro derlemesi, 2026; kaynakları karışık, temkinli kullan) |
| 3. geceyi bitirme oranı | < %30 | %30–50 | ≥ %50 | **Tahmin**; ilk veriyle güncellenecek |
| Günlük paylaşım oranı (paylaşım / günlük nöbet) | < %3 | %3–8 | ≥ %8 | **Tahmin**; Wordle tipi oyunlar için güvenilir kaynak bulunamadı |

Eşikleri canlı veriyle `tracking-game-metrics` netleştirecek. Ölçmek için oyuna analitik eklemek gerekiyor (şu an yok).

## 8. Varsayımlar ve bilinmeyenler

- Ana pazar Türkiye. Mizah Türkçe; global sürüm için çeviri yetmez, esprilerin yerelleştirilmesi gerekir.
- **İsim:** Mağazada "Nöbet" araması onlarca nöbetçi eczane uygulamasıyla dolu (App Store, Kas 2026). Mağaza adı "Nöbet: Acil Servis" gibi ayırt edici olmalı.
- Öğrenme eğrisi: eşikler ezberlenince oyun hız oyununa dönebilir. Derinlik kaybı riski; kırmızı hastada iki adımlı tedavi ya da yeni hasta tipleri bunu öteler.
- Tıbbi tema: mağaza incelemesinde "tıbbi bilgi değildir" uyarısı korunmalı.
- Rakiplerin mağaza sayfaları ve yorumları okunamadı (ağ kısıtı); The Ward ve ER Doctor'ın gerçek performansı bilinmiyor.

## Önceki rapordan devreden açık konular

- Store hesapları (Google Play / Apple) var mı?
- Final isim için ASO / isim çakışma kontrolü → yukarıda: "Nöbet" tek başına eczane uygulamalarına karışıyor.
- Kill switch eşikleri canlı veriyle doldurulacak.

## Kaynaklar

- Sensor Tower, Ekim 2026 top 10: https://sensortower.com/blog/top-10-worldwide-mobile-games-by-revenue-and-downloads-in-october-2026
- AppMagic casual raporu (zaman yönetimi 2025): https://mobidictum.com/appmagic-casual-games-report-2025-summary/
- The Ward: ER Hospital Drama: https://apps.apple.com/us/app/-/id6756368229 · https://appgoblin.info/apps/6756368229
- ER Doctor: https://apps.apple.com/us/app/id6759113217
- Night Shift (JAMA, Nis 2026): https://hitconsultant.net/2026/04/20/upmc-night-shift-video-game-trauma-triage-jama/
- gistalt incelemesi: https://www.iatrox.com/blog/gistalt-review-the-emergency-medicine-game-that-asks-whether-your-patient-is-sick
- Hospital Surgeon (Google Play): https://play.google.com/store/apps/details?id=com.goxo.doctor.heart.surgery.game&hl=en
- Operate Now: https://apps.apple.com/us/app/id1136678102?l=en-us · https://gamebrain.co/game/operate-now-hospital-surgery · https://www.commonsensemedia.org/app-reviews/operate-now-hospital
- Acilde İlk Nöbet: https://ludi.one/en/simulasyon-acilde-ilk-nobet
- Kontrol noktası oyunları (geliştirici görüşü): https://wnhub.io/news/finance/item-51697
- GameAnalytics 2026 benchmark: https://investgame.net/wp-content/uploads/2026/01/2026-01-27-2026-mobile-pc-benchmarks_compressed.pdf
- Retention derlemesi: https://www.core-mba.pro/tool-hub/mobile-app-retention
- Nöbetçi eczane uygulamaları: https://apps.apple.com/us/app/-/id1565739139
