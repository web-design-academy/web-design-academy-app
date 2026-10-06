import {createContext, type ReactNode, useCallback, useContext, useEffect, useState} from "react";
import Modal from "@/components/Modal.tsx";
import "@/styles/notifications.css";
import InfoBanner from "@/components/InfoBanner.tsx";

export type NotificationType = "info" | "success" | "warning" | "error";

interface Notification {
  message: string;
  type: NotificationType;
  duration: number | undefined; // in seconds
}

interface ExpiringNotification extends Notification {
  remainingDuration: number | undefined;
}

interface NotificationsContextType {
  showNotifications: () => void;
  pushNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  notifications: Notification[];
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export default function NotificationsProvider({children}: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ExpiringNotification[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pushNotification = useCallback((notification: Notification) => {
    const duration = notification.duration ? notification.duration + 1 : undefined;
    const newNotification: ExpiringNotification = {
      ...notification,
      remainingDuration: duration,
      duration: duration
    };
    setNotifications((prev) => [...prev, newNotification]);
  }, []);

  const showNotifications = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeNotification = useCallback((index: number) => {
    setNotifications((prev) => {
      const newNotifications = [...prev];
      newNotifications[index].remainingDuration = 0;
      newNotifications[index].duration = 0;
      return newNotifications;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const hasExpiring = notifications.some(
    (n) => n.remainingDuration !== undefined && n.remainingDuration > 0
  );

  useEffect(() => {
    if (!hasExpiring)
      return;

    const timer = setInterval(() => {
      setNotifications((prev) =>
        prev
          .map((item) => {
            if (item.remainingDuration === undefined)
              return item;

            const newRemainingDuration = item.remainingDuration - 1;

            return {
              ...item,
              duration: newRemainingDuration === 0 ? 0 : item.duration,
              remainingDuration: newRemainingDuration,
            };
          })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [hasExpiring]);

  return (
    <NotificationsContext.Provider
      value={{
        pushNotification,
        showNotifications,
        clearNotifications,
        notifications,
      }}
    >
      {children}

      <div className={"notification-container"}>
        {notifications.map((notification, index) =>
            (notification.remainingDuration === undefined || notification.remainingDuration > 0) && (
            <div
              className={`notification ${notification.remainingDuration === 1 ? "slide-out" : ""}`}
            >
              <InfoBanner
                key={index}
                type={notification.type}
                message={notification.message}
                duration={notification.duration ? notification.duration - 1 : undefined}
                closeAction={() => closeNotification(index)}
              />
            </div>
            )
        )}
      </div>

      <Modal
        title={"Notifications"}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        children={(
          <div>
            {notifications.map((notification, index) =>
              <InfoBanner
                key={index}
                type={notification.type}
                message={notification.message}
                duration={notification.duration ? notification.duration - 1 : undefined}
                closeAction={() => closeNotification(index)}
              />
            )}
          </div>
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
