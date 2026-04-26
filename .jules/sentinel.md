## 2026-04-26 - [Security Header Hardening]
**Vulnerability:** Weak default browser security posture due to missing or overly permissive headers (Referrer-Policy, Permissions-Policy, and restricted CSP).
**Learning:** Even with basic security headers like `X-Frame-Options` and a simple `CSP`, modern browser features like `Permissions-Policy` and refined `CSP` directives (`frame-ancestors`, `font-src`) provide essential defense-in-depth against modern attack vectors like clickjacking and unwanted sensor access.
**Prevention:** Always implement a comprehensive set of security headers, including `Referrer-Policy`, `Permissions-Policy`, and a restricted `Content-Security-Policy` with `frame-ancestors 'none'` for applications not intended for embedding.
