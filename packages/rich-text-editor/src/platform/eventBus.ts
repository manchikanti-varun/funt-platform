import type { EditorEventMap, EventBus, EventName } from "./contracts.js";

type Listener<K extends EventName> = (payload: EditorEventMap[K]) => void;

export class InMemoryEventBus implements EventBus {
  private listeners = new Map<EventName, Set<Listener<EventName>>>();

  emit<K extends EventName>(event: K, payload: EditorEventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    listeners.forEach((listener) => {
      (listener as Listener<K>)(payload);
    });
  }

  on<K extends EventName>(event: K, listener: Listener<K>): () => void {
    const existing = this.listeners.get(event);
    if (existing) {
      existing.add(listener as Listener<EventName>);
    } else {
      this.listeners.set(event, new Set([listener as Listener<EventName>]));
    }
    return () => {
      const current = this.listeners.get(event);
      if (!current) return;
      current.delete(listener as Listener<EventName>);
      if (current.size === 0) {
        this.listeners.delete(event);
      }
    };
  }
}
