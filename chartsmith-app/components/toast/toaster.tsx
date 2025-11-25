"use client";

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";
import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action && (
              <div className="flex gap-2">
                <button
                  onClick={action.onClick}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-forge border border-forge-iron bg-forge-iron/50 px-3 text-sm font-medium text-forge-silver transition-all hover:bg-forge-iron hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forge-ember/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  {action.label}
                </button>
              </div>
            )}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
