import { describe, expect, it } from 'vitest';
import { BoardGame, CountdownGame, createFlightGame, FuelGame, NO_FLIGHT_INPUT, SteerGame, type Arrow, type FlightInput } from './flightGames';

const hold = (action = true, left = false, right = false): FlightInput => ({ held: { action, left, right }, pressed: { action: false, arrow: null } });
const press: FlightInput = { held: { action: true, left: false, right: false }, pressed: { action: true, arrow: null } };
const arrow = (a: Arrow): FlightInput => ({ ...NO_FLIGHT_INPUT, pressed: { action: false, arrow: a } });

/** Avanza `seconds` en pasos de 1/60 s con la misma entrada. */
function run(game: { update(dt: number, input: FlightInput): void; done: boolean }, seconds: number, input: FlightInput = NO_FLIGHT_INPUT) {
  for (let t = 0; t < seconds && !game.done; t += 1 / 60) game.update(1 / 60, input);
}

describe('minijuegos de vuelo', () => {
  describe('cargar combustible', () => {
    it('soltar en el centro de la franja da puntaje perfecto', () => {
      const game = new FuelGame(1);
      run(game, game.target.center / FuelGame.FILL_PER_SECOND - 1 / 120, hold());
      game.update(1 / 60, hold(false));
      expect(game.done).toBe(true);
      expect(game.score).toBeGreaterThan(0.9);
      expect(game.message).toMatchObject({ good: true });
    });

    it('soltar muy temprano o dejarlo rebalsar puntúa bajo', () => {
      const short = new FuelGame(1);
      run(short, 0.5, hold());
      short.update(1 / 60, hold(false));
      expect(short.score).toBeLessThan(0.5);
      const over = new FuelGame(1);
      run(over, 10, hold());
      expect(over.done).toBe(true);
      expect(over.message?.key).toBe('overflow');
    });

    it('no empieza hasta que se aprieta', () => {
      const game = new FuelGame(1);
      run(game, 2);
      expect(game.done).toBe(false);
      expect(game.level).toBe(0);
    });

    it('con sistemas en amarillo la franja es más angosta', () => {
      expect(new FuelGame(1, 0.6).target.width).toBeLessThan(new FuelGame(1).target.width);
    });
  });

  describe('abordaje', () => {
    it('la secuencia sin errores y rápida da puntaje perfecto', () => {
      const game = new BoardGame(3);
      for (const a of game.sequence) game.update(0.3, arrow(a));
      expect(game.done).toBe(true);
      expect(game.score).toBe(1);
    });

    it('cada error baja el puntaje, pero siempre se termina', () => {
      const game = new BoardGame(3);
      const wrong = (a: Arrow): Arrow => (a === 'up' ? 'down' : 'up');
      for (const a of game.sequence) {
        game.update(0.3, arrow(wrong(a)));
        game.update(0.3, arrow(a));
      }
      expect(game.done).toBe(true);
      expect(game.mistakes).toBe(game.sequence.length);
      expect(game.score).toBeLessThan(0.5);
    });

    it('con sistemas en amarillo la secuencia es más larga', () => {
      expect(new BoardGame(3, 0.6).sequence.length).toBeGreaterThan(new BoardGame(3).sequence.length);
    });
  });

  describe('cuenta regresiva', () => {
    it('cuenta de 10 a 0', () => {
      const game = new CountdownGame(1);
      expect(game.count).toBe(10);
      run(game, CountdownGame.TICK_SECONDS * 3 + 0.01);
      expect(game.count).toBe(7);
    });

    it('apretar justo en el cero es la ignición perfecta', () => {
      const game = new CountdownGame(1);
      run(game, game.zeroAt - 1 / 120);
      game.update(1 / 60, press);
      expect(game.done).toBe(true);
      expect(game.score).toBe(1);
    });

    it('apurarse cuesta y no enciende antes de tiempo', () => {
      const game = new CountdownGame(1);
      run(game, 2);
      game.update(1 / 60, press);
      expect(game.done).toBe(false);
      expect(game.message?.key).toBe('early');
      run(game, game.zeroAt - game.elapsed - 1 / 120);
      game.update(1 / 60, press);
      expect(game.score).toBeCloseTo(0.8);
    });

    it('si nadie aprieta, los motores encienden solos un poco tarde', () => {
      const game = new CountdownGame(1);
      run(game, 20);
      expect(game.done).toBe(true);
      expect(game.message?.key).toBe('late');
      expect(game.score).toBeCloseTo(0.3);
    });
  });

  describe('pilotaje', () => {
    it('corregir hacia el centro mantiene la aguja en la zona', () => {
      const game = new SteerGame(5);
      for (let i = 0; i < 1000 && !game.done; i++) {
        const input = hold(false, game.position > 0.05, game.position < -0.05);
        game.update(1 / 60, input);
      }
      expect(game.done).toBe(true);
      expect(game.score).toBeGreaterThan(0.9);
    });

    it('sin corregir la nave se desvía y el puntaje baja', () => {
      const scores = [1, 2, 3, 4, 5].map((seed) => {
        const game = new SteerGame(seed);
        run(game, 10);
        return game.score;
      });
      expect(Math.min(...scores)).toBeLessThan(0.9);
    });

    it('dura lo mismo siempre', () => {
      const game = new SteerGame(5);
      run(game, SteerGame.DURATION_SECONDS - 0.1);
      expect(game.done).toBe(false);
      run(game, 0.2);
      expect(game.done).toBe(true);
    });
  });

  it('crea el minijuego de cada tipo', () => {
    expect(['fuel', 'board', 'countdown', 'steer'].map((kind) => createFlightGame(kind as 'fuel', 1).kind)).toEqual(['fuel', 'board', 'countdown', 'steer']);
  });
});
