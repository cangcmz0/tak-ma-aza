# Sosyal Trend Taraması — 2026-11-14

**Soru:** "Ters ses" akımını (söyle → tersini dinlet → karşıdaki taklit etsin → tekrar ters çevir → düzü çıksın mı?) çiftler ve video çekenler için **farklı türde** bir oyuna nasıl çeviririz?

**Karar:** Ters sesin kendisini yapma, o alan dolu. Akımın **iskeletini** al ve görsel hale getir: **Ters Kalem**. Bozuk bir kalemle partnerinin çizimini kopyala, sonra üst üste koyup ne kadar tuttuğunu gör.

## Akımın iskeleti (verb → payoff)

1. A bir şey üretir (ses / çizim / hareket).
2. Bir **makine** bunu bozar (ters çevirme, ayna, hız…).
3. B bozuk hâlini körlemesine taklit etmeye çalışır.
4. Makine geri çevirir → **ortaya çıkarma anı** → kahkaha.

Kalıcı olan bu dört adım. "Ters ses" bu iskeletin sadece bir örneği.

## Trend tablosu

| Trend | Kaynak (tarih) | Verb → payoff | Kapı (n/5) | Kullanım | Pencere | Somut oyun kancası |
|---|---|---|---|---|---|---|
| Ters ses / reverse singing | App Store'da çok sayıda klon. Örn. Reverse Audio Singing Trend Eki 2026'da güncellendi, Reverse Voice Haz 2026'da, Rewind Riddle Tem 2026'da çıktı (App Store / mwm.ai, 2025–2026) | taklit et → ters çevirip ortaya çıkar | 3/5 (sessiz izlenince okunmuyor, alan doymuş) | Video formatı / ilham | Doymuş. Klonlar hâlâ çıkıyor | Mekaniği değil iskeleti kullan |
| Ters ses parti oyunları | ReversePlay, Reverse It! Audio Party Game (App Store, 2026) | tahmin et → kahkaha | 3/5 | Kaçın | Doymuş | — |
| Ters dans (video) | Reverse Dance uygulaması (App Store) | ters hareketi taklit et → tekrar ters çevir | 4/5 | Kaçın (var, teknik olarak ağır) | — | — |
| Çift oyunları: Lying Challenge, 10 Game, Date Night M.A.S.H. | Her Campus (Eki–Kas 2025), Kapwing (Mar 2026) | test et → "ne kadar uyumluyuz?" | Format | Video formatı + mod fikri | Kalıcı tür, tek tek akımlar kısa ömürlü | Tur sonunda "Çift Uyum Puanı" |
| **Ters Kalem (öneri)** | Akım iskeleti + çizim zinciri oyunları (Gartic Phone, Scribble Pass). Bozuk kalemle kopyalama bulunamadı (arama, Kas 2026) | bozuk kalemle kopyala → üst üste koy, % benzerliği gör | **5/5** | **Mekanik (yeni oyun)** | Trende bağlı değil (çizim/parti oyunu kalıcı tür) | Bölünmüş ekran videosu: yüz + çizim + yüzde skoru |

## En iyi bahis: Ters Kalem *(çalışma adı)*

**Örnek tur (çift, tek telefon):**
1. Ayşe gizli bir kart çeker: **"Kedi"**. 10 saniyede çizer.
2. Telefon Mehmet'e geçer. Makine çarkı döner: **🪞 AYNA**. Parmağını sağa çekince çizgi sola gidiyor. Mehmet 10 saniyede Ayşe'nin kedisini kopyalamaya çalışır. Ön kamera yüzünü kaydeder.
3. **Ortaya çıkarma:** İki çizim üst üste biner, "Benzerlik %23" yazar. Ekran ikiye bölünür: Mehmet'in kıvranan yüzü ve patatese benzeyen "kedi".
4. Sıra değişir. 5 turun sonunda **Çift Uyum Puanı** çıkar.

**Bozuk kalemler (makineler):** 🪞 Ayna (sağ-sol ters) · 🙃 Baş aşağı · 🌀 Dönen kâğıt · 👻 Görünmez mürekkep (çizgi 1 sn sonra kaybolur, kör çizersin) · 🐌 Gecikmeli kalem · 🫨 Titrek el · ✂️ Tek çizgi (parmağını kaldırırsan biter)

**Modlar:**
- **Çift Düellosu:** 2 kişi, sırayla, uyum puanı.
- **Parti Zinciri (kırık telefon):** 3–8 kişi. Herkes bir öncekinin çizimini farklı bir bozuk kalemle kopyalar. Sonunda evrim videosu çıkar: kedi → patates → bulut → uzaylı.
- **Günlük Solo:** Herkese aynı günlük çizim, % skor ve paylaşılabilir sonuç kartı, seri sayacı.

**Video çekenler için:** Tek tuşla 9:16 video (üstte yüz kamerası, altta çizim timelapse'i + ortaya çıkarma + skor) ve köşede uygulama adı. Paylaşılan her video bedava reklam olur.

**Para kazanma:** Rewarded: yeni makineyi 24 saat aç, filigransız tek video, ekstra tur. Interstitial: sadece oyun bitince (tur arasında değil, parti akışını bozmasın). IAP: reklamsız + tüm makineler + filigransız video. Kart paketleri (Aşk, Hayvanlar, Yemek; marka/karakter yok).

**Teknik:** HTML5 Canvas. Dokunma koordinatına dönüşüm matrisi uygulanır (ayna/döndürme/gecikme). Benzerlik: iki çizim normalize edilip bulanık mesafe (chamfer) ile cihazda karşılaştırılır, sunucu yok. Ön kamera + kayıt: canvas birleştirme + MediaRecorder. Paketleme Capacitor ile.

**MVP:** Çift Düellosu + 5 makine + 200 kelime kartı (TR/EN) + benzerlik skoru + video dışa aktarma. Süre: 2–3 hafta (**tahmin**).
**MVP dışı:** Parti Zinciri (v1.1), Günlük Solo (v1.1), çevrimiçi oynama, ses makineleri.

**Skorlar:** Sadelik 5 · İçerik 5 · Viral 5 · Para 3 · Rekabet 4 · Zamanlama 3 · Uyum 5 = **30/35**

**Riskler:**
1. Parti/çift oyunları patlamalı oynanır, uzun vadeli tutunma zayıf olabilir → Günlük Solo + seri sayacı v1.1'de.
2. Benzerlik skoru "haksız" hissettirebilir → skoru eğlenceli tut (yüzde + komik unvan), kesin hakem gibi sunma.
3. Not: İki oyunculu çizim-benzerlik skoruyla ilgili bir ABD patenti var (US 9299263). Yayından önce kapsamına bakmakta fayda var (hukuki tavsiye değil).

**Kill switch:** D1, oturum başına tur sayısı, **video paylaşım oranı** (dışa aktarım / tamamlanan oyun). Eşikler `tracking-game-metrics` ile canlı benchmark'tan alınacak.

## Apartman ile ilişkisi

İkisi de 30/35. Fark:
- **Ters Kalem:** Daha hızlı yapılır (2–3 hafta), organik büyümesi içinde var. Tutunma ve para kazanma daha zayıf.
- **Apartman:** Tutunma ve para kazanma daha güçlü, organik büyüme daha yavaş.

Mantıklı sıra: önce Ters Kalem (hızlı çıkış, yayın sürecini öğrenme, takipçi toplama), sonra Apartman.

## Kaynaklar

- Reverse Audio Singing Trend: https://apps.appfollow.io/ios/reverse-audio-singing-trend/6752612612?country=us
- Reverse Voice: https://mwm.ai/apps/reverse-voice-reverse-singing/6778590235
- Rewind Riddle: https://mwm.ai/apps/rewind-riddle-reverse-sing/6792374216
- ReversePlay: https://apps.apple.com/us/app/reverseplay/id6761500533
- Reverse It! Audio Party Game: https://apps.apple.com/us/app/id6757831665
- Reverse Dance: https://apps.apple.com/app/id6752356363
- Scribble Pass: https://apps.apple.com/us/app/scribble-pass/id6759349730
- Her Campus — Lying Challenge: https://www.hercampus.com/culture/how-to-play-tiktok-lying-challenge-couples/
- Kapwing — March 2026 TikTok Trends: https://www.kapwing.com/resources/march-2026-tiktok-trends-for-creators-brands/
- Bad Copy (BearHacks 2025): https://ryanxing.vercel.app/projects/bad-copy
- US 9299263: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9299263
