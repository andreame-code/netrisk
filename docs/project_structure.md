# Project Structure

```
netrisk/
├── data/        # browser persistence (localStorage)
├── game/        # deterministic game logic
├── net/         # Supabase networking helpers
├── ui/          # browser UI utilities
├── tests/       # mirrors module layout
├── docs/        # guides and references
├── index.html   # entry point served via GitHub Pages
└── package.json
```

## Hosting

- Frontend runs on GitHub Pages.
- Multiplayer data lives in Supabase tables.
