import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingProps {
  variant?: "full" | "inline";
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ variant = "inline", text = "Memuat data..." }) => {
  if (variant === "full") {
    return (
      <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center py-10 text-gray-900 dark:text-zinc-50">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center space-x-2 py-3">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
      <span className="text-sm text-gray-500 dark:text-zinc-400">{text}</span>
    </div>
  );
};

export default Loading;
