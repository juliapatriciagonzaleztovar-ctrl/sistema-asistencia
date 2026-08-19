"use client";

import { AvatarFallback } from "./PhotoUpload";

interface IdCardProps {
  photoUrl: string | null;
  name: string;
  idCode?: string;
  lines: string[];
  status?: "active" | "inactive";
  className?: string;
}

export function IdCard({ photoUrl, name, idCode, lines, status = "active", className }: IdCardProps) {
  return (
    <div className={`bg-white dark:bg-[#1a2438] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex ${className}`}>
      <div className="relative w-20 h-20 shrink-0 bg-gradient-to-br from-gray-100 dark:bg-gray-800 to-gray-200 dark:bg-gray-700 flex items-end justify-center overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-16 h-16 mx-auto object-cover" />
        ) : (
          <AvatarFallback name={name} size="lg" />
        )}
        {idCode && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/90 dark:bg-gray-900/90 text-primary shadow-sm">{idCode}</span>
        )}
      </div>
      <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{name}</h3>
        {lines.map((line, i) => (
          <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{line}</p>
        ))}
        <span className={`mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-semibold ${status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
          {status === "active" ? "Activo" : "Inactivo"}
        </span>
      </div>
    </div>
  );
}