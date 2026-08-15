import { lazy, ComponentType } from "react";

/**
 * Robust lazy loading with automatic retries for dynamic imports.
 * Prevents "Failed to fetch dynamically imported module" errors caused by
 * temporary network drops, Vite server rebuilds, or stale chunk hashes.
 */
export function lazyRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | Record<string, any>>,
  name?: string
) {
  return lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem(`simak-chunk-refreshed-${name || "module"}`) || "false"
    );

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const module = await componentImport();
        // Clear force-refresh flag on success
        window.sessionStorage.removeItem(`simak-chunk-refreshed-${name || "module"}`);
        
        if (module && typeof module === "object") {
          if ("default" in module && module.default) {
            return { default: module.default as T };
          }
          // If named export was used
          const firstExportKey = Object.keys(module)[0];
          if (firstExportKey && module[firstExportKey]) {
            return { default: module[firstExportKey] as T };
          }
        }
        return module as { default: T };
      } catch (error) {
        attempts++;
        console.warn(`[lazyRetry] Attempt ${attempts} failed for ${name || "module"}:`, error);

        if (attempts >= maxAttempts) {
          if (!pageHasBeenForceRefreshed) {
            // Mark that we are attempting a single reload to fetch fresh bundle
            window.sessionStorage.setItem(`simak-chunk-refreshed-${name || "module"}`, "true");
            window.location.reload();
            return new Promise<{ default: T }>(() => {});
          }
          throw error;
        }

        // Wait before retrying (300ms, 800ms)
        await new Promise((resolve) => setTimeout(resolve, attempts * 300));
      }
    }

    throw new Error(`Failed to load module ${name || ""}`);
  });
}
