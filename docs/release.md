# Kum Akışı — Yayın rehberi (Android)

Bu belge üç şeyi anlatır:
1. GitHub'ın otomatik derlediği deneme APK'sını indirip telefona kurmak,
2. Google Play Store'a çıkmak için gerekenler,
3. Sonraki adımlar.

---

## 1. Deneme APK'sını indirip telefona kurmak

### APK nasıl oluşuyor?
`game/` klasöründe bir şey değişip `main` ya da `ccr-...` ile başlayan bir dala push yapıldığında GitHub Actions
**Android APK** iş akışını kendiliğinden çalıştırır (`.github/workflows/android-apk.yml`). Sırasıyla:

1. Bağımlılıkları kurar (`npm ci`)
2. Testleri çalıştırır (`npm test`) — test kırıksa APK üretilmez
3. Oyunu derler (`npm run build`)
4. Web dosyalarını Android projesine kopyalar (`npx cap sync android`)
5. Java 21 + Android SDK ile **debug APK** derler (`./gradlew assembleDebug`)
6. APK'yı `kum-akisi-debug-apk` adıyla saklar (30 gün)

Elle çalıştırmak için: GitHub'da repo → **Actions** → soldan **Android APK** → sağda **Run workflow** → dalı seç → **Run workflow**.

### İndirme
1. GitHub'da repoyu aç → üstteki **Actions** sekmesi.
2. Soldan **Android APK**'yı seç, listedeki en üstteki **yeşil tikli** (başarılı) çalışmaya tıkla.
3. Sayfanın altındaki **Artifacts** bölümünde **kum-akisi-debug-apk**'ya tıkla → bir `.zip` iner.
   (Artifacts'ı indirmek için GitHub'a giriş yapmış olmak gerekir.)
4. Zip'i aç: içinde `app-debug.apk` var.

### Telefona kurma
1. `app-debug.apk` dosyasını telefona at (USB kablo, Google Drive, Telegram/WhatsApp'ta kendine gönder vb.).
   Telefonda tarayıcıyla GitHub'a giriş yapıp zip'i doğrudan da indirebilirsin; sonra **Dosyalar** uygulamasıyla zip'i aç.
2. Telefonda dosyaya dokun. Android "Bu kaynaktan uygulama yüklenmesine izin verilmiyor" derse:
   **Ayarlar**'a git → açılan ekranda **Bu kaynaktan izin ver** (bilinmeyen uygulamaları yükle) seçeneğini aç → geri dön.
   (Menü adı markaya göre değişir: *Ayarlar → Uygulamalar → Özel erişim → Bilinmeyen uygulamaları yükle*.)
3. **Yükle**'ye dokun. Play Protect "tanınmayan uygulama" uyarısı verirse **Ayrıntılar → Yine de yükle** de.
   Mağaza dışından gelen test APK'larında bu uyarı normaldir.
4. Uygulama listesinde **Kum Akışı** simgesi çıkar.

**Notlar**
- Yeni bir APK'yı eskisinin üstüne kurabilirsin; kayıtlar korunur. Bunun için tüm debug APK'lar repodaki sabit
  test anahtarıyla (`game/android/app/debug.keystore`, gizli değil) imzalanır. Yine de "paket mevcut paketle çakışıyor"
  hatası alırsan (ör. başka bir bilgisayarda derlenmiş APK) eski uygulamayı kaldırıp yeniden kur — kayıtlar silinir.
- Debug APK yalnızca test içindir; Play Store'a yüklenemez.
- En düşük Android sürümü: **7.0 (API 24)**.

---

## 2. Google Play Store'a çıkış için gerekenler

### a) Geliştirici hesabı
- <https://play.google.com/console> üzerinden **Google Play Console** hesabı açılır; tek seferlik ücret **yaklaşık 25 $**.
- Kimlik doğrulaması istenir (kişisel hesapta kimlik belgesi; kurumsal hesapta D-U-N-S numarası).
- **Kişisel (bireysel) hesap mı, kurum hesabı mı?** Kurum hesabı için şirket kaydı gerekir; kişisel hesabın ek kuralları var (aşağıda).

### b) Kapalı test kuralı (yeni kişisel hesaplar) — ⚠ kontrol edilmeli
Google, belirli bir tarihten sonra açılan **yeni kişisel** geliştirici hesapları için üretime (herkese açık) çıkmadan önce
bir **kapalı test** şartı getirdi. Bilinen hali: **en az 12 test kullanıcısının, en az 14 gün boyunca kesintisiz** kapalı
teste katılmış olması; ardından Play Console'dan üretim erişimi başvurusu yapılır.
**Sayı ve süre Google tarafından değiştirilebiliyor; başvurudan önce Play Console Yardım sayfasından güncel şart
kontrol edilmeli.** Kurum hesaplarında bu şart (şu an) yok.

Pratikte: arkadaş/aile/test grubundan 12+ kişinin Gmail adresini toplayıp bir Google Grubu ya da e-posta listesi
oluştur, kapalı test kanalına ekle, test linkini paylaş; 14 gün boyunca uygulamayı yüklü tutmalarını iste.

### c) İmzalama anahtarı (upload key)
Play'e yüklenen her sürüm **senin anahtarınla** imzalanır. Play App Signing ile Google asıl uygulama anahtarını saklar,
sen yalnızca **upload key** tutarsın (kaybedersen Play Console'dan sıfırlatılabilir ama zahmetli).

Anahtar oluşturma (bir kere, kendi bilgisayarında; JDK gerekli):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

- `upload.jks` dosyasını ve şifreleri **güvenli bir yerde** sakla (şifre yöneticisi + yedek). **Asla repoya koyma.**

### d) GitHub'da imzalı derleme (ileride açılacak)
İş akışında yorum satırı olarak hazır bekleyen bir `build-release` işi var. Açmak için:

1. Anahtarı base64'e çevir:
   ```bash
   base64 -w0 upload.jks > upload.jks.b64     # macOS: base64 -i upload.jks -o upload.jks.b64
   ```
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret** ile şunları ekle:

   | Secret | Değer |
   |---|---|
   | `KEYSTORE_BASE64` | `upload.jks.b64` dosyasının içeriği |
   | `KEYSTORE_PASSWORD` | keystore şifresi |
   | `KEY_ALIAS` | `upload` (yukarıdaki `-alias`) |
   | `KEY_PASSWORD` | anahtar şifresi (genelde keystore şifresiyle aynı) |

3. `game/android/app/build.gradle` içindeki mevcut `signingConfigs { debug { ... } }` bloğuna ortam
   değişkenlerinden okuyan bir `release` girişi ekle ve `buildTypes.release`'e bağla:
   ```groovy
   signingConfigs {
       debug { /* mevcut, dokunma */ }
       release {
           if (System.getenv("KEYSTORE_FILE")) {
               storeFile file(System.getenv("KEYSTORE_FILE"))
               storePassword System.getenv("KEYSTORE_PASSWORD")
               keyAlias System.getenv("KEY_ALIAS")
               keyPassword System.getenv("KEY_PASSWORD")
           }
       }
   }
   buildTypes {
       debug { /* mevcut, dokunma */ }
       release {
           signingConfig signingConfigs.release
           minifyEnabled false
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```
4. `.github/workflows/android-apk.yml` sonundaki `build-release` bloğunun yorumlarını kaldır. Elle (**Run workflow**)
   ya da `v0.2.0` gibi bir etiket push'unda çalışır; çıktısı `kum-akisi-release` artifact'ı: imzalı **AAB** + **APK**.

### e) AAB (Android App Bundle)
Play Store yeni uygulamalarda **APK değil AAB** ister (`./gradlew bundleRelease` →
`app/build/outputs/bundle/release/app-release.aab`). APK yalnızca elden dağıtım / test içindir.

### f) Sürüm numarası
Her Play yüklemesinde `game/android/app/build.gradle` içindeki **`versionCode` bir artırılmalı** (1, 2, 3 …);
`versionName` oyuncunun gördüğü sürümdür (`0.1.0`, `0.2.0` …). `game/package.json`'daki `version` ile aynı tutmak iyi olur.

### g) Mağaza sayfası için hazırlanacaklar
- Uygulama ikonu **512×512 PNG** → hazır: `game/store/icon-512.png` (`game/scripts/make-icons.cjs` üretir)
- Öne çıkan görsel **1024×500**
- En az 2 telefon ekran görüntüsü (dikey; `game/scripts/smoke.cjs` ile alınabilir)
- Kısa açıklama (80 karakter), uzun açıklama (4000 karakter), kategori (Bulmaca)
- **Gizlilik politikası** bağlantısı (veri toplamasak da istenir; reklam/analitik eklenirse zorunlu ve ayrıntılı olmalı)
- **İçerik derecelendirmesi** anketi, **Veri güvenliği** formu, hedef kitle (çocuklara yönelik mi?), reklam içeriyor mu
- **Hedef API seviyesi:** Play her yıl asgari `targetSdkVersion`'ı yükseltir; şu an `36` (`game/android/variables.gradle`) — yükleme öncesi güncel şart kontrol edilmeli.

---

## 3. Sonraki adımlar

1. İlk CI çalışmasını izle; APK'yı birkaç farklı telefonda dene (açılış rengi, dikey kilit, çentik/güvenli alan, geri tuşu).
2. Android geri tuşunu bağla (`@capacitor/app` `backButton` → menüye dön / duraklat).
3. Kayıtları `@capacitor/preferences` ile kalıcı yap (WebView `localStorage` temizlenebilir).
4. Play Console hesabını aç, kapalı test grubunu topla (12+ kişi, 14 gün — güncel şartı kontrol et).
5. Upload key oluştur, secret'ları ekle, `build-release` işini aç, ilk AAB'yi **dahili test** kanalına yükle.
6. Mağaza görselleri + gizlilik politikası sayfası (GitHub Pages yeterli).
7. Kapalı test geri bildirimleriyle düzelt → üretim başvurusu.
