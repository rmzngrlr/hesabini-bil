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

## Kurulum ve Çalıştırma

Bu proje **React (Vite)** ve **Tailwind CSS** ile geliştirilmiştir.

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Geliştirme Sunucusunu Başlatın:**
    ```bash
    npm run dev
    ```

3.  **Uygulamayı Derleyin (Production Build):**
    ```bash
    npm run build
    ```
    Oluşan `dist` klasörünü herhangi bir statik sunucuda (Vercel, Netlify, GitHub Pages vb.) yayınlayabilirsiniz.

## Teknolojiler

*   React 19
*   TypeScript
*   Tailwind CSS
*   Vite
*   Lucide React (İkonlar)
*   Date-fns
*   Vite PWA Plugin
