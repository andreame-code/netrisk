# Issue 4: Potential Cross-Site Scripting (XSS) (Needs Targeted Review)

- **Component**: `frontend/src/core/dom.mts` (`setMarkup`), `frontend/src/lobby.mts`, `frontend/src/app.mts`
- **Description**: The frontend frequently uses `innerHTML` (wrapped in `setMarkup`) to render UI components. While some dynamic values (like game names) are manually escaped before rendering, the pervasive use of `innerHTML` across the application increases the attack surface.
- **Status**: Potential risk / Defense-in-depth gap. No concrete unsafe sink or proven exploit was identified during this initial audit.
- **Impact**: If a data source is missed by the manual escaping logic, an attacker could potentially inject malicious scripts.
- **Recommendation**: Perform a targeted security review of all `setMarkup` calls. Long-term, prefer using `textContent` or safe DOM APIs for dynamic content, or implement a robust sanitization library for HTML fragments.
