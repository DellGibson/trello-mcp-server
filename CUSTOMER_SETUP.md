# Setup Guide — Trello for Claude

This connector lets Claude read and update your Trello boards from any device where you're signed into Claude — web, iPhone, Android, and the Claude Desktop app.

## What it does

Ask Claude questions like:

- *"What's on my Marketing board today?"*
- *"Create a card called 'Review Q3 photos' in my To-Do list"*
- *"Assign Sarah to the launch card and add the 'priority' label"*
- *"Copy my Sprint Template card into Sprint 42"*
- *"Archive all the old 2024 project cards"*

Claude will use your Trello workspace directly — same permissions as when you sign into Trello yourself.

## What you'll need

1. A Claude account (Pro, Max, Team, or Enterprise)
2. A few minutes

## One-time setup (~2 minutes)

### 1. Open the Connectors page in Claude

- **Web:** <https://claude.ai/customize/connectors>
- **Desktop app:** open Settings → Connectors
- Click **"Add custom connector"**

### 2. Fill in the form

| Field | Value |
|---|---|
| Name | `Trello` (or whatever you prefer) |
| URL | `https://trello-titan-todd.vercel.app/api/mcp` |
| OAuth Client ID | **leave blank** |
| OAuth Client Secret | **leave blank** |

Click **Add**.

### 3. Authorize

Claude will open a one-screen authorization prompt. Click **Approve**. You'll be redirected back, and the connector will show as **Connected**.

That's it. The connector now works across every device you're signed into Claude on.

## Try it

Start a new chat. Try:

> *"List my Trello boards"*

Claude will return your actual boards.

> *"What cards are due today?"*

Claude searches across everything you have access to.

> *"Rename my 'Old Stuff' board to 'Archive 2024'"*

Claude renames it. You'll see the change in Trello immediately.

## Getting a visual board view

If you'd like Claude to render your Trello data as a visual artifact (kanban columns, clickable cards) instead of text, one of these helps:

- Ask explicitly: *"Show me my Marketing board as an interactive Trello-style view"*
- Or, in Claude settings, add this to your **Custom instructions**:

  > *"When I ask about Trello data, render the result as an interactive HTML artifact styled to match Trello's UI, with clickable card titles."*

This works best on **Sonnet** or **Opus** models with Artifacts enabled.

## What Claude can and can't do

Claude has the same Trello permissions you do. If you can see a board in Trello, Claude can. If a board is private to a teammate, Claude can't see it either.

**Important:** Actions Claude takes on your behalf appear in Trello's activity log under **your name** — the same way they would if you made the change yourself. If you ask Claude to archive cards on a shared team board, your teammates see you archived them. This is standard Trello behavior.

## Privacy notes

- Your Trello API token is stored encrypted on a private server. You don't have to manage it.
- Anthropic's standard data policies apply — they see your Trello data as it flows through Claude, the same way as with any other Claude connector (Notion, Gmail, etc.).
- Member emails are **not** exposed to Claude, even on boards where they'd normally be visible.

## Revoking access

**To disconnect Claude from your Trello:**

- **Quick revoke:** Go to <https://trello.com/your-account/profile> → find the authorized app → revoke. Claude's access stops immediately.
- **Remove the connector:** In Claude → Settings → Connectors → the three-dot menu on the connector → Remove.

Either step works independently. For a complete cleanup, do both.

## Troubleshooting

**"Couldn't reach the MCP server"**
Server is down or a network issue. Try again in a few minutes. If it persists, contact your admin.

**"Authentication failed — check TRELLO_API_KEY and TRELLO_TOKEN"**
The Trello credentials on the server side have expired or been revoked. Contact your admin (they'll need to update them in the deployment config).

**Claude doesn't see the latest tools after an update**
Claude caches the tool list when the connector is first added. Remove the connector and re-add it (~30 seconds) — this forces a fresh refresh.

**Actions show as coming from you in Trello**
That's how it works by design. Claude acts with your identity, not as a separate principal.

## Need help?

Contact your Trello connector admin.
