# Kişisel Bütçe ve Altın Takip PWA

Modern, sade ve tamamen çevrimdışı çalışabilen bir kişisel finans yönetim uygulaması. Excel tablolarından kurtulun ve harcamalarınızı, borçlarınızı ve altın yatırımlarınızı cebinizden takip edin.

## Özellikler

*   **Özet Paneli (Dashboard):**
    *   **Kalan Harçlık:** Aylık gelir ve geçen aydan devreden bakiye üzerinden anlık hesaplama.
    *   **KK Borcu:** Eklediğiniz tüm kredi kartı borç kalemlerinin toplamı.
    *   **Altın Portföyü:** 22 Ayar, 24 Ayar ve Reşat altınlarınızın güncel (veya manuel girilen) kur üzerinden toplam değeri.
    *   **İlerleme Çubuğu:** Aylık bütçenizin ne kadarını harcadığınızı görsel olarak takip edin.
    *   **Limit Takibi:** Nakit ve YK (Kredi Kartı) harcamalarınızı belirlediğiniz limitlere göre izleyin.

*   **Harcama Modülleri:**
    *   **Sabit Giderler:** Kira, faturalar gibi düzenli ödemelerinizi listeleyin ve "Ödendi" olarak işaretleyin.
    *   **Günlük Defter:** Hızlıca harcama ekleyin (Nakit veya YK seçeneği ile). Tarih sırasına göre listelenir.
    *   **Borç Takibi:** Kredi kartı ekstre kalemlerinizi tek tek girerek toplam borcunuzu yönetin.

*   **Ayarlar:**
    *   Gelir, Devreden Bakiye ve Harcama Limitlerini (Nakit/YK) güncelleyin.
    *   "Yeni Ay Başlat" özelliği ile sabit giderlerin ödeme durumunu sıfırlayın.

*   **Teknik Özellikler:**
    *   **Çevrimdışı Çalışma (Offline First):** Tüm veriler telefonunuzun hafızasında (LocalStorage) saklanır. Sunucuya ihtiyaç duymaz.
    *   **PWA Desteği:** "Ana Ekrana Ekle" diyerek bir uygulama gibi yükleyebilirsiniz.
    *   **Karanlık Mod (Dark Mode):** Göz yormayan, şık "Fintech" tasarımı.

## Kurulum ve Çalıştırma (Ubuntu / Linux Sunucu)

Bu proje **React (Vite)** frontend ve **Node.js/Express (SQLite)** backend bileşenlerinden oluşmaktadır. Ubuntu veya benzeri Linux sunucularda çalıştırmak için hazır scriptler bulunmaktadır.

Scriptleri çalıştırmadan önce çalıştırılabilir (executable) izinlerinin olduğundan emin olun:
```bash
chmod +x baslat_gelistirici.sh
chmod +x baslat_uygulama.sh
```

### 1. Canlı/Kullanım Modu (Production/Preview)

Uygulamayı derleyip (build) hem frontend hem de backend'i aynı anda başlatmak için:

```bash
./baslat_uygulama.sh
```

*Bu script otomatik olarak:*
* Eksikse hem ana dizin hem de `server` dizinindeki paketleri (`npm install`) yükler.
* Frontend ve Backend'i derler (`npm run build` & `npm run server:build`).
* Uygulamayı ağa açık (`--host`) şekilde, backend ile eşzamanlı olarak başlatır.

### 2. Geliştirici Modu (Development)

Kod üzerinde anlık değişiklikler yaparak çalışmak istiyorsanız:

```bash
./baslat_gelistirici.sh
```

*Bu script otomatik olarak:*
* Eksikse gerekli paketleri yükler.
* Frontend ve Backend'i geliştirici modunda (hot-reload desteğiyle) eşzamanlı olarak başlatır.
* Sunucuya ağ üzerinden (`--host`) erişmenize olanak tanır.

### Manuel Komutlar (Gelişmiş)

Eğer scriptleri kullanmak istemezseniz aşağıdaki npm komutlarını kullanabilirsiniz:
* `npm run dev:all` - Geliştirme sunucularını başlatır (Frontend + Backend).
* `npm run start:all` - Uygulamayı derlenmiş haliyle canlı önizleme modunda başlatır.

## Teknolojiler

*   React 19
*   TypeScript
*   Tailwind CSS
*   Vite
*   Lucide React (İkonlar)
*   Date-fns
*   Vite PWA Plugin
