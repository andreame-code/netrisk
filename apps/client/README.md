## netrisk client

This package hosts the Next.js 15 client. It consumes the shared `@netrisk/core` workspace and communicates with the NestJS
server via Socket.IO.

### Scripts

```bash
pnpm dev       # Start the Next.js dev server on http://localhost:3000
pnpm build     # Generate production build output in .next/
pnpm lint      # Run Next.js/TypeScript lint rules
pnpm test      # Execute Jest unit tests
pnpm test:e2e  # Execute Playwright end-to-end tests
```

### Required binary assets

Add the following files to `apps/client/public` in your local checkout. They are excluded from version control to avoid
tracking binary blobs:

- `favicon.ico` – 32×32 (or higher) favicon used by browsers.
- `icon-192.png` – Manifest icon for PWA installs.
- `icon-512.png` – High-resolution manifest icon for splash screens.
- `og-image.png` – Social media preview shared via Open Graph tags.

If you change the filenames, update the relevant references in `next.config.ts` or any metadata configuration so the assets
are served correctly.
