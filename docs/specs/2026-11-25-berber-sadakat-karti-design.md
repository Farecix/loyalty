# Berber Sadakat Kartı – Tasarım Belgesi

Tarih: 2026-11-25 · Durum: onaylandı (kullanıcı: "Tamam devam")

## 1. Amaç ve neden

Kâğıt damga kartının dijital hâli. Müşteri her gelişte puan toplar, belirli puanlarda ödül kazanır (ör. 5 gelişte bedava yıkama, 10 gelişte bedava tıraş). Müşteriler arkadaşlarını davet ederek yeni müşteri getirir.

Başlangıçta **tek bir berber** için kurulacak; ancak ileride **birçok berberin** kendi kartını ve kurallarını kurabileceği bir ürüne dönüşebilmeli. Bu yüzden veri modeli baştan çok berberli (multi-tenant) olacak, arayüz şimdilik tek berberi gösterecek.

**Pazar: Tayland.** Arayüz yalnız **Tayca ve İngilizce** (kullanıcı kararı). Varsayılan dil tarayıcı dilinden (Tayca değilse İngilizce), her ekranda TH/EN değiştirici; seçim tarayıcıda hatırlanır. Telefonlar Tayland numarası (+66), kişisel veri yasası **PDPA** (Personal Data Protection Act B.E. 2562).

## 2. Hedefler

- Müşteri uygulama indirmeden, bir linkle kendine kart açar; kart telefonda web sayfası olarak açılır (PWA – ana ekrana eklenebilir).
- **Puan verme müşterinin kendi telefonundan olur:** berberin dükkânda tek bir fiziksel kartı vardır (QR kod + NFC çip). Müşteri bunu okutunca kendi kartına 1 puan eklenir. **Berber onayı yoktur** (kullanıcının açık kararı: onay süreci uzatır).
- Ödül kuralları berber panelinden ayarlanabilir (puan eşiği + ödül adı).
- Arkadaş daveti: her müşterinin kişisel davet linki vardır.
- Berberin basit bir paneli olur: canlı puan akışı, müşteri listesi, ödül kuralları, şüpheli puanı iptal.

## 3. Hedef olmayanlar (şimdilik)

- Haftalık rapor / müşteri kaynak raporu – **kullanıcı vazgeçti.**
- Apple/Google Wallet kartı – ikinci aşama olabilir.
- WhatsApp / SMS bildirimleri, ödeme, randevu sistemi.
- Çok berberli kayıt akışı ve berber başına abonelik – veri modeli hazır olacak ama arayüz yapılmayacak.

## 4. Anti-hedefler (çalışsa bile başarısızlık sayılacaklar)

- Müşterinin evden/fotoğraftan sınırsız puan basabilmesi.
- Berbere her müşteride ekstra iş çıkarması (onay, telefon kurcalama).
- Müşteriden uygulama indirmesini ya da karmaşık kayıt istemesi.

## 5. Akışlar

### 5.1 Kart açma (müşteri)
1. Müşteri bir linkle gelir: dükkândaki kartın QR/NFC'si, ya da bir arkadaşın davet linki (`?ref=<kod>`).
2. Ad + telefon numarası girer, PDPA gizlilik bildirimini onaylar. (SMS doğrulama yok – maliyet ve sürtünme yüzünden.)
3. **Telefon numarası berber başına benzersizdir** (kullanıcı onayladı). Numara zaten kayıtlıysa kart açılmaz; ekranda "Bu numarayla zaten bir kart var, berberden giriş linki isteyin" yazar. Böylece kimse başkasının kartını ele geçiremez.
4. Tarayıcıda kalıcı bir oturum oluşur; kart açılır. Telefon değişirse berber panelden müşteriyi bulup tek kullanımlık, süreli bir giriş linki verir.

### 5.2 Puan alma (müşteri)
1. Tıraştan sonra müşteri berberin kartını okutur (QR → kamera, ya da NFC → dokundur). Kart, berbere özel sabit bir URL açar: `/s/<berber-kodu>`.
2. Kartı yoksa 5.1'e yönlendirilir, kart açtıktan sonra ilk puanı da alır.
3. Kontroller (hepsi sunucuda):
   - **Bekleme süresi:** aynı müşteri, aynı berberde son puanından itibaren **20 saat** geçmeden yeni puan alamaz.
   - **Konum:** tarayıcı konumu istenir; dükkânın **100 m** yakınında değilse puan verilmez. Zayıf GPS için: konumun hata payı çemberi dükkânın yarıçapıyla çakışıyorsa kabul (hata payı en fazla 1 km sayılır); değilse "Konumu açıp tekrar deneyin". Konum izni reddedilirse puan verilmez, ekranda açıklama çıkar. Konum saklanmaz, sadece kontrol edilir (PDPA). (Mesafe ve süre berber ayarlarından değiştirilebilir – *benim kararım*.)
4. Başarılıysa ekranda büyük bir "+1 ✓" ve güncel damgalar görünür.

### 5.3 Ödül
- Ödüller kademelidir; **döngü uzunluğu = en yüksek ödül eşiği** (*benim kararım*). Varsayılan: 5. puanda "bedava yıkama", 10. puanda "bedava tıraş"; 10'dan sonra sayaç 0'a döner.
- Kurallar değişirse müşterinin mevcut döngüdeki puanı korunur; yeni kurallar o andan itibaren geçerli olur. Önceden kazanılmış ödüller durur.
- Bakiye bir sayaçta değil, **puan geçmişinden hesaplanır** (iptal edilmemiş puanlar) – iptal mantığı bu yüzden basit kalır.
- Kazanılan ödül, kartta "Kullanılabilir ödül" olarak durur. Müşteri ödülü kullanırken berberin önünde **"Kullan"**a basar; ekran tam sayfa yeşil "KULLANILDI" gösterir: **canlı saat (saniyeli) ve hareketli animasyon** ile, eski ekran görüntüsüyle kandırmayı zorlaştırmak için. (Berber onayı gerekmez.) Kullanım berber panelindeki akışa düşer; berber yanlışlıkla yapılan kullanımı **geri alabilir**.

### 5.4 Arkadaş daveti
- Her müşterinin kişisel davet linki + paylaş butonu (WhatsApp vb. paylaşım menüsü) vardır.
- Davet edilen kişi kart açtığında davet eden kaydedilir. **Davet edilen ilk puanını aldığında** (yani gerçekten dükkâna geldiğinde) davet edene **+1 puan** verilir. Sadece kart açmak puan getirmez – sahte davetleri önlemek için.

### 5.5 Berber paneli
- E-posta + şifre ile giriş (Supabase Auth).
- **Canlı akış:** "14:32 – Mehmet +1 puan", "15:10 – Ayşe bedava yıkama kullandı". Her puanın yanında **İptal** butonu. İptal kuralları (*benim kararım*):
  - Puan iptal edilir → bakiye geçmişten yeniden hesaplanır; o puanla kazanılan ve **henüz kullanılmamış** ödül geri alınır.
  - Ödül **zaten kullanılmışsa** geri alınmaz, akışta "kullanılmış ödülün puanı iptal edildi" diye işaretlenir.
  - Davet edilen arkadaşın **ilk puanı** iptal edilirse davet edene verilen +1 de iptal edilir.
  - Ödül kullanımı da geri alınabilir (yanlışlıkla basılırsa).
- **Müşteriler:** liste, arama, müşteri detayı (puan geçmişi, davet ettikleri), giriş linki üretme.
- **Ayarlar:** dükkân adı, logo, dükkân konumu (haritadan), konum yarıçapı, bekleme süresi, ödül kuralları (eşik + ödül adı, ekle/sil).
- **Kart baskısı:** berber kartının QR kodunu ve baskıya hazır kart tasarımını (PDF/PNG) indirme. NFC çipe yazılacak URL ekranda gösterilir.

## 6. Yaklaşımlar

| Yol | Artı | Eksi |
|---|---|---|
| **A) Sıfırdan: Supabase + web uygulaması, Netlify'da** – **SEÇİLDİ** | Kod tamamen sizin, çok berbere geçiş en kolay, mevcut bağlantılar hazır | Değişiklikler için geliştirici gerekir |
| B) Lovable | Görsel editörle kendiniz düzenlersiniz | Kredi harcar, yapı üzerinde daha az kontrol |
| C) Apple/Google Wallet kartı | En "gerçek kart" hissi | Apple geliştirici hesabı (99$/yıl), ek kurulum; A'nın üstüne 2. aşama |

Kullanıcı A'yı seçti.

## 7. Teknik çerçeve (benim kararlarım)

- **Arayüz:** React + Vite + TypeScript + Tailwind, PWA. Tayca + İngilizce (metinler `th`/`en` sözlüklerinde; Tayca için Noto Sans Thai yazı tipi). Ödül adları berber panelinde iki dilde girilir (Tayca zorunlu, İngilizce boşsa Tayca gösterilir).
- **Arka uç:** Supabase (Postgres, Auth, RLS). Puan verme ve ödül mantığı veritabanı fonksiyonu / Edge Function içinde – istemciye güvenilmez.
- **Yayın:** Netlify.
- **Müşteri kimliği:** Supabase anonim oturum + ad/telefon profili.
- **Veri modeli (özet):** `shops` (berber: ad, konum, yarıçap, bekleme süresi, kart kodu), `shop_staff` (panel kullanıcıları), `customers` (shop'a bağlı; ad, telefon, davet kodu, davet eden), `stamps` (puan kayıtları; zaman, konum, kaynak: kart/davet, iptal edildi mi), `rewards` (kurallar), `reward_grants` (kazanılan/kullanılan ödüller). Her tablo `shop_id` taşır → çok berbere hazır.
- Berber kart kodu tahmin edilemez bir rastgele dizi; panelden yenilenebilir (kart kopyalanırsa eski kod geçersiz olur, yeni kart basılır).

## 8. Kısıtlar

- Konum kontrolü tarayıcı izni ister; iOS Safari'de HTTPS şart (Netlify sağlar). Konum sahteciliği tamamen engellenemez – kabul edilen risk, yanında bekleme süresi ve iptal var.
- NFC ile URL açma iPhone XS ve sonrası / çoğu Android'de çalışır; QR her telefonda çalışır.

## 8b. Açık kalanlar (kullanıcı)

- **Kalıcı alan adı:** henüz yok. Geliştirme ve test `*.netlify.app` adresinde yapılır. **Kart basılmadan önce kalıcı alan adı belirlenmeli** – QR/NFC'ye tam URL yazılacak.
- **Berber adı, logosu, dükkân konumu:** henüz verilmedi; yer tutucularla kurulur, panelden girilir.
- **PDPA metni:** Tayca + İngilizce genel bir gizlilik bildirimi şablonu konur; veri sorumlusu (berber) bilgileri sonradan doldurulur. Hukuki kontrol kullanıcının sorumluluğunda.

## 9. Geliştiriciye bırakılanlar

- Görsel tasarım (renk, yazı tipi), kart baskı tasarımının detayları.
- Klasör yapısı, test yaklaşımı, bileşen kütüphanesi.
- Dükkân adı/logo/konumu yoksa yer tutucu değerlerle kurulum.
