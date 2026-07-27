import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("rounded-xl bg-white shadow-soft dark:bg-gray-900 dark:border dark:border-gray-800", className)}>
      {children}
    </div>
  );
}