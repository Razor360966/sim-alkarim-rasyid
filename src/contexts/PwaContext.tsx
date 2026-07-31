import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { registerSW } from "virtual:pwa-register";
import { useToast } from "./ToastContext";

interface PwaContextType {
  isOnline: boolean;
  updateAvailable: boolean;
  installable: boolean;
  applyUpdate: () => void;
  installApp: () => Promise<void>;
  registration: ServiceWorkerRegistration | null;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const { toast } = useToast();

  // 1. Cleanup legacy manual SW or stale cache on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          if (reg.active && reg.active.scriptURL.endsWith("/sw.js") && !reg.active.scriptURL.includes("workbox")) {
            console.log("Cleaning up legacy manual service worker...");
            reg.unregister();
          }
        }
      });

      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            if (name.startsWith("simak-app-v")) {
              console.log("Deleting legacy cache storage:", name);
              caches.delete(name);
            }
          }
        });
      }
    }
  }, []);

  // 2. Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast("🟢 Koneksi internet kembali normal", "success");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast("🔴 Anda sedang offline. Fitur terbatas hingga koneksi terhubung.", "warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  // 3. Register Service Worker using vite-plugin-pwa (Workbox)
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const updateSW = registerSW({
        onNeedRefresh() {
          setUpdateAvailable(true);
          toast("✨ Versi baru SIMAK tersedia! Silakan perbarui.", "info");
        },
        onOfflineReady() {
          console.log("SIMAK siap digunakan secara offline.");
        },
        onRegisteredSW(_swUrl, reg) {
          if (reg) {
            setRegistration(reg);
          }
        },
        onRegisterError(error) {
          console.error("Gagal mendaftarkan Service Worker Workbox:", error);
        }
      });

      updateSWRef.current = updateSW;

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, [toast]);

  // 4. Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Action: Apply Update
  const applyUpdate = useCallback(() => {
    if (updateSWRef.current) {
      updateSWRef.current(true);
    } else if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }, [registration]);

  // Action: Install App
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      toast("Aplikasi sudah ter-install atau browser tidak mendukung instalasi otomatis.", "info");
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        toast("Terima kasih telah meng-install SIMAK!", "success");
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("Gagal menginstall PWA:", err);
    }
  }, [deferredPrompt, toast]);

  return (
    <PwaContext.Provider
      value={{
        isOnline,
        updateAvailable,
        installable: !!deferredPrompt,
        applyUpdate,
        installApp,
        registration
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
};
