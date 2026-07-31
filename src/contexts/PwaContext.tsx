import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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

  const { toast } = useToast();

  // 1. Online / Offline listeners
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

  // 2. Service Worker Registration & Update Listener
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setRegistration(reg);

          // Check if there is already a waiting worker
          if (reg.waiting) {
            setUpdateAvailable(true);
          }

          // Listener for new service worker found
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                  toast("✨ Versi baru SIMAK tersedia! Silakan perbarui.", "info");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error("Gagal mendaftarkan Service Worker PWA:", err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, [toast]);

  // 3. Install Prompt Listener
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
    if (registration && registration.waiting) {
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
