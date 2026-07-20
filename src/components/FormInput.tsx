import React, { useState } from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

interface BaseInputProps {
  label: string;
  error?: string;
  required?: boolean;
}

interface FormInputProps extends BaseInputProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> {
  register: UseFormRegisterReturn;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  required,
  register,
  type = "text",
  className = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`flex flex-col space-y-1.5 w-full ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <div className="relative w-full">
        <input
          type={type === "password" && showPassword ? "text" : type}
          className={`w-full pl-3.5 py-2 text-sm bg-white border dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all ${
            type === "password" ? "pr-10" : "pr-3.5"
          } ${
            error 
              ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" 
              : "border-gray-200 dark:border-zinc-800"
          }`}
          {...register}
          {...props}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 focus:outline-hidden cursor-pointer"
            id={`toggle-password-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        )}
      </div>
      {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
    </div>
  );
};

interface FormSelectOption {
  value: string | number;
  label: string;
}

interface FormSelectProps extends BaseInputProps, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> {
  register: UseFormRegisterReturn;
  options: FormSelectOption[];
  placeholder?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  required,
  register,
  options,
  placeholder,
  className = "",
  ...props
}) => {
  return (
    <div className={`flex flex-col space-y-1.5 w-full ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <select
        className={`w-full px-3.5 py-2 text-sm bg-white border dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all appearance-none cursor-pointer ${
          error 
            ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" 
            : "border-gray-200 dark:border-zinc-800"
        }`}
        {...register}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
    </div>
  );
};

interface FormTextareaProps extends BaseInputProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> {
  register: UseFormRegisterReturn;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  required,
  register,
  className = "",
  rows = 3,
  ...props
}) => {
  return (
    <div className={`flex flex-col space-y-1.5 w-full ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <textarea
        rows={rows}
        className={`w-full px-3.5 py-2 text-sm bg-white border dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all ${
          error 
            ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" 
            : "border-gray-200 dark:border-zinc-800"
        }`}
        {...register}
        {...props}
      />
      {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
    </div>
  );
};
