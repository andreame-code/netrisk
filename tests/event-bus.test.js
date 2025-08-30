import Game from "../src/game.js";
import { REINFORCE } from "../src/phases.js";
// eslint-disable-next-line global-require
const mapMock = require("./fixtures/maps/basic.json");

describe('Event bus', () => {

  test('plugin receives reinforce event', () => {
    const game = new Game(null, mapMock.territories, mapMock.continents, mapMock.deck, false);
    let called = false;
    const plugin = (g) => {
      g.on(REINFORCE, () => {
        called = true;
      });
    };
    game.use(plugin);
    game.handleTerritoryClick('a');
    expect(called).toBe(true);
  });
});
