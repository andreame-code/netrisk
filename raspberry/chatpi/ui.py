import os


class UI:
    def __init__(self) -> None:
        self.headless = os.getenv("HEADLESS") == "1"

    def set_state(self, state: str) -> None:
        if self.headless:
            print(f"[UI] {state}")
        else:
            # GUI placeholder
            pass
