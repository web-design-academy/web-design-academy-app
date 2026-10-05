import {createContext, type ReactNode, useContext, useEffect, useState} from "react";
import Modal from "@/components/Modal.tsx";
import "@/styles/notifications.css";

interface Notification {
  message: string;
  type: "info" | "warning" | "error" | "success";
  duration?: number; // in seconds
}

interface NotificationsContextType {
  pushNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  notifications: Notification[];
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export default function NotificationsProvider({children}: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pushNotification = (notification: Notification) => {
    setNotifications((prev) => [...prev, notification]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const hasExpiring = notifications.some(
    (n) => n.duration !== undefined && n.duration > 0
  );

  useEffect(() => {
    if (!hasExpiring)
      return;

    const timer = setInterval(() => {
      setNotifications((prev) =>
        prev
          .map((item) => {
            if (item.duration === undefined)
              return item;
            return {...item, duration: item.duration - 1};
          })
      );
      console.log("duration --")
    }, 1000);

    return () => clearInterval(timer);
  }, [hasExpiring]);

  return (
    <NotificationsContext.Provider
      value={{
        pushNotification,
        clearNotifications,
        notifications,
      }}
    >
      {children}

      <div className={"notification-container"}>
        {notifications
          .filter((n) => n.duration === undefined || n.duration > 0)
          .map((notification, index) => (
            <div
              key={index}
              className={`notification ${notification.type}`}
            >
              {notification.message}
            </div>
          ))
        }
      </div>

      <Modal
        title={"Notifications"}
        isOpen={false}
        onClose={() => {
        }}
        children={(
          <div></div>
        )}
      />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context)
    throw new Error("useNotifications must be used within a NotificationProvider");

  return context;
}
