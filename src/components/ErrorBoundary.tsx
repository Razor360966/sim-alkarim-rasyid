import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, School } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside SMP Alkarim Master Data:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors p-4">
          <div className="text-center max-w-md px-6 py-8 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl flex flex-col items-center space-y-5">
            
            {/* Header */}
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-2">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-[10px] text-gray-400 font-extrabold tracking-widest uppercase mt-1">SMP ALKARIM RASYID</p>
            </div>

            {/* Error Message info */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Terjadi Kendala Sistem</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Aplikasi mengalami kesalahan internal yang tidak terduga. Silakan coba muat ulang halaman.
              </p>
              {this.state.error && (
                <pre className="mt-3 p-3 text-[10px] font-mono text-left bg-gray-50 dark:bg-zinc-950 dark:border-zinc-850 border rounded-xl overflow-x-auto max-w-full text-rose-600 dark:text-rose-400">
                  {this.state.error.message}
                </pre>
              )}
            </div>

            {/* Reload Button */}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
