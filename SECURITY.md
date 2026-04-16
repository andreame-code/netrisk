# Security Policy

## Supported Versions

NetRisk is currently in an early pre-1.0 stage. Security fixes are applied only to the latest maintained line and are not backported to older snapshots or historical commits.

| Version                       | Supported |
| ----------------------------- | --------- |
| `0.1.x`                       | Yes       |
| `< 0.1.0` and older snapshots | No        |

In practice, the `main` branch and the latest release derived from it are the only supported targets for security fixes.

## Reporting a Vulnerability

If you discover a security issue, please do **not** open a public GitHub issue, discussion, or pull request with exploit details.

Preferred channel:

1. Use GitHub private vulnerability reporting for this repository, if the "Report a vulnerability" option is available.
2. If that option is not available, contact the repository maintainer privately through GitHub before sharing any technical details publicly.

Please include, when possible:

- a short description of the issue
- affected area or file path
- reproduction steps
- impact assessment
- proof of concept only when strictly needed to validate the report
- any suggested mitigation or patch direction

## What to Expect

The maintainer aims to follow this process:

1. Initial acknowledgment within 5 business days.
2. Triage and severity assessment as quickly as possible.
3. A mitigation or fix plan when the report is confirmed.
4. Public disclosure only after a fix or mitigation is available, or after coordinated agreement with the reporter.

Response times may vary for hobby or low-activity periods, but valid reports will be reviewed as a priority.

## Scope

Please report issues such as:

- authentication or authorization bypass
- privilege escalation between players, lobbies, or game sessions
- exposure of secrets, session data, backups, or private user information
- server-side injection, remote code execution, or arbitrary file access
- vulnerabilities that let a client bypass backend validation or corrupt authoritative game state

The following usually do **not** qualify as security reports by themselves:

- gameplay balance issues
- purely visual or UI bugs
- missing hardening in local-only development setups
- reports without a plausible security impact

## Safe Harbor

Good-faith security research aimed at responsibly disclosing vulnerabilities in NetRisk will be treated as authorized, provided that you:

- avoid privacy violations, data destruction, and service disruption
- do not access, modify, or retain other users' data beyond what is strictly necessary for validation
- give the maintainer reasonable time to investigate and remediate before public disclosure

Thank you for helping keep NetRisk safer to build and operate.
