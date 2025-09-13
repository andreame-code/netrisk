from typer.testing import CliRunner
from ui.main import cli


def test_lobby_commands() -> None:
    runner = CliRunner()
    result = runner.invoke(cli, ["lobby", "abc"])
    assert result.exit_code == 0
    result = runner.invoke(cli, ["join", "abc", "alice"])
    assert result.exit_code == 0
    result = runner.invoke(cli, ["players", "abc"])
    assert "alice" in result.stdout
