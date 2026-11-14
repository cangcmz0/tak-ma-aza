# Orijinal Challenge Uygulaması Fikirleri — 2026-11-14

**Kullanıcının isteği:** Hazır trendi kopyalamak yok. Kendi bulduğumuz, yapması basit (oyun kadar zor olmayan), çiftler ve video çekenler için challenge formatları.

**Karar:** Önce **Sesimi Tanı**. Mobilde benzerini bulamadım, içerik gerektirmiyor, 1–2 haftada çıkar ve arkasında gerçek bir bilimsel çalışma var.

**Not:** Bunlar oyun değil, "oyuncak". Ömürleri kısa ama çok ucuzlar. Biri tutarsa üstüne mod eklenir ya da hepsi tek bir "Çift Testleri" uygulamasında birleşir.

## Karşılaştırma

| Fikir | Sadelik | İçerik | Viral | Para | Rekabet | Zamanlama | Uyum | Toplam |
|---|---|---|---|---|---|---|---|---|
| Sesimi Tanı | 5 | 5 | 4 | 3 | 5 | 3 | 5 | **30/35** |
| Sesle Çiz | 4 | 5 | 5 | 3 | 4 | 3 | 5 | **29/35** |
| Tıkla Bil | 5 | 4 | 3 | 3 | 4 | 3 | 5 | **27/35** |

Zamanlama hepsinde 3: ortada bir trend yok, trendi biz başlatmaya çalışıyoruz. Çift oyunları kalıcı bir tür.

---

### 1. Sesimi Tanı *(çalışma adı)*

- **Akış:** A bir cümle kaydeder ("Aşkım, çay demledim") → uygulama 3 sahte kopya üretir (perde ve rezonans biraz kaydırılmış, hepsi A'ya benziyor) → B dördünü karışık dinler ve gerçeğini seçer → yanlışsa "Sevgilinin sesini tanıyamadın 💔" → tur ilerledikçe sahteler gerçeğe yaklaşır → 5 tur sonunda "Kulak Uyumu: %X".
- **Neden orijinal:** Bu oyunu yapan bir uygulama bulunamadı (arama, Kas 2026).
- **Bilimsel kanca:** Western University çalışması: insanlar partnerinin değiştirilmemiş sesini değiştirilmiş versiyonlarına göre daha iyi tanıyor. Rezonansı değiştirmek, perdeyi değiştirmekten daha çok şaşırtıyor (APS). Pazarlamada "Bilime göre…" diye kullanılabilir.
- **Video formatı:** "Sevgilim sesimi tanıyamadı 😱", "Annem beni tanıyabilecek mi?". Partneri etiketleme kancası: "Sen beni tanır mısın?"
- **Modlar (sonra):** Arkadaş grubu (4 kişinin sesi karışık), Aile modu.
- **Teknik:** Web Audio. Kayıt, pitch shift, rezonans/EQ filtresi, oynatma. Sunucu yok, içerik yok (sesleri kullanıcılar üretiyor).
- **Para:** Rewarded: bir sahteyi ele, tekrar dinle. IAP: reklamsız + zor mod. Interstitial: oyun sonunda.
- **MVP:** 1–2 hafta (**tahmin**).
- **Risk:** Sahteler çok kolay ya da çok zor olabilir → zorluk tur tur ayarlanır, test ederek kalibre edilir. Sadece sesle anlaşılıyor, sessiz izlenince okunmuyor → büyük "DOĞRU/YANLIŞ" ekranı ve yüz kamerası tepkisiyle telafi edilir.

#### Teknik: sahte sesler nasıl üretilir?

- **Yaklaşım:** Sıfırdan ses üretmek ya da yapay zekâyla ses klonlamak yok. Partnerin kendi kaydı 3 farklı şekilde bükülür:
  - **Perde** (incelik/kalınlık)
  - **Tını / rezonans** (formant: "kimin sesi" hissini veren şey)
  - **Tempo**
- **Motor:** WORLD vocoder (açık kaynak, analiz-sentez; perde ve tınıyı ayrı ayrı değiştirebiliyor) WASM'a derlenir. Alternatif: PSOLA / SoundTouch tabanlı basit zincir.
- **Asıl sorun:** İşlenmiş ses "robotik" duyulur ve gerçek olan tek doğal ses olarak kalırsa oyun çok kolaylaşır. Çözüm:
  1. Gerçek ses de aynı motordan "sıfır ayarla" geçer, böylece dördünde de aynı hafif iz olur.
  2. Dördüne de aynı "telefon hattı" filtresi uygulanır (bant geçiren filtre + hafif cızırtı + kompresör). Bu izleri örter. Tema: "Telefonda sevgilin arıyor… ama hangisi gerçek?"
  3. Sabit, kısa cümle kartı (2–3 sn). Herkes aynı cümleyi söyler.
- **Zorluk:** 1. turda büyük fark (örn. tını ±%12, perde ±2 yarım ton). 5. turda küçük fark (tını ±%3, perde ±0,5 yarım ton). Değerler prototipte kulakla kalibre edilecek (**tahmin**).
- **v2, gerçek ses havuzu:** Aynı cümleleri okuyan 30–40 gerçek kişinin kayıtları (izinli) uygulamaya gömülür. Partnerin sesine en yakın 3 kayıt (perde ve tını eşleşmesiyle) sahte olarak seçilir. Yapay iz olmaz, sunucu gerekmez (birkaç MB).
- **Grup modu:** Arkadaşların gerçek sesleri kullanılır, hiç işlem gerekmez.
- **Gizlilik:** Kayıtlar telefondan çıkmaz.
- **İlk adım:** 1–2 günlük "Ses Laboratuvarı" test sayfası (kaydet → 3 sahte + işlenmiş gerçek → karışık dinle → sürgülerle ayarla). Bu test çok kolay ya da çok zor çıkarsa v2'ye (ses havuzu) geçilir.

### 2. Sesle Çiz *(çalışma adı)*

- **Akış:** Ekranda kesik çizgili bir hedef şekil var (yıldız, kalp, çiçek) → kalem merkez etrafında döner. Ses inceldikçe dışarı açılır, kalınlaştıkça içeri girer, susunca kalem kalkar → yıldız için 5 kere "iiii-uuuu" → skor ve sonuç görseli.
- **Neden orijinal:** Sadece öğrenci projeleri (Voice Canvas, Screech) ve bir abonelik uygulamasında bir mod (Perfect Pitch Challenge: Ink Flow) var. Ayrı bir challenge uygulaması bulunamadı.
- **Video formatı:** Garip sesler çıkaran yüzler + ortaya çıkan şekil. Ses kapalıyken de anlaşılıyor (çizgi görünüyor). Çift düellosu: aynı şekli kim daha iyi çizer.
- **Teknik:** Mikrofonla perde algılama (autocorrelation) + Canvas + şekil benzerlik skoru.
- **MVP:** 1,5–2 hafta (**tahmin**).
- **Risk:** Gürültülü ortamda perde algılama zorlanabilir → basit kalibrasyon ekranı.

### 3. Tıkla Bil *(çalışma adı)*

- **Akış:** A aklından bir şarkı tutar → ekrana sadece ritmini tıklar → uygulama tıklamaları davul sesine çevirip B'ye çalar → B'nin 3 tahmin hakkı var → A "bu çok belli!" diye çıldırır, B'nin hiçbir fikri yok.
- **Neden orijinal:** Mırıldanarak tahmin oyunları var (Hum It!, Music Head), "sadece ritim" versiyonu bulunamadı.
- **Telif:** Uygulama müzik içermiyor, şarkıyı oyuncu kendisi aklından seçiyor. Kartlar kategori veriyor ("bir çocuk şarkısı", "bir düğün şarkısı").
- **MVP:** ~1 hafta (**tahmin**).
- **Risk:** Ses kapalıyken anlaşılmıyor → tepki odaklı video formatı.

## Elenenler

- **İç Saat** (ikisi birden kafadan 10 saniye sayar, kim daha uyumlu): TenSync ve "Stop at 10 seconds" tek kişilik versiyonlarını, DateSync For Couples da "%80 sync" çift skorunu zaten yapıyor.
- **Nabız Testi** (parmak kamerada, partner yaklaşınca nabız): akıllı saatle yapılan nabız trendinin kopyası. Sağlık ölçümü iddiası da store politikası riski taşıyor.
- **Titreşimli mesaj:** Videoda görünmüyor.
- **Bakışma / gülme yasak:** Kamera filtresi olarak zaten yaygın.

## Kaynaklar

- APS, partner sesi tanıma çalışması: https://psychologicalscience.org/?p=148773
- TenSync: https://apps.apple.com/app/id6763708226
- DateSync For Couples: https://apps.apple.com/us/app/-/id6757329461
- Stop at 10 seconds: https://apps.apple.com/us/app/-/id1635681599
- Voice Canvas (Devpost): https://devpost.com/software/voice-canvas
- Perfect Pitch Challenge: Go: https://apps.apple.com/us/app/-/id6755643511
- Hum It!: https://apps.apple.com/us/app/id1139356742
- Music Head: https://apps.apple.com/ms/app/id1529132862
- Couple Quiz: https://apps.apple.com/us/app/-/id6756860695
