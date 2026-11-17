# Sıfırdan Holding — Veritabanı ve Sunucu Tasarımı v0.1

Amaç: Demo'daki tek oyunculu ekonomiyi bozmadan şu online özellikleri eklemek:
**bulut kayıt, liderlik tablosu, online ihale, ortaklık, ilçe yarışı (haftalık bölge lideri), ortak borsa, günlük ödül doğrulama, uygulama içi satın alma doğrulama.**

## 1. Teknoloji seçimi

| Katman | Seçim | Neden |
|---|---|---|
| Veritabanı | **Supabase (PostgreSQL)** | SQL, satır bazlı güvenlik (RLS), Flutter SDK'sı resmi |
| Kimlik | Supabase Auth: anonim giriş → sonra Apple / Google ile bağlama | Oyuncu kayıt olmadan başlar, telefon değişince hesabını taşır |
| Canlı veri | Supabase Realtime (Postgres değişiklik yayını) | İhale teklifleri ve borsa fiyatları anında herkese düşer |
| Sunucu mantığı | Supabase Edge Functions (TypeScript) + `pg_cron` | Para hareketi olan her işlem sunucuda doğrulanır |
| Ödeme | RevenueCat → webhook → Edge Function | App Store / Play makbuz doğrulaması tek yerde |

**Temel kural:** Tek oyunculu ekonomi (işletmeler, inşaat, satışlar) cihazda hesaplanır ve buluta kayıt olarak gider. **Başka oyuncuyu etkileyen her şey** (ihale, ortaklık, borsa, sıralama) yalnızca sunucuda değişir; istemci sadece istek gönderir.

## 2. Şema

```sql
-- Oyuncular ----------------------------------------------------------------
create table oyuncu (
  id            uuid primary key references auth.users(id) on delete cascade,
  takma_ad      text not null unique check (char_length(takma_ad) between 3 and 18),
  grup_adi      text not null default 'Kocabaş',
  memleket      text not null,                       -- il kodu: 'kayseri'
  basamak       smallint not null default 1 check (basamak between 1 and 5),
  itibar        smallint not null default 30,
  yildiz        smallint not null default 0,          -- halka arz prestiji
  reel_deger    numeric(20,0) not null default 0,     -- sıralama için, sunucu doğrular
  olusturma     timestamptz not null default now(),
  son_gorulme   timestamptz not null default now()
);

-- Bulut kayıt: tüm oyun durumu JSON, sürüm numarası çakışmayı önler -----------
create table kayit (
  oyuncu_id     uuid primary key references oyuncu(id) on delete cascade,
  surum         bigint not null default 1,
  oyun_gunu     integer not null,
  durum         jsonb not null,                       -- demo'daki S nesnesi
  sunucu_zamani timestamptz not null default now(),
  cihaz         text
);
create table kayit_yedek (                             -- son 10 kayıt, geri alma için
  id bigserial primary key,
  oyuncu_id uuid references oyuncu(id) on delete cascade,
  surum bigint, durum jsonb, zaman timestamptz default now()
);

-- Online ihale ---------------------------------------------------------------
create type ihale_durum as enum ('acik', 'kapandi', 'iptal');
create table online_ihale (
  id            bigserial primary key,
  baslik        text not null,                        -- 'Şehir hastanesi yapımı'
  il            text not null,
  basamak_min   smallint not null,                    -- kimler girebilir
  yaklasik      numeric(20,0) not null,               -- yaklaşık maliyet
  sure_gun      integer not null,                     -- iş süresi (oyun günü)
  bitis         timestamptz not null,                 -- gerçek zaman
  durum         ihale_durum not null default 'acik',
  kazanan_id    uuid references oyuncu(id),
  kazanan_teklif numeric(20,0)
);
create table ihale_teklif (
  id            bigserial primary key,
  ihale_id      bigint not null references online_ihale(id) on delete cascade,
  oyuncu_id     uuid references oyuncu(id),           -- null = ortaklık adına
  ortaklik_id   bigint,
  tutar         numeric(20,0) not null check (tutar > 0),
  zaman         timestamptz not null default now()
);
create index on ihale_teklif (ihale_id, tutar);

-- Ortaklık (konsorsiyum) -------------------------------------------------------
create table ortaklik (
  id            bigserial primary key,
  ad            text not null,
  kurucu_id     uuid not null references oyuncu(id),
  hedef         text,                                 -- 'Havalimanı ihalesi için'
  olusturma     timestamptz default now()
);
create table ortak (
  ortaklik_id   bigint references ortaklik(id) on delete cascade,
  oyuncu_id     uuid references oyuncu(id) on delete cascade,
  pay_yuzde     numeric(5,2) not null check (pay_yuzde > 0 and pay_yuzde <= 100),
  sermaye       numeric(20,0) not null default 0,
  onay          boolean not null default false,       -- pay pazarlığı bitince true
  primary key (ortaklik_id, oyuncu_id)
);
alter table ihale_teklif add foreign key (ortaklik_id) references ortaklik(id);

-- İlçe yarışı: haftalık en çok satan "bölge lideri" --------------------------
create table ilce_satis (
  hafta         date not null,                        -- haftanın pazartesisi
  ilce_kodu     text not null,                        -- 'istanbul:kadikoy'
  oyuncu_id     uuid references oyuncu(id) on delete cascade,
  satilan_birim integer not null default 0,
  ciro          numeric(20,0) not null default 0,
  primary key (hafta, ilce_kodu, oyuncu_id)
);
create table ilce_lider (
  hafta date, ilce_kodu text, oyuncu_id uuid references oyuncu(id),
  primary key (hafta, ilce_kodu)
);

-- Ortak borsa ------------------------------------------------------------------
create table hisse (
  kod           text primary key,                     -- 'ANCMT'
  ad            text not null,
  sektor        text not null,
  fiyat         numeric(14,4) not null,
  oynaklik      numeric(6,4) not null,
  arz           bigint not null                       -- toplam lot
);
create table hisse_fiyat (                            -- grafik için
  kod text references hisse(kod), zaman timestamptz, fiyat numeric(14,4),
  primary key (kod, zaman)
);
create table portfoy (
  oyuncu_id uuid references oyuncu(id) on delete cascade,
  kod text references hisse(kod),
  adet bigint not null check (adet >= 0),
  maliyet numeric(20,0) not null,
  primary key (oyuncu_id, kod)
);
create table borsa_emir (
  id bigserial primary key,
  oyuncu_id uuid references oyuncu(id),
  kod text references hisse(kod),
  yon text check (yon in ('al','sat')),
  adet bigint check (adet > 0),
  limit_fiyat numeric(14,4),                          -- null = piyasa emri
  durum text not null default 'bekliyor',
  zaman timestamptz default now()
);

-- Sunucu tarafı cüzdan: online işlemlerde kullanılan bakiye -----------------------
create table cuzdan_hareket (
  id bigserial primary key,
  oyuncu_id uuid references oyuncu(id),
  tutar numeric(20,0) not null,                       -- + giriş, - çıkış
  sebep text not null,                                -- 'ihale_teminat', 'hisse_alim', 'iap'
  referans text,
  zaman timestamptz default now()
);

-- Satın alma ve günlük ödül ------------------------------------------------------
create table satin_alma (
  id text primary key,                                -- mağaza işlem kimliği
  oyuncu_id uuid references oyuncu(id),
  urun text not null, tutar_tl numeric(10,2), dogrulandi boolean default false,
  zaman timestamptz default now()
);
create table gunluk_odul (
  oyuncu_id uuid references oyuncu(id) on delete cascade,
  gun date not null, seri smallint not null,
  primary key (oyuncu_id, gun)
);

-- Liderlik tablosu (materialized view, 10 dakikada bir yenilenir) ----------------
create materialized view liderlik as
  select id, takma_ad, grup_adi, basamak, yildiz, reel_deger,
         rank() over (order by yildiz desc, reel_deger desc) as sira
  from oyuncu;
```

## 3. Güvenlik (RLS)

```sql
alter table oyuncu enable row level security;
alter table kayit enable row level security;
alter table portfoy enable row level security;
alter table ihale_teklif enable row level security;

create policy "kendi profilini okur/yazar" on oyuncu
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "herkes profilleri görür" on oyuncu for select using (true);

create policy "kendi kaydı" on kayit
  for all using (auth.uid() = oyuncu_id) with check (auth.uid() = oyuncu_id);

create policy "kendi portföyü" on portfoy for select using (auth.uid() = oyuncu_id);

-- Teklifler herkese açık (ihale şeffaf), ama yazma sadece Edge Function ile:
create policy "teklifleri herkes görür" on ihale_teklif for select using (true);
-- insert/update politikası yok → istemci doğrudan yazamaz, sadece service_role yazar.
```

`reel_deger`, `basamak`, `yildiz` alanlarını istemci doğrudan değiştiremez; kayıt geldiğinde Edge Function makul aralıkta mı diye kontrol edip günceller (aşağıda "hile koruması").

## 4. Sunucu fonksiyonları

| Fonksiyon | Tetikleyici | Görev |
|---|---|---|
| `kayit-gonder` | İstemci, her 60 sn ve uygulama kapanırken | `surum` eşleşirse kaydeder, eşleşmezse en yeni kaydı döner. Yedeğe yazar. Reel değeri doğrular, sıralamayı günceller |
| `ihale-teklif` | İstemci | Basamak ve teminat kontrolü, teklifi yazar. **Son saniye koruması:** bitişe 30 sn'den az kaldıysa bitiş 30 sn uzar |
| `ihale-kapat` | `pg_cron` her dakika | Süresi dolan ihaleleri kapatır, en düşük teklifi kazanan ilan eder, ortaklıkta kazancı paylara göre böler |
| `ortaklik-*` | İstemci | Kur, davet et, pay teklif et, onayla, ayrıl. Tüm ortaklar onaylamadan teklif verilemez |
| `ilce-satis` | `kayit-gonder` içinde | Kayıttaki yeni satışları ilgili haftanın `ilce_satis` satırına ekler |
| `haftalik-lider` | `pg_cron` pazartesi 00:05 | Her ilçenin liderini yazar; ilk 5'e ödül, liderlere bir hafta %5 satış hızı |
| `borsa-tick` | `pg_cron` her dakika | Fiyatları arz-talep ve rastgele haberle günceller, bekleyen emirleri eşler, `hisse_fiyat`'a yazar |
| `borsa-emir` | İstemci | Bakiye/portföy kontrolü, emri kaydeder |
| `gunluk-odul` | İstemci | Sunucu tarihine göre bugün alındı mı bakar, seriyi hesaplar |
| `iap-webhook` | RevenueCat | Makbuzu doğrular, `satin_alma` + `cuzdan_hareket` yazar |

### Örnek: son saniye korumalı teklif (Edge Function)

```ts
// supabase/functions/ihale-teklif/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization")!;
  const kullanici = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await kullanici.auth.getUser();
  if (!user) return new Response("Giriş gerekli", { status: 401 });

  const { ihaleId, tutar } = await req.json();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("ihale_teklif_ver", { p_ihale: ihaleId, p_oyuncu: user.id, p_tutar: tutar });
  if (error) return new Response(error.message, { status: 400 });
  return Response.json(data);
});
```

```sql
-- Teklif ve süre uzatma tek işlemde (yarış durumuna karşı satır kilidi)
create or replace function ihale_teklif_ver(p_ihale bigint, p_oyuncu uuid, p_tutar numeric)
returns online_ihale language plpgsql security definer as $$
declare i online_ihale; o oyuncu;
begin
  select * into i from online_ihale where id = p_ihale for update;
  if i.durum <> 'acik' or now() > i.bitis then raise exception 'İhale kapandı'; end if;
  select * into o from oyuncu where id = p_oyuncu;
  if o.basamak < i.basamak_min then raise exception 'Basamağın bu ihaleye yetmiyor'; end if;
  if p_tutar < i.yaklasik * 0.6 then raise exception 'Teklif yaklaşık maliyetin %%60''ından düşük olamaz'; end if;
  insert into ihale_teklif (ihale_id, oyuncu_id, tutar) values (p_ihale, p_oyuncu, p_tutar);
  if i.bitis - now() < interval '30 seconds' then
    update online_ihale set bitis = now() + interval '30 seconds' where id = p_ihale returning * into i;
  end if;
  return i;
end $$;
```

## 5. Hile koruması

- **Zaman:** Çevrimdışı kazanç sunucu saatine göre hesaplanır (`kayit.sunucu_zamani`); telefon saatini ileri almak işe yaramaz. En fazla 8 saat.
- **Değer sıçraması:** Yeni kayıttaki reel değer, önceki kayda göre geçen oyun günüyle orantısız artmışsa (örneğin bir günde 50 kat), kayıt kabul edilir ama sıralamaya alınmaz ve işaretlenir.
- **Online para:** İhale teminatı, hisse alımı ve ortaklık sermayesi `cuzdan_hareket` üzerinden sunucuda düşülür. İstemcideki kasa bu işlemleri tek başına yapamaz.
- **Hız hilesi:** İstemci her kayıtta oyun günü ile gerçek süreyi birlikte gönderir; oyun hızı sınırının (10×) üstünde ilerleme varsa işaretlenir.

## 6. İstemci (Flutter) tarafı

- **Yerel kayıt:** Drift (SQLite) içinde aynı `durum` JSON'u. İnternet yoksa oyun yerelde devam eder.
- **Senkron:** Açılışta `kayit` çekilir, yereldekinden yeniyse yüklenir. 60 sn'de bir ve uygulama arka plana geçerken `kayit-gonder` çağrılır.
- **Canlı kanallar:** Açık ihale ekranındayken `ihale_teklif` (ilgili ihale), borsa ekranındayken `hisse` tablosu dinlenir. Ekrandan çıkınca abonelik kapanır (pil ve maliyet).
- **Kademeli geçiş:** Önce bulut kayıt + liderlik (1. aşama), sonra online ihale + ortaklık (2. aşama), en son ortak borsa (3. aşama). Ortak borsa en riskli ve maliyetli parça olduğu için son.

## 7. Kurulum sırası

1. Supabase projesi aç (bölge: Frankfurt, Türkiye'ye en yakın).
2. Bu dosyadaki SQL'i `supabase/migrations/0001_temel.sql` olarak ekle, `supabase db push`.
3. Anonim girişi aç; Apple ve Google sağlayıcılarını ekle.
4. Edge Function'ları `supabase functions deploy` ile yükle; `pg_cron` işlerini tanımla.
5. RevenueCat projesini aç, webhook adresini `iap-webhook` fonksiyonuna yönlendir.
6. Flutter tarafında `supabase_flutter` ve `purchases_flutter` paketlerini ekle.
