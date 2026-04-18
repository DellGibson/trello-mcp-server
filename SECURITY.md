# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not** open a public GitHub issue. Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/DellGibson/trello-mcp-server/security) of this repository
2. Click **Report a vulnerability**
3. Provide a description, reproduction steps, and the version/commit affected

I'll acknowledge receipt within a few days and work with you on a fix and coordinated disclosure.

## Scope

This MCP server handles Trello API credentials (API key + token) on behalf of the user. Reports are especially welcome for:

- Credential leakage (logs, error messages, structured responses, `.env` handling)
- Input validation gaps in MCP tool schemas
- Unintended network calls (anything beyond `api.trello.com`)
- Dependency vulnerabilities that materially affect this server

## Out of Scope

- Vulnerabilities in Trello's API itself — please report those directly to Atlassian
- Claude Desktop vulnerabilities — report to Anthropic
- Issues requiring local code execution on the user's machine (the threat model assumes the user trusts their own workstation)

## Supported Versions

Only the latest `main` branch receives security updates. This is a small, personal project — pin to a specific commit if you need stability guarantees.
