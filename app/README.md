# Nakliye Baronu — Prototip

Tek dosyalık Flutter prototipi: bakiye sistemi, tick tabanlı ekonomi, "Yatırım Yap" ve "Risk Al" mekanikleri, enflasyon, vergi, kredi ve iflas.

## Çalıştırma

Flutter 3.27 veya üstü (Dart 3.6+) gerekir.

```bash
cd app
flutter create --platforms=android,ios .
flutter run
```

`flutter create .` yalnızca eksik platform klasörlerini (android/ios) oluşturur; mevcut `pubspec.yaml` ve `lib/main.dart` korunur.

Alternatif: Yeni bir proje açıp (`flutter create nakliye_baronu`) içindeki `lib/main.dart` dosyasını bu repodaki dosyayla değiştirin. Ek paket gerekmez.

## Denge parametreleri (`lib/main.dart`)

| Parametre | Yer | Varsayılan |
|-----------|-----|-----------|
| Oyun hızı | `setSpeed` | 1 gün = 2 sn (prototip için hızlandırılmış) |
| Başlangıç nakdi | `reset()` | 1.500.000 ₺ |
| Araç fiyat / gelir / gider | `catalog` | Kamyonet, Kamyon, Tır |
| Kurumlar vergisi | `taxRate` | %25 |
| İflas toleransı | `bankruptcyGrace` | 15 gün |
| Risk bekleme süresi | `riskCooldownDays` | 7 gün |
| Olay olasılığı | `_tick` | günlük %5 |
