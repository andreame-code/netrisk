from data.storage import save_state, load_state


def test_save_and_load(tmp_path) -> None:
    path = tmp_path / "state.json"
    state = {"a": 1}
    save_state(path, state)
    assert load_state(path) == state
