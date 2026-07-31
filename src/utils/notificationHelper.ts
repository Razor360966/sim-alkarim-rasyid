/**
 * Notification Helper for PWA
 * Prepares browser notification permissions and architecture for future FCM / Push Notifications
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

export const isNotificationSupported = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn("Web Notification tidak didukung pada browser ini.");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Gagal meminta izin notifikasi:", error);
    return "denied";
  }
};

export const sendLocalNotification = (payload: NotificationPayload): boolean => {
  if (!isNotificationSupported()) return false;

  if (Notification.permission === "granted") {
    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || "/icon-192.png",
        badge: payload.badge || "/icon-192.png",
        data: payload.data
      });
      return true;
    } catch (err) {
      console.error("Gagal mengirim notifikasi lokal:", err);
      return false;
    }
  } else {
    console.warn("Izin notifikasi belum diberikan oleh pengguna.");
    return false;
  }
};

// Architecture placeholder for Push Notification (FCM / Web Push)
export const setupPushNotifications = async (): Promise<string | null> => {
  console.log("Push notification service worker registered.");
  return null;
};
