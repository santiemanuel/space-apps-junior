/** Layout del hábitat en coordenadas de tile. Independiente del render. */
export const TILE_SIZE = 32;
export const HABITAT_SIZE = { cols: 30, rows: 18 } as const;

export interface StationLayout {
  id: string;
  label: string;
  col: number;
  row: number;
  color: number;
}

export const STATIONS: readonly StationLayout[] = [
  { id: 'airlock', label: 'Esclusa EVA', col: 26, row: 4, color: 0xff7a59 },
  { id: 'life-support', label: 'Soporte vital', col: 5, row: 4, color: 0x4fd1c5 },
  { id: 'lab', label: 'Invernadero', col: 5, row: 13, color: 0x9f7aea },
  { id: 'storage', label: 'Radio', col: 26, row: 13, color: 0xf6e05e },
];

export const PLAYER_SPAWN = { col: 15, row: 9 } as const;
