# trello-mcp-server

A Model Context Protocol (MCP) server that connects Claude Desktop to your Trello boards. Ask Claude to manage cards, lists, comments, and checklists in plain English.

## Tools

| Tool | Description |
|---|---|
| `trello_list_boards` | List all your boards |
| `trello_get_board` | Board details: lists, members, labels |
| `trello_list_board_cards` | All cards on a board |
| `trello_get_board_activity` | Recent board activity |
| `trello_create_list` | Add a list to a board |
| `trello_get_list_cards` | Cards in a specific list |
| `trello_get_card` | Card detail with comments and checklists |
| `trello_create_card` | Create a new card |
| `trello_update_card` | Update card fields |
| `trello_move_card` | Move card to another list |
| `trello_archive_card` | Archive a card |
| `trello_add_comment` | Post a comment on a card |
| `trello_add_checklist` | Add checklist to a card |
| `trello_update_check_item` | Mark checklist item complete/incomplete |
| `trello_search` | Search across all boards |

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- A Trello account
- Claude Desktop (Pro, Max, Team, or Enterprise)

## Setup

### 1. Get Trello credentials

**API Key:**
Go to https://trello.com/power-ups/admin, create or select a Power-Up, and copy the API Key.

**Token:**
Visit this URL (replace `YOUR_API_KEY`):
```
https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_API_KEY
```
Authorize and copy the token shown.

Alternatively, copy `.env.example` to `.env` in the repo root and fill in both values if you prefer loading credentials from a dotenv file via your launcher.

### 2. Install and build

```bash
git clone https://github.com/DellGibson/trello-mcp-server.git
cd trello-mcp-server
npm install
npm run build
```

### 3. Configure Claude Desktop

Edit your Claude Desktop config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the `mcpServers` block (merge with existing content if present):

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp-server/dist/index.js"],
      "env": {
        "TRELLO_API_KEY": "your_api_key_here",
        "TRELLO_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Windows example path:** `C:\\Users\\YourName\\trello-mcp-server\\dist\\index.js`

### 4. Restart Claude Desktop

Fully quit and relaunch Claude Desktop. You should see the Trello tools available in the toolbar.

### 5. Test

Ask Claude: *"List my Trello boards"*

## Troubleshooting

**"Authentication failed — check TRELLO_API_KEY and TRELLO_TOKEN"**
The `env` block in your Claude Desktop config is empty or wrong. Re-open the config, confirm both values are copied without surrounding quotes or whitespace, and fully restart Claude Desktop.

**Trello tools don't appear in Claude Desktop's toolbar**
Claude Desktop caches the server list. Fully quit it (taskbar tray on Windows, ⌘Q on macOS — not just closing the window), then relaunch. If tools still don't appear, check `%APPDATA%\Claude\logs\` (Windows) or `~/Library/Logs/Claude/` (macOS) for the MCP startup error.

**Network errors or timeouts**
Verify `api.trello.com` is reachable from your machine (`curl https://api.trello.com/1/members/me?key=…&token=…`). Corporate proxies or endpoint firewalls sometimes block it.

## Example prompts

- "Show me all cards on my Marketing board"
- "Create a card called 'Review Q3 report' in my To Do list"
- "Move the 'Deploy hotfix' card to Done"
- "Add a comment to card XYZ saying the PR is ready for review"
- "Search for any cards mentioning budget"

## Security

- Your API key and token are stored only in your local Claude Desktop config file
- The token grants read/write access to your Trello account — treat it like a password
- To revoke access: https://trello.com/your-account/profile → revoke the token
- This server makes HTTPS requests only to `api.trello.com`. No telemetry, no third-party calls
- Report security issues privately via [GitHub's Report a Vulnerability](https://github.com/DellGibson/trello-mcp-server/security) flow — see [`SECURITY.md`](SECURITY.md)

## License

MIT
