import type { ClassEntry, NotificationSettings, ToDoItem } from "../types";
import { ensureNotificationPermission } from "./notifications";

// Public VAPID key — safe to ship in client code, it only identifies the sender.
const VAPID_PUBLIC_KEY = "BP4fLFOuSes2ifypR-5K3UwBUa0Dn84-uG7pvId6odLFZNqAUT6gweD_qDx8ughPswsZz2kKpsPY69LD9pHdzrI";

const PUSH_API_URL = "https://nextclass-push.izmaqamar55.workers.dev";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

interface SyncData {
  classes: ClassEntry[];
  todos: ToDoItem[];
  settings: NotificationSettings;
}

async function postSubscription(subscription: PushSubscription, data: SyncData): Promise<void> {
  await fetch(`${PUSH_API_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      classes: data.classes,
      todos: data.todos,
      settings: data.settings,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    }),
  });
}

export async function subscribeToPush(data: SyncData): Promise<boolean> {
  if (!isPushSupported()) return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });
  // Subscription succeeds locally even if this POST fails (e.g. backend briefly down);
  // usePushSync retries on every data change, so it self-heals rather than leaving the
  // toggle in an inconsistent state.
  await postSubscription(subscription, data).catch((err) => console.warn("Push sync failed, will retry", err));
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await fetch(`${PUSH_API_URL}/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}

/** Keeps the backend's copy of this device's schedule in sync while a push subscription is active. */
export async function resyncPushSubscription(data: SyncData): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await postSubscription(subscription, data).catch(() => {});
}
