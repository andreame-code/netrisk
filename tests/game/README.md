# Game rule tests

This suite covers core game mechanics with Jest:

- **attack** – verifies battle outcomes, losses, and conquest handling.
- **reinforcements** – ensures reinforcement counts update when territories change hands.
- **turn transition** – checks `endTurn` moves play to the next player's reinforce phase.

Run with:

```bash
npm test
```
