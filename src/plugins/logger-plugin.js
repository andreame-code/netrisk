import { REINFORCE } from "../../phases.js";

export default function loggerPlugin(game, logger = console) {
  game.on(REINFORCE, ({ territory, player }) => {
    logger.log(`Player ${player} reinforces ${territory}`);
  });
  game.on('attackResolved', ({ from, to, result }) => {
    logger.log(`Attack from ${from} to ${to}`, result);
  });
  game.on('phaseChange', ({ phase, player }) => {
    logger.log(`Player ${player} enters phase ${phase}`);
  });
}
