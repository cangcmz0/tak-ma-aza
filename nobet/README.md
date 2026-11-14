# Nöbet

Acil serviste gece nöbeti tutan bir stajyer doktorun oyunu. Her gün herkese aynı hastaların geldiği bir **Günün Nöbeti** de var. Hastanın yaşam bulgularına bakıp onu Kırmızı, Sarı ya da Yeşil alana yatırıyorsun, şikâyetine uygun tedaviyi seçiyorsun, tedavisi biten hastayı taburcu edip yatağı boşaltıyorsun. Bekletilen ağır hastanın kalbi durursa Kod Mavi'de ritimle kalp masajı yapıyorsun. Amaç sabah 08:00'e kadar Başhekim'i kızdırmadan dayanmak.

Tasarım ayrıntıları: [TASARIM.md](TASARIM.md)

## Çalıştırma

```bash
npm install
npm run build     # dist/index.html: tek dosya, tarayıcıda açılır
npm test          # kurallar, üretici ve denge testleri
npm run typecheck
```

`dist/index.html` internetsiz de açılır (yazı tipleri yüklenemezse sistem yazı tipine düşer). `dist/nobet-artifact.html` aynı oyunun claude.ai sayfası olarak yayınlanan hâlidir.

## Kod düzeni

| Dosya | Görevi |
|---|---|
| `src/data.ts` | Alanlar, tedaviler, şikâyetler ve sözleri, gece ayarları |
| `src/triage.ts` | Bulgu eşikleri ve triaj rengi |
| `src/patients.ts` | Tohumlu hasta üretici (bulgular her zaman doğru renge denk gelir) |
| `src/game.ts` | Simülasyon: önceden hesaplanan gelişler, bozulma, triaj, tedavi, hasta yakını, Kod Mavi, puan. DOM'a dokunmaz, durumu JSON'a çevrilebilir |
| `src/daily.ts` | Günün Nöbeti için tarih anahtarı ve tohum |
| `src/save.ts` | Yerel kayıt: yıldızlar, günlük sonuçlar, seri, unvan |
| `src/play.ts` | Oyun ekranı: çizim, dokunuşlar, hasta kartı, ipuçları |
| `src/cpr.ts` | Kod Mavi ritim mini oyunu |
| `src/ecg.ts` | Monitör EKG çizgisi |
| `src/audio.ts` | Sentezlenmiş sesler ve titreşim |
| `src/main.ts` | Menü, gece tanıtımı, mola, sonuç ekranı |
| `build.mjs` | esbuild ile tek dosyalık derleme |
