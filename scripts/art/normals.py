"""Normal maps de los recursos del juego con el generador de Sprite Fusion (en Docker, sin red).

El generador trabaja a la resolución nativa del pixel art: cada recurso (ampliado ×2) se reduce a sus píxeles de
arte, se genera el mapa y se vuelve a ampliar ×2 con vecino más cercano. El resultado queda junto al recurso como
`<nombre>_n.png`, que es el nombre que espera Phaser en `load.image(key, [url, normalUrl])` y `load.atlas`.

Uso: python scripts/art/normals.py [recurso ...]   (sin argumentos: todos los de RECURSOS)
Requiere la imagen `sprite-normals:local` (docker build -t sprite-normals:local scripts/art/normals).
"""
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image

SCALE = 2
# Recurso → opciones del generador. `--frame-size` (en píxeles de arte) separa las celdas de las hojas en grilla:
# así el relieve de un tile o un cuadro no se mezcla con el del vecino.
RECURSOS = {
    'public/assets/ship/tiles.png': ['--frame-size', '24x24', '--shape-strength', '0', '--detail-strength', '2', '--normal-strength', '1'],
    'public/assets/ship/props.png': ['--shape-radius', '6'],
    'public/assets/crew/vega.png': ['--frame-size', '40x48'],
    'public/assets/crew/miga.png': ['--frame-size', '40x48'],
    'public/assets/crew/brote.png': ['--frame-size', '40x48'],
    'public/assets/crew/senda.png': ['--frame-size', '40x48'],
}


def normal_map(asset: Path, options: list[str]) -> Path:
    im = Image.open(asset).convert('RGBA')
    art = im.resize((im.width // SCALE, im.height // SCALE), Image.NEAREST)
    with tempfile.TemporaryDirectory(dir='art/raw') as tmp:
        work = Path(tmp).resolve()
        art.save(work / 'in.png')
        subprocess.run(['docker', 'run', '--rm', '--network', 'none', '-v', f'{work}:/work', 'sprite-normals:local', 'in.png', '-o', 'in_n.png', *options],
                       check=True, capture_output=True)
        normal = Image.open(work / 'in_n.png').convert('RGBA')
    out = asset.with_name(f'{asset.stem}_n.png')
    normal.resize((normal.width * SCALE, normal.height * SCALE), Image.NEAREST).save(out)
    return out


if __name__ == '__main__':
    targets = sys.argv[1:] or list(RECURSOS)
    for target in targets:
        out = normal_map(Path(target), RECURSOS.get(target, []))
        print(f'{target} -> {out}')
