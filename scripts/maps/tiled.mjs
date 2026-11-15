// Lo común de los scripts que arman mapas de Tiled (scripts/maps/build-*.mjs).

/**
 * JSON de un mapa de Tiled con una fila del mapa por línea y un objeto por línea, para que los cambios se lean en
 * git. `cols` es el ancho del mapa en tiles.
 */
export function formatTiledJson(map, cols) {
  // Las listas de objetos se reemplazan por una marca y después se escriben con un objeto por línea (los objetos
  // pueden tener listas adentro, como los puntos de un polígono).
  const objectLists = [];
  const marked = (key, value) => {
    if (key === 'data') return { __inline: key, value };
    if (key === 'objects' && Array.isArray(value)) return `__objects_${objectLists.push(value) - 1}__`;
    return value;
  };
  const json = JSON.stringify(map, marked, 1)
    .replace(/\{\s*"__inline": "data",\s*"value": \[([^\]]*)\]\s*\}/g, (_, body) => {
      const values = body.split(',').map((v) => v.trim());
      const lines = [];
      for (let i = 0; i < values.length; i += cols) lines.push(values.slice(i, i + cols).join(','));
      return `[\n${lines.join(',\n')}\n]`;
    });
  const compact = json.replace(/"__objects_(\d+)__"/g, (_, i) => `[\n${objectLists[Number(i)].map((o) => JSON.stringify(o)).join(',\n')}\n]`);
  JSON.parse(compact);
  return compact + '\n';
}
