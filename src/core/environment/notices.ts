/** Aviso real de DONKI que llega por Control de Misión (§3.7). Fechas ISO 8601 en UTC. */
interface NoticeBase {
  id: string;
  issuedAt: string;
  /** Ficha pública del aviso en DONKI. */
  url: string;
  /** Primer párrafo del texto original (inglés): en inglés se muestra adaptado; en español, la plantilla (§8). */
  summary: string;
}

export type SpaceWeatherNotice =
  | (NoticeBase & { kind: 'flare'; params: { classType: string; peakAt: string } })
  | (NoticeBase & { kind: 'sep'; params: { detector: string; startAt: string } })
  | (NoticeBase & { kind: 'cmeMars'; params: { speedKmS: number; marsArrivalAt: string; glancing: boolean } });

/** Avisos emitidos en [from, to), en orden. */
export const noticesBetween = (notices: readonly SpaceWeatherNotice[], from: string, to: string): SpaceWeatherNotice[] =>
  notices.filter((n) => Date.parse(n.issuedAt) >= Date.parse(from) && Date.parse(n.issuedAt) < Date.parse(to));

/** Clave y parámetros del mensaje para niños; las fechas van en ISO y la capa game/ las formatea. */
export function noticeText(notice: SpaceWeatherNotice): { key: string; params: Record<string, string | number> } {
  switch (notice.kind) {
    case 'flare':
      return { key: 'hud.missionControl.notice.flare', params: { classType: notice.params.classType } };
    case 'sep':
      return { key: 'hud.missionControl.notice.sep', params: { detector: notice.params.detector } };
    case 'cmeMars':
      return {
        key: notice.params.glancing ? 'hud.missionControl.notice.cmeMarsGlancing' : 'hud.missionControl.notice.cmeMars',
        params: { speed: notice.params.speedKmS, arrival: notice.params.marsArrivalAt },
      };
  }
}
