# NetRisk Gameplay Flows

These diagrams are derived from the current engine and regression tests in `tests/gameplay`. They describe the server-authoritative flow the UI has to follow.

## Game lifecycle

```mermaid
flowchart LR
    Create["POST /api/games"] --> Lobby["Lobby"]
    Lobby --> JoinHuman["POST /api/join"]
    JoinHuman --> Lobby
    Lobby --> JoinAi["POST /api/ai/join"]
    JoinAi --> Lobby
    Lobby --> OpenLobby["POST /api/games/open"]
    OpenLobby --> Lobby
    Lobby --> Start["POST /api/start"]
    Start --> Active["Active game"]
    Active --> OpenActive["POST /api/games/open"]
    OpenActive --> Active
    Active --> Surrender["type=surrender"]
    Surrender --> VictoryCheck{"Winner detected?"}
    Active --> TurnLoop["Turn loop"]
    TurnLoop --> VictoryCheck
    VictoryCheck -- "No" --> TurnLoop
    VictoryCheck -- "Yes" --> Ended["Ended"]
```

Notes:

- The game remains in `lobby` until a valid start request succeeds.
- `POST /api/games/open` does not mutate the rules flow; it rehydrates a saved snapshot, preserves modular setup metadata already stored in `gameConfig`, and can resume pending AI work before replying.
- Player surrender feeds the same victory detection path used by normal turn resolution.
- Authored victory objectives, when selected, are resolved at game creation and persisted into `gameConfig` so victory checks do not depend on admin lookups during a turn.

## Turn lifecycle

```mermaid
flowchart LR
    Reinforcement["Reinforcement phase"] --> TradeGate{"Mandatory trade required?"}
    TradeGate -- "Yes" --> Trade["POST /api/cards/trade"]
    Trade --> Reinforcement
    TradeGate -- "No" --> Place["type=reinforce"]
    Place --> PoolEmpty{"Pool empty?"}
    PoolEmpty -- "No" --> Reinforcement
    PoolEmpty -- "Yes" --> Attack["Attack phase"]

    Attack --> AttackAction["type=attack or type=attackBanzai"]
    AttackAction --> Conquest{"Territory conquered?"}
    Conquest -- "Yes" --> MoveAfter["type=moveAfterConquest"]
    MoveAfter --> Attack
    Conquest -- "No" --> Attack

    Attack --> EndAttack["type=endTurn"]
    EndAttack --> AttackGate{"Minimum attacks reached?"}
    AttackGate -- "No, legal attacks remain" --> Attack
    AttackGate -- "Yes or none available" --> Fortify["Fortify phase"]

    Fortify --> FortifyAction["type=fortify"]
    FortifyAction --> NextTurn["Next player turn"]
    Fortify --> SkipFortify["type=endTurn"]
    SkipFortify --> FortifyGate{"Required fortify available?"}
    FortifyGate -- "Yes" --> Fortify
    FortifyGate -- "No" --> NextTurn

    NextTurn --> Reinforcement
```

Notes:

- Reinforcements transition to attack only when the pool reaches zero.
- A conquest can force a post-combat movement before more attacks are allowed.
- `endTurn` from attack moves the game into `fortify` before advancing to the next player.
- Optional gameplay effects can require a minimum number of attacks or force a fortify when one is legally available.
- Configured turn timeouts are enforced by scheduled backend jobs and use the same backend-authoritative transition model as explicit player actions.

## Mutation transport and version conflicts

```mermaid
sequenceDiagram
    participant Client
    participant API as Backend API
    participant Stream as SSE listeners

    Client->>API: Mutation with expectedVersion
    alt Version matches
        API-->>Client: 200 { ok, state }
        API-->>Stream: fresh snapshot event
    else Version conflict
        API-->>Client: 409 { code: "VERSION_CONFLICT", currentVersion, state }
        Client->>Client: replace local snapshot
    end
```

Notes:

- The backend owns the authoritative snapshot after every mutation.
- When the client receives a version conflict, the correct recovery path is to replace local state with the returned snapshot and retry only if the action is still valid.
