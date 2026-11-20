# Stüdyo Yapısı

Bu oyun küçük bir mobil oyun stüdyosu gibi çalışan ajanlarla geliştiriliyor.
Yapımcı (koordinatör) işleri dağıtır, sonuçları birleştirir, her aşamadan sonra kalite kontrol yapar.

## Ekip
| Rol | Sorumluluk | Çıktı |
|---|---|---|
| Yapımcı (Producer) | Planlama, iş dağıtımı, birleştirme, git, kullanıcıya rapor | Bu dosya, `OYUN_TASARIMI.md` |
| Oyun Tasarımcısı | Kurallar, farklılaşma, bölüm hedefleri, ekonomi, para kazanma | `docs/GDD.md` |
| Teknik Lider | Proje altyapısı, kum motoru, sahneler, kayıt, bölüm yükleyici | `game/` |
| Oynanış Mühendisi | GDD'deki özel mekaniklerin kodlanması | `game/src/` |
| Bölüm Tasarımcısı | İlk 30 bölüm, zorluk eğrisi | `game/src/levels/` |
| Sanat & Arayüz | Görsel stil, renkler, menüler, efektler (kodla üretilen görseller) | `game/src/render/`, `game/src/ui/` |
| Ses | Kodla üretilen ses efektleri, titreşim | `game/src/audio/` |
| Yayın (DevOps) | Android paketleme, GitHub Actions ile APK derleme | `game/android/`, `.github/workflows/` |
| Kalite (QA) | Otomatik oynanış testleri, hata raporu | `docs/qa/` |

## Aşamalar
| Dalga | İş | Durum |
|---|---|---|
| 1 | Oyun tasarım dokümanı (GDD) + proje altyapısı ve kum motoru | ✅ Bitti |
| 2a | Oynanış mekanikleri, 30 bölüm, ses, Android + APK hattı | Devam ediyor |
| 2b | Görsel tema (Sanat & Arayüz), ekonomi ve güçlendiriciler | Bekliyor |
| 3 | QA turu, hata düzeltme, ilk test sürümü | Bekliyor |

## Kurallar
- Ajanlar commit/push yapmaz; birleştirmeyi yapımcı yapar.
- Oyuncunun gördüğü tüm metinler Türkçe (ileride İngilizce eklenecek).
- Hedef cihaz: dikey (portre) telefon, 60 FPS.
