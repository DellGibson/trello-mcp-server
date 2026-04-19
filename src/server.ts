import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloClient } from './services/trello.js';
import { registerBoardTools } from './tools/boards.js';
import { registerCardTools } from './tools/cards.js';
import { registerSearchTools } from './tools/search.js';

/**
 * Server-level instructions passed to the MCP client (claude.ai / Claude
 * Desktop / Cowork). Claude.ai surfaces these to the model as system
 * context, which nudges presentation behavior without any per-tool changes.
 *
 * Goal: when the user asks about Trello data, Claude should prefer
 * rendering an interactive HTML artifact in Trello's visual style over a
 * plain text summary, and make card titles clickable so tapping one asks
 * a follow-up about that specific card.
 *
 * This is a nudge, not a guarantee. Claude may still render plain text if
 * the user explicitly asks for "a summary" or "just a list."
 */
const SERVER_INSTRUCTIONS = `
This server exposes a user's Trello workspace. When presenting data from
any of these tools to the user, prefer rendering an interactive HTML
artifact styled to visually match Trello's real UI — kanban-style list
columns on a tinted board background, white rounded card tiles with
subtle shadows, archived cards shown with strikethrough and a muted
"archived" badge, open cards shown with a small "open" tag, label colors
rendered as colored bars or pills at the top of each card, member
avatars shown as small circles on the card, and due dates rendered as a
small chip (red if overdue, green if complete).

Make each card title a clickable element. When clicked, the card should
trigger a follow-up user message in the chat of the form
"Tell me more about the card: <exact card name>" using the artifacts
interaction API (window.claude.sendUserMessage or equivalent). Also
include a subtle "+ Add a card" affordance at the bottom of each list
column which triggers "Create a new card in the <list name> list of the
<board name> board".

Display the short card ID (first 7–8 chars) beneath each card title
in small muted text so the user can reference it in follow-up prompts.
Show a header with the board name and, when available, a quick count
like "N cards" per list.

For single-card detail views, render a taller card with sections for
description (Markdown-rendered), checklists (with working complete /
incomplete toggles that call the relevant MCP tool via an artifact
message), labels, members, due date, and most recent comments.

If the user explicitly asks for a text summary, a table, or a list,
render that instead — the visual artifact is the default, not a
mandate.

Tool UX notes:
- Label and member tools accept names (case-insensitive), not IDs.
  Claude does not need to call trello_get_board first to discover IDs.
- Archive is reversible (trello_update_card with closed:false, or
  trello_update_board with closed:false). There is no hard-delete tool
  by design.
- Actions performed via these tools appear in Trello under the token
  owner's name. If the user operates on teammates' boards, inform them
  the activity will show as coming from them.
`.trim();

export function createServer(apiKey: string, token: string): McpServer {
  const client = new TrelloClient(apiKey, token);
  const server = new McpServer(
    { name: 'trello-mcp-server', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerBoardTools(server, client);
  registerCardTools(server, client);
  registerSearchTools(server, client);
  return server;
}
