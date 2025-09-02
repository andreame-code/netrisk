# Layer Import Rules

The project is organized into the following layers using path aliases in `tsconfig.json`:

- `@app`
- `@game`
- `@features`
- `@shared`
- `@infra`

To keep the architecture maintainable, each layer has explicit dependencies enforced by ESLint.

| Layer       | Can import from                           | Can be imported by                     |
| ----------- | ----------------------------------------- | -------------------------------------- |
| `@app`      | `@features`, `@game`, `@shared`, `@infra` | _No other layer_                       |
| `@game`     | `@shared`                                 | `@app`, `@features`                    |
| `@features` | `@game`, `@shared`                        | `@app`                                 |
| `@shared`   | `@shared`                                 | `@app`, `@game`, `@features`, `@infra` |
| `@infra`    | `@shared`                                 | `@app`                                 |

These rules are enforced via `no-restricted-imports` in `.eslintrc.json`. Updating a dependency edge requires adjusting both ESLint configuration and this document.
