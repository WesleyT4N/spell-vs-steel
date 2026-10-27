// Ordered tables of game content by id. Characters and stages register here instead of being listed in the
// engine, so a mod adds one by registering a module. Registration order is part of the game's behavior
// (menu order, seeded random picks, online stage votes), so built-ins register in a fixed order, mods after.

export class Registry<T extends { id: string }> {
  private byId = new Map<string, T>();
  /** Ids in registration order. Always the same array, so callers may keep a reference to it. */
  readonly ids: string[] = [];

  constructor(private kind: string) {}

  register(item: T): T {
    if (this.byId.has(item.id)) throw new Error(`${this.kind} '${item.id}' is already registered`);
    this.byId.set(item.id, item);
    this.ids.push(item.id);
    return item;
  }

  get(id: string): T | undefined { return this.byId.get(id); }
  has(id: string): boolean { return this.byId.has(id); }
  all(): T[] { return this.ids.map(id => this.byId.get(id)!); }
}
