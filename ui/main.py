import typer
from net.lobby import create_lobby, join_lobby, list_players

cli = typer.Typer()


@cli.command()
def lobby(lobby_id: str) -> None:
    """Create a lobby."""
    create_lobby(lobby_id)
    typer.echo(f"Lobby {lobby_id} created")


@cli.command()
def join(lobby_id: str, player: str) -> None:
    """Join a lobby."""
    join_lobby(lobby_id, player)
    typer.echo(f"{player} joined {lobby_id}")


@cli.command()
def players(lobby_id: str) -> None:
    """List lobby players."""
    typer.echo(", ".join(list_players(lobby_id)))


if __name__ == "__main__":
    cli()
