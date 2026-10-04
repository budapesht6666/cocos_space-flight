// Typed publish/subscribe used for system-to-system communication. Engine-free.
// `emit` does not allocate: handlers are stored in plain arrays and called in order.

export type Handler<P> = (payload: P) => void;

export class EventBus<Events extends { [K in keyof Events]: unknown }> {
  private readonly handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const list = (this.handlers[type] ??= []);
    list.push(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    const list = this.handlers[type];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.handlers[type];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }

  clear(): void {
    for (const key of Object.keys(this.handlers) as (keyof Events)[]) delete this.handlers[key];
  }
}
