
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { api } from "@/api/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface FileItem {
  id: string;
  name: string;
  url: string;
  file_type: string | null;
  size: number;
  created_at: string;
  storage_account_id: string | null;
  file_id: string | null;
  categories?: Category[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface StorageAccount {
  id: string;
  name: string;
  provider: "imagekit" | "cloudinary";
  public_key: string;
  private_key_encrypted: string;
  url_endpoint: string;
  is_active: boolean;
  createdAt: string;
}

interface DataContextType {
  files: FileItem[];
  categories: Category[];
  storageAccounts: StorageAccount[];
  loading: boolean;
  isCacheEnabled: boolean;
  refreshData: () => Promise<void>;
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  enableCache: () => void;
  disableCache: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const CACHE_KEY_FILES = "storage_files_cache";
const CACHE_KEY_CATEGORIES = "storage_categories_cache";
const CACHE_KEY_ACCOUNTS = "storage_accounts_cache";
const CACHE_KEY_PERMISSION = "storage_cache_permission";

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storageAccounts, setStorageAccounts] = useState<StorageAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isCacheEnabled, setIsCacheEnabled] = useState(false);

  // Check permission on mount
  useEffect(() => {
    const permission = localStorage.getItem(CACHE_KEY_PERMISSION);
    if (permission === "granted") {
      setIsCacheEnabled(true);
      // Load initial data from cache if available
      try {
        const cachedFiles = localStorage.getItem(CACHE_KEY_FILES);
        const cachedCats = localStorage.getItem(CACHE_KEY_CATEGORIES);
        const cachedAccs = localStorage.getItem(CACHE_KEY_ACCOUNTS);
        
        if (cachedFiles) setFiles(JSON.parse(cachedFiles));
        if (cachedCats) setCategories(JSON.parse(cachedCats));
        if (cachedAccs) setStorageAccounts(JSON.parse(cachedAccs));
      } catch (e) {
        console.error("Failed to load cache", e);
      }
    }
  }, []);

  const enableCache = useCallback(() => {
    localStorage.setItem(CACHE_KEY_PERMISSION, "granted");
    setIsCacheEnabled(true);
    // Save current state to cache
    localStorage.setItem(CACHE_KEY_FILES, JSON.stringify(files));
    localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(CACHE_KEY_ACCOUNTS, JSON.stringify(storageAccounts));
    toast.success("Cache offline diaktifkan");
  }, [files, categories, storageAccounts]);

  const disableCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY_PERMISSION);
    localStorage.removeItem(CACHE_KEY_FILES);
    localStorage.removeItem(CACHE_KEY_CATEGORIES);
    localStorage.removeItem(CACHE_KEY_ACCOUNTS);
    setIsCacheEnabled(false);
    toast.success("Cache offline dinonaktifkan");
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [filesRes, catsRes, accsRes] = await Promise.all([
        api.files.list(),
        api.categories.list(),
        api.storageCredentials.list()
      ]);

      const newFiles = filesRes.data || [];
      const newCats = catsRes.data || [];
      const newAccs = accsRes.data || [];

      setFiles(newFiles);
      setCategories(newCats);
      setStorageAccounts(newAccs);

      // Update cache if enabled
      if (isCacheEnabled) {
        localStorage.setItem(CACHE_KEY_FILES, JSON.stringify(newFiles));
        localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(newCats));
        localStorage.setItem(CACHE_KEY_ACCOUNTS, JSON.stringify(newAccs));
      }

    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Gagal menyinkronkan data");
    } finally {
      setLoading(false);
    }
  }, [user, isCacheEnabled]);

  // Initial fetch when user logs in
  useEffect(() => {
    if (user && !initialized) {
      // If cache is enabled and we loaded data from cache, we might want to fetch in background
      // For now, we fetch to ensure freshness, but UI shows cached data immediately
      refreshData().then(() => setInitialized(true));
    } else if (!user) {
      setFiles([]);
      setCategories([]);
      setStorageAccounts([]);
      setInitialized(false);
    }
  }, [user, initialized, refreshData]);

  // Sync state changes to cache if enabled
  useEffect(() => {
    if (isCacheEnabled && initialized) {
        localStorage.setItem(CACHE_KEY_FILES, JSON.stringify(files));
        localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(categories));
        localStorage.setItem(CACHE_KEY_ACCOUNTS, JSON.stringify(storageAccounts));
    }
  }, [files, categories, storageAccounts, isCacheEnabled, initialized]);

  return (
    <DataContext.Provider value={{ 
        files, 
        categories, 
        storageAccounts, 
        loading, 
        isCacheEnabled,
        refreshData, 
        setFiles,
        setCategories,
        enableCache,
        disableCache
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
