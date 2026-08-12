import { buildPushPayload, type PushSubscription as WebPushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

interface Env {
  SUBSCRIPTIONS: KVNamespace;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  ALLOWED_ORIGIN: string;
}

interface ClassEntry {
  id: string;
  courseName: string;
  roomNumber: string;
  dayOfWeek: number; // 1=Sun..7=Sat
  startTime: string; // "HH:mm"
  endTime: string;
}

interface ToDoItem {
  id: string;
  courseName: string;
  type: "quiz" | "assignment" | "homework";
  dueDate: string; // ISO
}

interface NotificationSettings {
  classRemindersEnabled: boolean;
  classReminderLeadMinutes: number;
  taskRemindersEnabled: boolean;
}

interface SubscribeBody {
  subscription: WebPushSubscription;
  classes: ClassEntry[];
  todos: ToDoItem[];
  settings: NotificationSettings;
  timezoneOffsetMinutes: number; // Date.getTimezoneOffset() captured on the client
}

interface StoredRecord extends SubscribeBody {
  notified: string[];
}

const TASK_DUE_SOON_MINUTES = 15;
const MAX_NOTIFIED = 200;

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };

    if (request.method === "POST" && url.pathname === "/subscribe") {
      const body = (await request.json()) as SubscribeBody;
      if (!body.subscription?.endpoint) {
        return new Response(JSON.stringify({ error: "Missing subscription" }), { status: 400, headers: jsonHeaders });
      }
      const key = await keyFor(body.subscription.endpoint);
      const existing = await env.SUBSCRIPTIONS.get(key);
      const notified = existing ? (JSON.parse(existing) as StoredRecord).notified : [];
      const record: StoredRecord = { ...body, notified };
      await env.SUBSCRIPTIONS.put(key, JSON.stringify(record));
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    if (request.method === "POST" && url.pathname === "/unsubscribe") {
      const { endpoint } = (await request.json()) as { endpoint: string };
      if (endpoint) await env.SUBSCRIPTIONS.delete(await keyFor(endpoint));
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    return new Response("Not found", { status: 404, headers });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkAllSubscriptions(env));
  },
};

async function checkAllSubscriptions(env: Env): Promise<void> {
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  let cursor: string | undefined;
  do {
    const list = await env.SUBSCRIPTIONS.list({ cursor });
    for (const entry of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(entry.name);
      if (!raw) continue;
      const record = JSON.parse(raw) as StoredRecord;
      await checkOne(env, vapid, entry.name, record);
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
}

async function checkOne(env: Env, vapid: VapidKeys, key: string, record: StoredRecord): Promise<void> {
  // ponytail: timezone offset is captured once at subscribe time, not re-derived per
  // check — a DST change between subscribing and a reminder firing can skew it by an
  // hour; fine for a personal-scale app, add re-sync-on-open if that ever bites.
  const nowLocal = new Date(Date.now() - record.timezoneOffsetMinutes * 60_000);
  const today = nowLocal.getUTCDay() + 1;
  const nowMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
  const dateStamp = nowLocal.toISOString().slice(0, 10);

  const notified = new Set(record.notified);
  const toSend: { key: string; title: string; body: string }[] = [];

  if (record.settings.classRemindersEnabled) {
    for (const c of record.classes) {
      if (c.dayOfWeek !== today) continue;
      const [h, m] = c.startTime.split(":").map(Number);
      const minutesUntil = h * 60 + m - nowMinutes;
      if (minutesUntil < 0 || minutesUntil > record.settings.classReminderLeadMinutes) continue;
      const notifyKey = `class:${c.id}:${dateStamp}`;
      if (notified.has(notifyKey)) continue;
      notified.add(notifyKey);
      toSend.push({
        key: notifyKey,
        title: "Class Reminder",
        body: `${c.courseName} starts in ${minutesUntil} min · ${c.roomNumber}`,
      });
    }
  }

  if (record.settings.taskRemindersEnabled) {
    for (const t of record.todos) {
      const dueLocal = new Date(new Date(t.dueDate).getTime() - record.timezoneOffsetMinutes * 60_000);
      if (dueLocal.toISOString().slice(0, 10) !== dateStamp) continue;
      const minutesUntil = dueLocal.getUTCHours() * 60 + dueLocal.getUTCMinutes() - nowMinutes;
      if (minutesUntil < 0 || minutesUntil > TASK_DUE_SOON_MINUTES) continue;
      const notifyKey = `todo:${t.id}`;
      if (notified.has(notifyKey)) continue;
      notified.add(notifyKey);
      const typeLabel = t.type[0].toUpperCase() + t.type.slice(1);
      toSend.push({ key: notifyKey, title: `${typeLabel} Due`, body: t.courseName });
    }
  }

  if (toSend.length === 0) return;

  let gone = false;
  for (const item of toSend) {
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify({ title: item.title, body: item.body }) },
        record.subscription,
        vapid
      );
      const res = await fetch(record.subscription.endpoint, payload as RequestInit);
      if (res.status === 404 || res.status === 410) gone = true;
    } catch {
      // best-effort; one failed send shouldn't block the rest
    }
  }

  if (gone) {
    await env.SUBSCRIPTIONS.delete(key);
    return;
  }

  const prunedNotified = [...notified].slice(-MAX_NOTIFIED);
  await env.SUBSCRIPTIONS.put(key, JSON.stringify({ ...record, notified: prunedNotified }));
}
