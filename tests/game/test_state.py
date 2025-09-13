from game.state import GameState, move


def test_move_creates_new_state() -> None:
    initial = GameState({"a": "alice"})
    updated = move(initial, "a", "b", "alice")
    assert initial.territories == {"a": "alice"}
    assert updated.territories == {"b": "alice"}
    assert initial is not updated
