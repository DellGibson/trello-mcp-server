# Operator Runbook — Trello MCP Server

For the person maintaining this deployment (currently: George Kendall / DellGibson). Covers the common operational tasks you'll run into after the initial build.

## Quick reference

| What | Where |
|---|---|
| Production URL | `https://trello-titan-todd.vercel.app` |
| MCP endpoint | `/api/mcp` |
| Health check | `/api/health` (no auth) |
| AS metadata | `/.well-known/oauth-authorization-server` |
| GitHub repo | <https://github.com/DellGibson/trello-mcp-server> |
| Vercel project | `trello-titan-todd` under `georgekendall2-4665s-projects` |
| Default branch | `main` (auto-deploys to production on push/merge) |

## Environment variables (Vercel production)

| Var | Purpose | Scope |
|---|---|---|
| `TRELLO_API_KEY` | Customer's Trello Power-Up API key | Production + Preview + Development |
| `TRELLO_TOKEN` | Customer's Trello user token (read,write) | Same |
| `OAUTH_JWT_SECRET` | 64-hex HMAC secret signing all issued JWTs | Same |
| `OAUTH_ISSUER_URL` | Canonical base URL — `https://trello-titan-todd.vercel.app` | Same |

All set via `vercel env add NAME env --value X --yes --force`. Note: preview-scope env additions require the branch name as a positional arg (e.g., `vercel env add FOO preview main --value X --yes`).

## Common operations

### Deploy a code change

Normal flow: open a PR from a feature branch → merge to `main` → Vercel auto-deploys production.

Manual preview deploy (for testing before PR):
```bash
cd /path/to/trello-mcp-server
vercel --yes          # preview deploy, returns a URL
```

Manual production deploy (avoid if possible — prefer git flow):
```bash
vercel --prod --yes   # only if you need to redeploy without a commit
```

### Swap Trello credentials (e.g., token rotation)

When the customer rotates their Trello token or you need to point the server at a different account:

```bash
VERCEL="C:/Users/George/AppData/Roaming/npm/vercel.cmd"   # Windows path
cd /path/to/trello-mcp-server

"$VERCEL" env add TRELLO_API_KEY production --value NEW_KEY --yes --force
"$VERCEL" env add TRELLO_API_KEY development --value NEW_KEY --yes --force
"$VERCEL" env add TRELLO_API_KEY preview main --value NEW_KEY --yes --force

"$VERCEL" env add TRELLO_TOKEN production --value NEW_TOKEN --yes --force
"$VERCEL" env add TRELLO_TOKEN development --value NEW_TOKEN --yes --force
"$VERCEL" env add TRELLO_TOKEN preview main --value NEW_TOKEN --yes --force
```

Then trigger a redeploy so the functions pick up the new values — either push an empty commit to `main` or use Vercel dashboard → Deployments → latest → Redeploy (**uncheck "Use existing Build Cache"** to force fresh env var injection).

### Rotate `OAUTH_JWT_SECRET`

Full kill-switch for all issued tokens. Use when:
- You suspect a token has leaked
- The customer reports suspicious Trello activity you didn't do
- Periodic key rotation (recommended annually)

```bash
NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
"$VERCEL" env add OAUTH_JWT_SECRET production --value "$NEW_SECRET" --yes --force
"$VERCEL" env add OAUTH_JWT_SECRET development --value "$NEW_SECRET" --yes --force
"$VERCEL" env add OAUTH_JWT_SECRET preview main --value "$NEW_SECRET" --yes --force
```

Redeploy. All existing access/refresh tokens become invalid. Customer will go through a one-time OAuth re-auth on their next Claude request — auto-approved, invisible flash.

**Do not rotate this unless you mean to.** It invalidates every connector install.

### Read production logs

```bash
"$VERCEL" logs trello-titan-todd.vercel.app --since 10m
```

OAuth revocation events are logged as:
```json
{"event":"oauth.revoke","kind":"access|refresh|invalid","token_hint":null}
```

Errors from tool calls appear as standard function logs. Nothing sensitive is logged (we strip all token material before write).

### Disable the deployment temporarily

Fastest way to stop all traffic without deleting anything:

```bash
# Vercel dashboard → Settings → Deployment Protection → enable SSO Protection
# OR
# Revoke the customer's Trello token at trello.com/your-account/profile
# (server returns 401s but keeps running)
```

Re-enable by reversing whichever you used.

## Incident playbook

### Symptom: customer reports "Authentication failed" on every Trello call

- Check Trello token hasn't been revoked: <https://trello.com/your-account/profile>
- Check Vercel env `TRELLO_API_KEY` / `TRELLO_TOKEN` haven't been truncated (common if set via CLI stdin — use `--value` flag)
- Fix by re-setting creds (see "Swap Trello credentials" above)

### Symptom: claude.ai says "Couldn't reach the MCP server"

- Check `curl https://trello-titan-todd.vercel.app/api/health` returns 200
- Check `curl https://trello-titan-todd.vercel.app/.well-known/oauth-authorization-server` returns valid JSON
- If either fails, check Vercel dashboard for function errors
- If the WWW-Authenticate header is missing on 401s from `/api/mcp`, check `OAUTH_ISSUER_URL` is set

### Symptom: claude.ai connected but "connector's credentials are invalid"

- OAuth flow completed but token verification failing
- Usually means `OAUTH_JWT_SECRET` changed since the token was issued
- Customer: remove + re-add the connector in Claude

### Symptom: tool count in claude.ai doesn't match what's in production

- Claude.ai caches the tool list at connector install time
- **Disconnect/Reconnect is NOT enough** — it only refreshes OAuth, not the tool catalog
- Customer must **Remove + Add** the connector for a fresh `tools/list` fetch

### Symptom: customer's teammates see actions in Trello from the customer's name

- Not a bug. Claude acts with the customer's Trello identity.
- If they want actions attributed to an AI assistant, that requires a separate Trello account + reworking the deployment to use it

## Developer workflows

### Run locally (stdio mode, for Claude Desktop development)

```bash
git clone https://github.com/DellGibson/trello-mcp-server.git
cd trello-mcp-server
npm ci
npm run build
# Set env vars in your Claude Desktop config (see README.md)
# Restart Claude Desktop
```

### Run locally (HTTP mode, for testing OAuth flow)

Requires `OAUTH_JWT_SECRET` and `OAUTH_ISSUER_URL=http://localhost:3000` in env, plus `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=1` so the SDK lets you use HTTP locally.

Not a common workflow — most development should happen via preview deploys, since Vercel's environment matches production exactly.

### Add a new tool

1. Add the API method to `src/services/trello.ts` (`TrelloClient`)
2. Register the tool in `src/tools/{boards,cards,search}.ts` with `server.registerTool(...)`
3. Build + typecheck + smoke test: `npm run build && npx tsc --noEmit -p tsconfig.api.json && node dist/index.js` (expect env-var error)
4. Open PR, CI runs Node 18 + 20 builds + audit
5. After merge, production auto-deploys
6. **Customer must remove + re-add the connector in Claude for the new tool to appear** — claude.ai caches the tool catalog at install time

### Known CLI quirks (captured during original build)

- **Vercel stdin-based env add traps trailing whitespace** — always use `--value` flag
- **Preview env adds need branch arg when git is connected** — `vercel env add FOO preview <branch> --value X --yes`
- **`vercel env pull` is blocked by our local safety hook** — it writes secrets to a `.env` file
- **Direct-to-main pushes are blocked** — all code changes must go through PR
- **`vercel --prod --yes` is blocked via hook** — prefer git flow or use dashboard "Redeploy"

## Upgrade path

### Extend to multiple customers

The current build is single-tenant (one Trello token, one customer). For multi-tenant:

- Store Trello credentials per-user instead of per-server
- Require each user to do their own Trello OAuth flow (not just our OAuth)
- Index JWT access tokens by user ID, fetch that user's Trello creds at tool-call time
- Recommend migrating to Vercel KV or Upstash Redis for state
- Probably 1–2 days of rebuild work

### Add file attachment uploads

Currently `trello_add_attachment` only accepts URLs. For file uploads:

- Trello's API requires `multipart/form-data` — add body parsing in the attachment handler
- Claude.ai's MCP client may not send binary content through tool calls today — verify this first
- Alternative: take a URL to a hosted file (Google Drive, Dropbox, S3 link), which already works

### Observability / alerting

Currently we log to Vercel's built-in log stream. For proactive alerting:

- Pipe logs to Axiom / Datadog / Sentry
- Alert on: 5xx rates, `oauth.revoke kind=invalid` spikes (possible brute-force), Trello 401 rates (possible creds issue)

## Emergency contacts / references

- Trello API docs: <https://developer.atlassian.com/cloud/trello/rest/>
- MCP spec: <https://modelcontextprotocol.io/>
- MCP OAuth section: <https://modelcontextprotocol.io/specification/basic/authorization>
- Vercel status: <https://www.vercel-status.com/>
- Claude.ai Custom Connectors docs: <https://support.anthropic.com/> (search "Custom Connectors")

## Design decisions worth knowing

Read these before making non-obvious changes:

- **Stateless JWT everything** — no database by choice, keeps Vercel serverless simple. Consequence: can't enforce server-side token revocation (RFC 7009 revoke is "best effort"). Rotate `OAUTH_JWT_SECRET` for enforced invalidation.
- **Auto-approve authorization** — single-user deployment, no consent UI. Security relies on the `ALLOWED_REDIRECT_HOSTS` allowlist in `src/oauth/provider.ts`. If extending to multiple customers, revisit.
- **365-day refresh token TTL** — chosen for non-technical customer UX. Sliding window, so active use never triggers re-auth. See `REFRESH_TOKEN_TTL_SEC` in `src/oauth/provider.ts`.
- **Member emails stripped** — `getBoardMembers` uses an explicit `fields` param that omits email. Intentional PII minimization.
- **Labels/members take names, not IDs** — each tool does an internal lookup. Costs one extra API round-trip per call; saves Claude a turn of tool choreography.
