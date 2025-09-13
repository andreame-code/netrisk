from net.lobby import create_lobby, join_lobby, list_players


def test_create_and_join_lobby() -> None:
    lobby_id = "abc"
    create_lobby(lobby_id)
    join_lobby(lobby_id, "alice")
    join_lobby(lobby_id, "bob")
    assert list_players(lobby_id) == ["alice", "bob"]
