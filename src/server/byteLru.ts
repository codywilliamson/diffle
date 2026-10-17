// a map that evicts its least recently used entries once the bytes it retains pass a cap.

export class ByteLru<V> {
  private readonly entries = new Map<string, { value: V; bytes: number }>();
  private retained = 0;

  constructor(private readonly capBytes: number) {}

  get retainedBytes(): number { return this.retained; }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key); // re-insert: iteration order is least recently used first
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, bytes: number): void {
    const old = this.entries.get(key);
    if (old) this.retained -= old.bytes;
    this.entries.delete(key);
    if (bytes > this.capBytes) return; // never retainable; the caller still has the value
    this.entries.set(key, { value, bytes });
    this.retained += bytes;
    for (const [oldest, entry] of this.entries) {
      if (this.retained <= this.capBytes) break;
      this.entries.delete(oldest);
      this.retained -= entry.bytes;
    }
  }
}
