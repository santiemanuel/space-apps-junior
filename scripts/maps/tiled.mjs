// Lo común de los scripts que arman mapas de Tiled (scripts/maps/build-*.mjs).

/**
 * JSON de un mapa de Tiled con una fila del mapa por línea y un objeto por línea, para que los cambios se lean en
 * git. `cols` es el ancho del mapa en tiles.
 */
export function formatTiledJson(map, cols) {
  const json = JSON.stringify(map, (key, value) => (key === 'data' || (key === 'objects' && Array.isArray(value)) ? { __inline: key, value } : value), 1)
    .replace(/\{\s*"__inline": "data",\s*"value": \[([^\]]*)\]\s*\}/g, (_, body) => {
      const values = body.split(',').map((v) => v.trim());
      const lines = [];
      for (let i = 0; i < values.length; i += cols) lines.push(values.slice(i, i + cols).join(','));
      return `[\n${lines.join(',\n')}\n]`;
    });
  const compact = json.replace(/\{\s*"__inline": "objects",\s*"value": (\[[\s\S]*?\n\s*\])\s*\}/g, (_, body) => {
    const objects = JSON.parse(body);
    return `[\n${objects.map((o) => JSON.stringify(o)).join(',\n')}\n]`;
  });
  JSON.parse(compact);
  return compact + '\n';
}
