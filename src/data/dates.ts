export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);
export const parseDate = (iso: string): Date => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
