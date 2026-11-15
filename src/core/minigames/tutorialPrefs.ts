import type { SaveStore } from '../save/SaveStore';
import type { MinigameId } from './Minigame';

const KEY = 'misionMarte.tutorialesOcultos';

/** Minijuegos cuyo tutorial no se vuelve a mostrar (casilla «No volver a mostrar»), guardados aparte de la partida. */
export class TutorialPrefs {
  private readonly ids: Set<string>;

  constructor(private readonly store: SaveStore) {
    let saved: unknown = [];
    try {
      saved = JSON.parse(store.read(KEY) ?? '[]');
    } catch {
      saved = [];
    }
    this.ids = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
  }

  hidden(id: MinigameId): boolean {
    return this.ids.has(id);
  }

  setHidden(id: MinigameId, hidden: boolean): void {
    if (hidden === this.ids.has(id)) return;
    if (hidden) this.ids.add(id);
    else this.ids.delete(id);
    this.store.write(KEY, JSON.stringify([...this.ids]));
  }
}
