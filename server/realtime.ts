import type { Response } from "express";
import type { RealtimeEvent } from "../shared/realtime";

type Subscriber = { response: Response; keepAlive: NodeJS.Timeout };
const subscribers = new Map<number, Set<Subscriber>>();

function writeEvent(response: Response, event: RealtimeEvent) {
  response.write(`event: ${event.eventType}\nid: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function subscribeRealtime(ownerId: number, response: Response) {
  const current = subscribers.get(ownerId) ?? new Set<Subscriber>();
  const subscriber = {
    response,
    keepAlive: setInterval(() => response.write(": keep-alive\n\n"), 20_000),
  };
  current.add(subscriber);
  subscribers.set(ownerId, current);
  return () => {
    clearInterval(subscriber.keepAlive);
    current.delete(subscriber);
    if (!current.size) subscribers.delete(ownerId);
  };
}

export function publishRealtimeEvent(ownerId: number, event: RealtimeEvent) {
  const current = subscribers.get(ownerId);
  if (!current) return;
  for (const subscriber of Array.from(current)) {
    try { writeEvent(subscriber.response, event); } catch { /* closed response is cleaned by close handler */ }
  }
}
