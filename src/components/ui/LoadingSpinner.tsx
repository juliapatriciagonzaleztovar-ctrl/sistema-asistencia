interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = "Cargando..." }: LoadingSpinnerProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
    </div>
  );
}