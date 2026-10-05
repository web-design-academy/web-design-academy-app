import {createContext, type ReactNode, useContext} from "react";

interface Toast {
  message: string;
}

const ToastContext = createContext<Toast | null>(null);

export default function ToastProvider({children}: { children: ReactNode }) {
  return (
    <ToastContext.Provider
      value={{
        message: "This is a toast message",
      }}
    >
      {children}
      <div>This is a toast</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error("useToast must be used within a ToastProvider");

  return context;
}
