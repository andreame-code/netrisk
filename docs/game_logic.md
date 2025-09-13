# Game Logic

Game state is immutable and represented by `GameState`. Pure functions mutate
state by returning new instances, ensuring deterministic behavior suitable for
multiplayer synchronization.
