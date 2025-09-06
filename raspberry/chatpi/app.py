import os
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    def load_dotenv() -> None:
        pass

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

from ui import UI


def load_system_prompt() -> str:
    root = Path(__file__).resolve().parents[2]
    path = root / "common" / "prompts" / "system_it.txt"
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "Sei ChatPi, un assistente vocale."


def chat(client: Any, system_prompt: str, user_text: str) -> str:
    if client:
        try:
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ],
            )
            return resp.choices[0].message.content.strip()
        except Exception as exc:  # pragma: no cover
            return f"(errore API) {exc}"
    return "(simulazione) Ciao!"


def main() -> None:
    load_dotenv()
    system_prompt = load_system_prompt()
    ui = UI()
    sim_mode = os.getenv("SIMULATION")

    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key) if api_key and OpenAI else None

    ui.set_state("idle")

    if sim_mode == "keyboard":
        while True:
            ui.set_state("listening")
            try:
                user_text = input(">> ")
            except EOFError:
                break
            if user_text.strip().lower() in {"stop", "esci", "spegni"}:
                break
            ui.set_state("thinking")
            reply = chat(client, system_prompt, user_text)
            ui.set_state("speaking")
            print(f"[TTS] {reply}")
            ui.set_state("idle")


if __name__ == "__main__":
    main()
