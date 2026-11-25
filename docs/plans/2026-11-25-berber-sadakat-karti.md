# Berber Sadakat Kartı – Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müşterinin dükkândaki tek bir QR/NFC kartı okutarak puan topladığı, ödül kazandığı ve arkadaş davet ettiği; berberin canlı akış ve ayarlar paneli olduğu web uygulaması.

**Architecture:** Tüm iş kuralları (puan, bekleme, konum, ödül döngüsü, davet, iptal) Supabase Postgres'te `SECURITY DEFINER` RPC fonksiyonlarında; istemci yalnızca RPC çağırır ve RLS ile kendi verisini okur. Arayüz React SPA (PWA), Netlify'da. Her tablo `shop_id` taşır (ileride çok berber).

**Tech Stack:** Postgres 16 (Supabase), supabase-js v2, React 18 + Vite + TypeScript + Tailwind + react-router, `qrcode`, Vitest + `pg` (DB testleri, yerel Postgres 16), Playwright (uçtan uca duman testi).

**Spec:** `docs/specs/2026-11-25-berber-sadakat-karti-design.md`

## Global Constraints

- Proje kökü: `/home/user/berber-sadakat` (git repo). Arayüz dili **yalnız Tayca (`th`) ve İngilizce (`en`)**; tüm metinler `src/i18n/th.ts` ve `src/i18n/en.ts` içinde, aynı anahtarlar (tip: `type Dict = typeof th`). Varsayılan: `navigator.language` `th` ile başlıyorsa `th`, değilse `en`; seçim `localStorage['lang']` (try/catch). Yazı tipi Noto Sans Thai.
- Ödül adları iki dilde: `reward_rules.title_th text not null`, `title_en text null` (boşsa Tayca gösterilir). Varsayılanlar: 5 → `ล้างผมฟรี` / `Free hair wash`, 10 → `ตัดผมฟรี` / `Free haircut`. `reward_grants` da `title_th`, `title_en` kopyalar.
- Gizlilik: Tayland **PDPA**; kayıtta onay kutusu, kolon adı `pdpa_accepted_at`, hata kodu `PDPA_REQUIRED`.
- Bekleme süresi varsayılan **20 saat**, konum yarıçapı varsayılan **100 m**, konum hata payı en fazla **1000 m** sayılır; ikisi de `shops` üzerinde ayarlanabilir.
- Varsayılan ödüller: **5 → yıkama**, **10 → tıraş** (adlar yukarıda). Döngü uzunluğu = en yüksek eşik.
- Telefon numarası berber başına benzersiz, Tayland biçiminde normalize: rakam dışı karakterler atılır; `0` ile başlıyorsa baştaki `0` yerine `66`; `66` ile başlamıyorsa başa `66` eklenir. Örn. `081-234-5678`, `+66 81 234 5678`, `812345678` → `66812345678`.
- Konum **saklanmaz**; `stamps` tablosunda lat/lng kolonu olmaz.
- Davet: davet edilen kişinin **ilk aktif puanında** davet edene +1 (`source='referral'`), bekleme süresinden muaf.
- Berber onayı yok. Puan iptali ve ödül kullanımını geri alma yalnızca personel (`shop_staff`) yapabilir.
- RPC hata kodları sabit metin olarak `raise exception '<KOD>'`: `SHOP_NOT_FOUND`, `PHONE_TAKEN`, `PDPA_REQUIRED`, `NOT_REGISTERED`, `NOT_STAFF`, `GRANT_NOT_AVAILABLE`, `LINK_INVALID`.
- `claim_stamp` hatayı exception ile değil `status` alanıyla döndürür (`ok`, `cooldown`, `too_far`, `not_registered`).
- Yayın: Netlify `*.netlify.app` (kalıcı alan adı henüz yok – kart basımı öncesi değişecek; URL `VITE_PUBLIC_BASE_URL` ortam değişkeninden okunur, koda gömülmez).

## Review Focus

1. **Aynı anda iki okutma** (çift dokunma / iki sekme): yalnızca bir puan yazılmalı → `claim_stamp` müşteri satırını `for update` kilitler; Task 4'te eşzamanlı test.
2. **Ödül kuralları döngü ortasında küçültülürse** (ilerleme 8, en yüksek eşik 10 → 5'e iner): bir sonraki puanda döngü sıfırlanmalı, puan kaybolmamalı, çift ödül çıkmamalı → Task 4 testi.
3. **Döngüyü sıfırlayan puan iptal edilirse**: ilerleme eski hâline (ör. 9) dönmeli → Task 5 testi.
4. **Telefon farklı biçimlerde yazılırsa** (`081-234-5678`, `+66 81 234 5678`, `812345678`): aynı numara sayılmalı → Task 3 testi.
5. **Konum izni yok / konum alınamıyor**: puan verilmez, ekranda ne yapılacağı yazar; uygulama çökmez → Task 6'da istemci testi (geolocation reddi → `too_far` değil `location_denied` mesajı).

---

## Dosya yapısı

```
berber-sadakat/
  supabase/migrations/
    0001_schema.sql          tablolar, indeksler, RLS
    0002_customer_rpc.sql    normalize_phone, register_customer, get_my_card
    0003_claim_stamp.sql     claim_stamp (+ yardımcılar: shop_cycle_length, issue_grants)
    0004_staff_rpc.sql       redeem_grant, cancel_stamp, undo_redemption, login linkleri, seed_default_rewards
  test/db/
    stubs.sql                auth şeması, auth.uid(), anon/authenticated rolleri (yalnız test)
    harness.ts               geçici Postgres kümesi, migration uygulama, asUser(uid) yardımcı
    *.test.ts
  src/
    lib/supabase.ts          istemci
    lib/api.ts               RPC sarmalayıcıları + tipler
    lib/geo.ts               getPosition() → {lat,lng,accuracy} | 'denied' | 'unavailable'
    lib/session.ts           anonim oturumu garanti et
    i18n/th.ts + en.ts
    routes/customer/         Signup, Card, Stamp, Redeem, LoginLink
    routes/panel/            Login, Feed, Customers, Settings, PrintCard
    App.tsx, main.tsx
  e2e/smoke.spec.ts
```

---

### Task 1: Repo iskeleti ve DB test düzeneği

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`, `.env.example`
- Create: `test/db/stubs.sql`, `test/db/harness.ts`, `test/db/harness.test.ts`, `vitest.config.ts`

**Interfaces:**
- Produces: `startDb(): Promise<{ query, asUser(uid: string|null, fn), stop }>` (`harness.ts`). `asUser` bir transaction açar, `set local role authenticated` (uid null ise `anon`) ve `set local request.jwt.claim.sub = uid` yapar. `stubs.sql`: `auth.users(id uuid pk)`, `auth.uid()` (`current_setting('request.jwt.claim.sub', true)::uuid`), roller `anon`, `authenticated`.
- npm script'leri: `dev`, `build`, `test` (vitest), `test:db`, `e2e`.

- [ ] Step 1: `git init`, Vite React-TS şablonu, Tailwind, react-router, supabase-js, qrcode, vitest, pg, @testing-library/react, playwright eklenir.
- [ ] Step 2: Test `harness.test.ts`: `select auth.uid()` `asUser('…uuid…')` içinde o uuid'yi, `asUser(null)` içinde null döndürür.
- [ ] Step 3: `harness.ts`: `/usr/lib/postgresql/16/bin/initdb` ile geçici dizinde küme, rastgele port, `stubs.sql` + `supabase/migrations/*.sql` sıralı uygulanır.
- [ ] Step 4: `npm run test:db` → PASS. `npm run build` → başarılı.
- [ ] Step 5: Commit `chore: iskelet ve db test düzeneği`.

### Task 2: Şema ve RLS

**Files:** Create `supabase/migrations/0001_schema.sql`, Test `test/db/schema.test.ts`

**Interfaces (Produces):**
- `shops(id uuid pk, name text, card_code text unique not null default <rastgele 16 karakter base62>, lat float8, lng float8, radius_m int default 100, cooldown_hours int default 20, created_at)`
- `shop_staff(shop_id → shops, user_id uuid → auth.users, pk(shop_id,user_id))`
- `customers(id uuid pk, shop_id, auth_user_id uuid, name text, phone text, invite_code text unique, referred_by uuid → customers null, pdpa_accepted_at timestamptz not null, cycle_reset_at timestamptz not null default '-infinity', created_at, unique(shop_id, phone), unique(shop_id, auth_user_id))`
- `stamps(id uuid pk, shop_id, customer_id, source text check in ('card','referral'), referral_for_stamp_id uuid → stamps null, prev_cycle_reset_at timestamptz null, created_at, cancelled_at timestamptz null)`
- `reward_rules(id uuid pk, shop_id, threshold int > 0, title_th text not null, title_en text, active bool default true, unique(shop_id, threshold) where active)`
- `reward_grants(id uuid pk, shop_id, customer_id, rule_id, stamp_id → stamps, title_th text, title_en text, created_at, redeemed_at null, voided_at null)`
- `login_links(token text pk, customer_id, expires_at, used_at null)`
- RLS: müşteri `customers`/`stamps`/`reward_grants` içinde yalnız `auth_user_id = auth.uid()` olan kendi satırlarını okur; personel kendi `shop_id`'sine ait her şeyi okur; `shops` herkesçe okunur ama `card_code` kolonu yalnız personele (ayrı görünüm `shops_public(id,name)`); doğrudan INSERT/UPDATE/DELETE yalnız personel için `shops` ve `reward_rules` üzerinde, diğer tablolara yazma yalnız RPC ile.

- [ ] Step 1: Testler: (a) müşteri A, müşteri B'nin `stamps` satırını göremez; (b) personel olmayan kullanıcı `reward_rules` ekleyemez; (c) anon `stamps`'e insert yapamaz; (d) aynı shop'ta aynı telefon iki kez eklenemez.
- [ ] Step 2: FAIL → Step 3: migration yazılır → Step 4: PASS → Step 5: Commit `feat(db): şema ve RLS`.

### Task 3: Müşteri kaydı ve kart okuma

**Files:** Create `supabase/migrations/0002_customer_rpc.sql`, Test `test/db/customer.test.ts`

**Interfaces (Produces):**
- `normalize_phone(text) returns text` (immutable) – Global Constraints kuralı; `'081-234-5678'`, `'+66 81 234 5678'`, `'812345678'` → `'66812345678'`.
- `register_customer(p_shop_code text, p_name text, p_phone text, p_ref_code text default null, p_pdpa boolean default false) returns uuid` – çağıranın `auth.uid()`'si ile müşteri oluşturur; geçersiz `p_ref_code` sessizce yok sayılır; aynı kullanıcı zaten kayıtlıysa mevcut id'yi döndürür.
- `get_my_card(p_shop_code text) returns jsonb`: `{ customer: {id,name,invite_code}, shop: {name}, progress int, cycle_length int, rules: [{threshold,title}], available: [{id,title,created_at}], last_stamp_at, next_allowed_at }` ya da kayıtlı değilse `null`.
- `progress` = `cycle_reset_at`'ten sonraki iptal edilmemiş puan sayısı. `cycle_length` = aktif kuralların en büyük eşiği (kural yoksa 10).

- [ ] Step 1: Testler: kayıt + `get_my_card` progress 0, cycle_length 10, 2 kural; Review Focus 4 (üç biçim aynı numara → ikinci kayıt `PHONE_TAKEN`); `p_pdpa=false` → `PDPA_REQUIRED`; yanlış kod → `SHOP_NOT_FOUND`; ref koduyla kayıtta `referred_by` dolu.
- [ ] Step 2–4: FAIL → uygula → PASS. Step 5: Commit.

### Task 4: Puan alma (`claim_stamp`)

**Files:** Create `supabase/migrations/0003_claim_stamp.sql`, Test `test/db/claim.test.ts`

**Interfaces:**
- Consumes: Task 2 tabloları, Task 3 `get_my_card`.
- Produces: `claim_stamp(p_shop_code text, p_lat float8, p_lng float8, p_accuracy float8) returns jsonb` → `{ status, next_allowed_at?, new_grants: [{id,title}], card }` (`card` = `get_my_card` çıktısı).
- Algoritma (sırayla, müşteri satırı `for update` kilitli):
  1. Kayıtlı değil → `not_registered`.
  2. Shop'un lat/lng'si varsa: `haversine_m(...) - least(p_accuracy,1000) > radius_m` → `too_far`. (lat/lng boşsa konum kontrolü atlanır – kurulum aşaması.)
  3. Son aktif `source='card'` puanı `now() - cooldown_hours` içindeyse → `cooldown` + `next_allowed_at`.
  4. Puan ekle; `issue_grants(customer_id, stamp_id)` çağır.
  5. Müşterinin bu ilk aktif puanıysa ve `referred_by` varsa ve o davet için aktif referral puanı yoksa: davet edene `source='referral', referral_for_stamp_id=<yeni puan>` puan ekle, onun için de `issue_grants`.
- `issue_grants(customer_id, stamp_id)`: progress'i hesapla; progress'e eşit eşikli her aktif kural için grant oluştur; `progress >= cycle_length` ise: o anda en yüksek eşikli kural progress'e eşit değilse o kural için de grant oluştur (bir kez), stamp'e `prev_cycle_reset_at = cycle_reset_at` yaz, `cycle_reset_at = stamp.created_at`.

- [ ] Step 1: Testler:
  - 5. puan → `new_grants` title_th `ล้างผมฟรี`; 10. puan → title_th `ตัดผมฟรี` ve sonrasında progress 0.
  - 20 saat dolmadan ikinci okutma → `cooldown`, puan sayısı değişmez; saat ileri alınınca (`stamps.created_at` geriye çekilerek) `ok`.
  - Dükkândan 500 m uzakta, accuracy 50 → `too_far`; 150 m uzakta, accuracy 80 → `ok`.
  - Davet: B (A'nın davetlisi) ilk puanı alınca A'nın progress'i +1; B'nin ikinci puanında A'ya ek puan yok.
  - Review Focus 1: iki eşzamanlı bağlantıda `claim_stamp` → toplam 1 aktif puan.
  - Review Focus 2: progress 8 iken kurallar 5'e indirilir → sonraki puanda tek grant ("en yüksek eşik" kuralı), progress 0.
- [ ] Step 2–4: FAIL → uygula → PASS. Step 5: Commit.

### Task 5: Ödül kullanma, iptal, giriş linki

**Files:** Create `supabase/migrations/0004_staff_rpc.sql`, Test `test/db/staff.test.ts`

**Interfaces (Produces):**
- `redeem_grant(p_grant_id uuid) returns timestamptz` – yalnız grant'in sahibi müşteri; kullanılmış/iptal ise `GRANT_NOT_AVAILABLE`.
- `cancel_stamp(p_stamp_id uuid) returns void` – personel; `cancelled_at=now()`; o puana bağlı kullanılmamış grant'ler `voided_at`; kullanılmış grant'lere dokunulmaz; puan bir döngü sıfırlamışsa (`prev_cycle_reset_at` dolu ve müşterinin `cycle_reset_at` = puanın `created_at`) `cycle_reset_at := prev_cycle_reset_at`; `referral_for_stamp_id` bu puanı gösteren referral puanı varsa onu da `cancel_stamp` ile iptal et.
- `undo_redemption(p_grant_id uuid) returns void` – personel; `redeemed_at = null`.
- `create_login_link(p_customer_id uuid) returns text` – personel; 24 saat geçerli, tek kullanımlık rastgele token.
- `consume_login_link(p_token text) returns uuid` – çağıran kullanıcının uid'sini müşterinin `auth_user_id`'sine yazar; geçersiz/süresi dolmuş/kullanılmış → `LINK_INVALID`.
- `create_shop(p_name text) returns uuid` – çağıranı personel yapar ve varsayılan iki kuralı ekler (panel ilk girişte kullanır).
- `shop_feed` görünümü (personel RLS): puanlar + kullanımlar, `{kind:'stamp'|'redeem', id, customer_name, title?, source?, at, cancelled}` son 200 olay.

- [ ] Step 1: Testler: kullanma ikinci kez → `GRANT_NOT_AVAILABLE`; personel olmayan `cancel_stamp` → `NOT_STAFF`; 5. puan iptal → kullanılmamış yıkama ödülü `voided`; kullanılmışsa olduğu gibi kalır; Review Focus 3 (10. puan iptal → progress 9); davetlinin ilk puanı iptal → davet edenin referral puanı da iptal; giriş linki ikinci kullanımda `LINK_INVALID`.
- [ ] Step 2–4: FAIL → uygula → PASS. Step 5: Commit.

### Task 6: Müşteri arayüzü

**Files:** Create `src/lib/*`, `src/i18n/th.ts`, `src/i18n/en.ts`, `src/routes/customer/*`, Test `src/lib/geo.test.ts`, `src/routes/customer/Stamp.test.tsx`

**Interfaces:**
- Consumes: Task 3–5 RPC'leri.
- Produces: `api.ts` içinde `registerCustomer`, `getMyCard`, `claimStamp`, `redeemGrant`, `consumeLoginLink`; `type Card` (`get_my_card` şekli). `ensureSession()` – oturum yoksa `supabase.auth.signInAnonymously()`.
- Rotalar: `/s/:shopCode` (okutma: kayıtlı değilse kayıt formu → kayıttan sonra otomatik `claimStamp`), `/k/:shopCode` (kart: damga ızgarası, ödüller, "Kullan", davet linki + `navigator.share`), `/d/:shopCode/:refCode` (davetle kayıt; puan vermez), `/g/:token` (giriş linki), `/k/:shopCode/kullan/:grantId` (tam ekran yeşil, saniyeli canlı saat + sürekli animasyon).
- Kayıt formu: ad, telefon, PDPA onay kutusu (metin sözlüklerde, TH+EN PDPA şablonu).

- [ ] Step 1: Testler: `getPosition` geolocation reddinde `'denied'` döner; Review Focus 5: `Stamp` bileşeni `'denied'` alınca `locationRequired` metnini (TH/EN) gösterir, `claimStamp` çağrılmaz; `cooldown` sonucunda `nextStampAt` metni gösterilir.
- [ ] Step 2–4: FAIL → uygula → PASS; `npm run build` başarılı. Step 5: Commit.

### Task 7: Berber paneli

**Files:** Create `src/routes/panel/*`, Test `src/routes/panel/Feed.test.tsx`

**Interfaces:**
- Consumes: Task 5 RPC'leri ve `shop_feed`.
- Rotalar: `/panel/giris` (e-posta + şifre, Supabase Auth; ilk girişte dükkânı yoksa `create_shop`), `/panel` (canlı akış: `shop_feed` + Supabase Realtime `stamps`/`reward_grants` değişikliğinde yenile; satırda İptal / Geri al), `/panel/musteriler` (arama ad/telefon, detay, "Giriş linki oluştur" → kopyala), `/panel/ayarlar` (ad, logo yükleme – Supabase Storage `logos` herkese açık bucket, `shops.logo_url` kolonu 0004'te eklenir; "Şu anki konumumu dükkân konumu yap" butonu + lat/lng alanları – harita yok, *karar*; yarıçap, bekleme; kurallar ekle/sil), `/panel/kart` (QR: `${VITE_PUBLIC_BASE_URL}/s/<card_code>`, NFC'ye yazılacak URL metni, "Kodu yenile", yazdır düzeni 85×55 mm kart).

- [ ] Step 1: Test: `Feed` iptal edilmiş puanı üstü çizili gösterir ve İptal butonunu gizler; İptal'e basınca `cancelStamp(id)` çağrılır.
- [ ] Step 2–4: FAIL → uygula → PASS; build başarılı. Step 5: Commit.

### Task 8: Supabase + Netlify yayını ve duman testi

**Files:** Create `netlify.toml` (SPA yönlendirme `/* → /index.html 200`), `e2e/smoke.spec.ts`

- [ ] Step 1: Kullanıcıdan Supabase organizasyonu seçimi (maliyet onayı) → `create_project`; migration'lar `apply_migration` ile sırayla; Auth'ta anonim girişi aç; `get_advisors` uyarısı yok.
- [ ] Step 2: Netlify sitesi oluştur, ortam değişkenleri `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_BASE_URL`; yayınla.
- [ ] Step 3: `e2e/smoke.spec.ts` (canlı adrese karşı, konum sahte): panelde kayıt → dükkân oluşur → kart sayfasından kod alınır → yeni tarayıcıda `/s/<kod>` → kayıt → "+1" görünür → panel akışında müşteri görünür. Run: `npx playwright test --trace off` → PASS.
- [ ] Step 4: Commit; kullanıcı GitHub reposu verirse push.
