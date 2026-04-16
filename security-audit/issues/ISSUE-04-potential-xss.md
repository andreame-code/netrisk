# Issue 4: Potential Cross-Site Scripting (XSS): Unsafe HTML Rendering

- **Component**: `frontend/src/core/dom.mts` (`setMarkup`), `frontend/src/lobby.mts`, `frontend/src/app.mts`
- **Description**: The frontend frequently uses `innerHTML` (wrapped in `setMarkup`) to render UI components. While some data like game names are escaped, the pervasive use of `innerHTML` increases the risk of XSS if any data source is missed or improperly sanitized.
- **Impact**: An attacker could potentially inject malicious scripts into the application, leading to session theft or other malicious actions on behalf of the user.
- **Recommendation**: Prefer using `textContent` or DOM APIs (like `createElement`) for dynamic content. If HTML must be rendered, use a robust sanitization library.
