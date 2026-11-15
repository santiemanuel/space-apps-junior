/**
 * Almacenamiento de texto por clave (plan F8). En el navegador lo implementa `localStorage`
 * (`src/game/storage/`); en los tests, `MemorySaveStore`.
 */
export interface SaveStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemorySaveStore implements SaveStore {
  private readonly data = new Map<string, string>();

  read(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}
