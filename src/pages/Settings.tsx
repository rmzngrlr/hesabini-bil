import { useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { AlertTriangle, Download, Upload } from 'lucide-react';

export default function Settings() {
  const { state, resetMonth, loadState } = useBudget();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleResetMonth = () => {
    if (confirm("Bu işlem sabit giderlerin 'Ödendi' durumunu sıfırlayacak. Emin misiniz?")) {
      resetMonth();
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `butce_yedek_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm("Mevcut verilerinizin üzerine bu yedek yüklenecek. Emin misiniz?")) {
           loadState(json);
           alert("Yedek başarıyla yüklendi!");
        }
      } catch (error) {
        console.error("Yedek yüklenirken hata oluştu:", error);
        alert("Dosya okunamadı veya formatı hatalı.");
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again if needed
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-20">
       <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
      </header>

      <Card title="Veri Yönetimi">
        <div className="flex gap-4 mt-2">
           <button
             onClick={handleExport}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <Download size={24} className="text-primary" />
             <span className="text-sm font-medium">Yedek Al</span>
           </button>

           <button
             onClick={handleImportClick}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <Upload size={24} className="text-primary" />
             <span className="text-sm font-medium">Yedek Yükle</span>
           </button>
           <input
             type="file"
             ref={fileInputRef}
             onChange={handleFileChange}
             accept=".json"
             className="hidden"
           />
        </div>
      </Card>

      <Card title="Tehlikeli Bölge" className="border-red-900/20 bg-red-950/5">
        <div className="mt-2">
           <button 
             onClick={handleResetMonth}
             className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-900/30 transition-colors"
           >
             <AlertTriangle size={20} />
             Yeni Ay Başlat
           </button>
           <p className="text-xs text-muted-foreground mt-2 text-center">
             Sabit giderlerin "Ödendi" durumunu sıfırlar. Bakiyeyi değiştirmez.
           </p>
        </div>
      </Card>
    </div>
  );
}
