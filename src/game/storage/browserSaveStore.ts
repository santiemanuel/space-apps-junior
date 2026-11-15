import { MemorySaveStore, type SaveStore } from '../../core/save/SaveStore';

/** `localStorage` del navegador; si no está disponible (modo privado, bloqueado), guarda sólo en memoria. */
export function createBrowserSaveStore(): SaveStore {
  try {
    const storage = window.localStorage;
    const probe = 'misionMarte.prueba';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return {
      read: (key) => storage.getItem(key),
      write: (key, value) => {
        try {
          storage.setItem(key, value);
        } catch (error) {
          console.warn('[guardado] no se pudo guardar en el navegador:', error);
        }
      },
      remove: (key) => storage.removeItem(key),
    };
  } catch {
    console.warn('[guardado] localStorage no disponible: el progreso dura hasta cerrar la pestaña');
    return new MemorySaveStore();
  }
}
