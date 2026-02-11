
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Database, HardDrive, Check } from "lucide-react";
import { useData } from "@/hooks/useData";

export function StoragePermissionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { enableCache, isCacheEnabled } = useData();

  useEffect(() => {
    // Check if user has already made a choice
    const hasChoice = localStorage.getItem("storage_cache_permission");
    
    // If no choice made yet, show dialog after a short delay
    if (!hasChoice) {
      const timer = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = () => {
    enableCache();
    setIsOpen(false);
  };

  const handleDecline = () => {
    localStorage.setItem("storage_cache_permission", "denied");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] glass-strong border-blue-500/20">
        <DialogHeader>
          <div className="mx-auto bg-blue-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Database className="h-6 w-6 text-blue-400" />
          </div>
          <DialogTitle className="text-center text-xl">Izinkan Penyimpanan Lokal?</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Untuk pengalaman yang <strong>lebih cepat</strong> dan navigasi instan antar halaman, izinkan kami menyimpan data berkas Anda di browser (Cache).
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <HardDrive className="h-8 w-8 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Mode Offline & Cepat</p>
              <p className="text-xs text-slate-400">Data dimuat instan tanpa loading berulang.</p>
            </div>
            <Check className="h-5 w-5 text-green-500" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleDecline} className="w-full sm:w-auto">
            Nanti Saja
          </Button>
          <Button onClick={handleEnable} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0">
            Izinkan Cache
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
