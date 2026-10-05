// Generic object pool: gameplay never allocates or destroys objects at runtime. Engine-free.

export class Pool<T> {
  private readonly free: T[] = [];
  private created = 0;

  constructor(
    private readonly create: () => T,
    private readonly onRelease?: (item: T) => void,
  ) {}

  /** Creates `count` items up front so the first wave doesn't hitch. */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.free.push(this.create());
      this.created++;
    }
  }

  acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) return item;
    this.created++;
    return this.create();
  }

  /** A free item, or null when none is left — never creates one (cosmetic effects at a peak). */
  tryAcquire(): T | null {
    return this.free.pop() ?? null;
  }

  release(item: T): void {
    this.onRelease?.(item);
    this.free.push(item);
  }

  get freeCount(): number {
    return this.free.length;
  }

  get totalCreated(): number {
    return this.created;
  }
}

/** Removes `list[index]` in O(1) by moving the last element into its slot. */
export function swapRemove<T>(list: T[], index: number): T {
  const item = list[index];
  const last = list.pop() as T;
  if (index < list.length) list[index] = last;
  return item;
}
