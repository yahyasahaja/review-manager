"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getIdToken,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      alert("Firebase is not configured. Please check your .env.local file.");
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Store the OAuth credential for later use
      // Firebase Auth with Google provider gives us the OAuth access token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        // Store in sessionStorage for API calls
        sessionStorage.setItem('google_access_token', credential.accessToken);
      }
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      // Clear stored access token on logout
      sessionStorage.removeItem('google_access_token');
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (!auth || !user) return null;
    try {
      const token = await getIdToken(user);
      return token;
    } catch (error) {
      console.error("Error getting ID token", error);
      return null;
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    // Get the stored OAuth access token from sessionStorage
    return sessionStorage.getItem('google_access_token');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, getIdToken: getToken, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
