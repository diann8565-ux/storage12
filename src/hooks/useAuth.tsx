
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { AxiosError } from "axios";
import { api } from "@/api/client";

export interface User {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInDev: (email?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await api.auth.me();
      setUser(response.data.user);
    } catch (error: unknown) {
      const status = (error as AxiosError)?.response?.status;
      if (status !== 401 && status !== 403) {
        console.error("Failed to fetch user:", error);
      }
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.auth.signIn({ email, password });
      const { access, user } = response.data;
      localStorage.setItem('auth_token', access);
      setUser(user);
      return { error: null };
    } catch (error: unknown) {
      const message = (error as AxiosError<{ error?: string }>)?.response?.data?.error || "Login failed";
      return { error: new Error(message) };
    }
  };

  const signInDev = async (email?: string) => {
    try {
      if (import.meta.env.PROD) {
        return { error: new Error("Dev login disabled in production") };
      }
      const response = await api.auth.devLogin(email);
      const { access, user } = response.data;
      localStorage.setItem('auth_token', access);
      setUser(user);
      return { error: null };
    } catch (error: unknown) {
      const message = (error as AxiosError<{ error?: string }>)?.response?.data?.error || "Dev login failed";
      return { error: new Error(message) };
    }
  };

  const signOut = async () => {
    // await api.auth.signOut(); // Disable API call to avoid errors
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInDev, signOut, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
