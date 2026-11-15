import { describe, expect, it } from 'vitest';
import { BoardGame, CountdownGame, createFlightGame, FuelGame, NO_FLIGHT_INPUT, PressureGame, RadioGame, SteerGame, type Arrow, type FlightInput } from './flightGames';

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

    it('la cuenta larga pasa rápido hasta T-10 y después va a ritmo de juego', () => {
      const game = new CountdownGame(1, 1, 60);
      expect(game.count).toBe(60);
      expect(game.final).toBe(false);
      run(game, 50 * CountdownGame.FAST_TICK_SECONDS + 0.01);
      expect(game.count).toBe(10);
      expect(game.zeroAt).toBeCloseTo(50 * CountdownGame.FAST_TICK_SECONDS + 10 * CountdownGame.TICK_SECONDS);
    });

    it('apretar antes de T-10 no cuenta como apuro', () => {
      const game = new CountdownGame(1, 1, 60);
      run(game, 1);
      game.update(1 / 60, press);
      expect(game.mistakes).toBe(0);
      run(game, game.zeroAt - game.elapsed - 1 / 120);
      game.update(1 / 60, press);
      expect(game.done).toBe(true);
      expect(game.score).toBe(1);
    });
  });

  describe('presurizar la cabina', () => {
    it('mantener la presión en la franja da puntaje perfecto', () => {
      const game = new PressureGame(4);
      for (let i = 0; i < 1000 && !game.done; i++) game.update(1 / 60, hold(game.pressure < game.target.center));
      expect(game.done).toBe(true);
      expect(game.score).toBeGreaterThan(0.85);
      expect(game.message).toMatchObject({ good: true });
    });

    it('sin bombear la presión no sube y el puntaje es bajo', () => {
      const game = new PressureGame(4);
      run(game, 10);
      expect(game.done).toBe(true);
      expect(game.pressure).toBe(0);
      expect(game.score).toBe(0);
    });

    it('con sistemas en amarillo la franja es más angosta', () => {
      expect(new PressureGame(4, 0.6).target.width).toBeLessThan(new PressureGame(4).target.width);
    });
  });

  describe('prueba de radio', () => {
    /** Espera a que termine de mostrar la secuencia. */
    const listen = (game: RadioGame) => {
      for (let i = 0; i < 600 && game.phase === 'show'; i++) game.update(1 / 60, NO_FLIGHT_INPUT);
    };

    it('muestra la secuencia luz por luz y después espera la respuesta', () => {
      const game = new RadioGame(2);
      expect(game.showing).toBe(game.sequence[0]);
      game.update(1 / 60, arrow('up'));
      expect(game.mistakes).toBe(0);
      listen(game);
      expect(game.phase).toBe('input');
      expect(game.showing).toBeNull();
    });

    it('repetirla bien da puntaje perfecto', () => {
      const game = new RadioGame(2);
      listen(game);
      for (const a of game.sequence) game.update(1 / 60, arrow(a));
      expect(game.done).toBe(true);
      expect(game.score).toBe(1);
    });

    it('un error la vuelve a mostrar y al tercero termina con poca señal', () => {
      const game = new RadioGame(2);
      const wrong = (a: Arrow): Arrow => (a === 'up' ? 'down' : 'up');
      for (let i = 0; i < 3; i++) {
        listen(game);
        game.update(1 / 60, arrow(wrong(game.sequence[0]!)));
        if (i < 2) expect(game.phase).toBe('show');
      }
      expect(game.done).toBe(true);
      expect(game.message?.key).toBe('static');
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
    const kinds = ['fuel', 'board', 'pressure', 'radio', 'countdown', 'steer'] as const;
    expect(kinds.map((kind) => createFlightGame(kind, 1).kind)).toEqual([...kinds]);
    expect((createFlightGame('countdown', 1, 1, { from: 30 }) as CountdownGame).count).toBe(30);
  });
});
