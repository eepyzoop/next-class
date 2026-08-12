export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export const BANNER_EVENT = "nextclass:banner";

export interface BannerDetail {
  title: string;
  body: string;
}

/** Shows a browser Notification if permitted, otherwise falls back to an in-app banner event. */
export function showNotification(title: string, body: string): void {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }
  window.dispatchEvent(new CustomEvent<BannerDetail>(BANNER_EVENT, { detail: { title, body } }));
}
