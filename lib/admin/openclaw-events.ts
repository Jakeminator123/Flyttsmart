export type OpenClawEventLevel = "info" | "warning" | "error";

export interface OpenClawEvent {
  id: string;
  level: OpenClawEventLevel;
  source: string;
  message: string;
  details?: string;
  createdAt: string;
}

const MAX_EVENTS = 200;
const openClawEvents: OpenClawEvent[] = [];

export function addOpenClawEvent(input: {
  level: OpenClawEventLevel;
  source?: string;
  message: string;
  details?: string;
}) {
  const event: OpenClawEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: input.level,
    source: input.source?.trim() || "unknown",
    message: input.message.trim(),
    details: input.details?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  openClawEvents.unshift(event);
  if (openClawEvents.length > MAX_EVENTS) {
    openClawEvents.length = MAX_EVENTS;
  }

  return event;
}

export function listOpenClawEvents(limit = 50) {
  return openClawEvents.slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)));
}
