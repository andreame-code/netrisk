# AGENTS.md

## Style and Conventions

- Python modules and packages use `snake_case` file names.
- Format with `black` and lint with `ruff`.

## Required Checks

Run the following commands before committing:

```bash
ruff check .
black --check .
pytest
```
