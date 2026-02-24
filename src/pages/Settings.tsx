import { useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Download, Upload, CreditCard } from 'lucide-react';
import { exportToExcel, importFromExcel } from '../services/excelService';

export default function Settings() {
  const { state, loadState, showMealCard, toggleShowMealCard } = useBudget();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleExport = () => {
    try {
      exportToExcel(state);
    } catch (error) {
      console.error("Yedek alınırken hata:", error);
      alert("Excel dosyası oluşturulurken bir hata meydana geldi.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (confirm("Mevcut verilerinizin üzerine bu Excel yedeği yüklenecek. Emin misiniz?")) {
          const newState = await importFromExcel(file);
          loadState(newState);
          alert("Excel yedeği başarıyla yüklendi!");
      }
    } catch (error) {
      console.error("Yedek yüklenirken hata oluştu:", error);
      alert("Excel dosyası okunamadı veya formatı hatalı.");
    }

    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-20">
       <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
      </header>

      <Card title="Görünüm ve Özellikler">
        <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                    <CreditCard size={20} />
                </div>
                <div>
                    <div className="font-medium">Yemek Kartı</div>
                    <div className="text-xs text-muted-foreground">Yemek kartı geliri ve harcamalarını takip et</div>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showMealCard}
                    onChange={toggleShowMealCard}
                />
                <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
        </div>
      </Card>

      <Card title="Excel Veri Yönetimi">
        <div className="flex gap-4 mt-2">
           <button
             onClick={handleExport}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <div className="bg-green-100 p-3 rounded-full dark:bg-green-900/30">
               <Download size={24} className="text-green-600 dark:text-green-400" />
             </div>
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-foreground">Yedek İndir</span>
                <span className="text-xs text-muted-foreground">.xlsx formatında</span>
             </div>
           </button>

           <button
             onClick={handleImportClick}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <div className="bg-blue-100 p-3 rounded-full dark:bg-blue-900/30">
                <Upload size={24} className="text-blue-600 dark:text-blue-400" />
             </div>
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-foreground">Yedek Yükle</span>
                <span className="text-xs text-muted-foreground">.xlsx formatında</span>
             </div>
           </button>
           <input
             type="file"
             ref={fileInputRef}
             onChange={handleFileChange}
             accept=".xlsx, .xls"
             className="hidden"
           />
        </div>
      </Card>
    </div>
  );
}
