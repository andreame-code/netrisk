import Game from "./game.js";

describe('Event bus', () => {
  const mapMock = {
    territories: [
      { id: 'a', neighbors: [], owner: 0, x: 0, y: 0 },
      { id: 'b', neighbors: [], owner: 0, x: 0, y: 0 },
    ],
    continents: [],
    deck: [],
  };

  test('plugin receives reinforce event', () => {
    const game = new Game(null, mapMock.territories, mapMock.continents, mapMock.deck, false);
    let called = false;
    const plugin = (g) => {
      g.on('reinforce', () => {
        called = true;
      });
    };
    game.use(plugin);
    game.handleTerritoryClick('a');
    expect(called).toBe(true);
  });
});
