// A tiny typed event bus. Physics reports contacts, entities report events,
// and the Director listens.

type Handler<T> = (payload: T) => void;

export class Bus<Events extends Record<string, any>> {
  private handlers = new Map<keyof Events, Set<Handler<any>>>();
  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(fn);
    return () => this.handlers.get(name)!.delete(fn);
  }
  emit<K extends keyof Events>(name: K, payload: Events[K]) {
    const set = this.handlers.get(name);
    if (set) for (const fn of [...set]) fn(payload);
  }
}
