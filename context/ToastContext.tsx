'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ToastProviderProps {
  children: ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const TOAST_DURATION = 3000; // 3 seconds

const TOAST_STYLES: Record<
  ToastMessage['type'],
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-foreground',
    icon: 'text-success',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    text: 'text-foreground',
    icon: 'text-destructive',
  },
  info: {
    bg: 'bg-muted',
    border: 'border-border',
    text: 'text-foreground',
    icon: 'text-muted-foreground',
  },
};

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================================================
// Toast Component
// ============================================================================

function ToastIcon({ type }: { type: ToastMessage['type'] }) {
  const iconClass = `size-5 ${TOAST_STYLES[type].icon}`;
  
  switch (type) {
    case 'success':
      return <CheckCircle className={iconClass} />;
    case 'error':
      return <AlertCircle className={iconClass} />;
    case 'info':
      return <Info className={iconClass} />;
  }
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const styles = TOAST_STYLES[toast.type];

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg
        ${styles.bg} ${styles.border} ${styles.text}
        animate-in slide-in-from-right-full duration-300
        data-[dismissed]:animate-out data-[dismissed]:slide-out-to-right-full
      `}
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`
          rounded-md p-1 transition-colors hover:bg-black/5
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        `}
        aria-label="Dismiss toast"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================================================
// Provider
// ============================================================================

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newToast: ToastMessage = { id, message, type };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after TOAST_DURATION
      setTimeout(() => {
        dismissToast(id);
      }, TOAST_DURATION);
    },
    [dismissToast]
  );

  const value: ToastContextType = {
    showToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
