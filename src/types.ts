// Trello API types
// Index signature required for MCP SDK structuredContent compatibility

export interface TrelloBoard {
  [key: string]: unknown;
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  idOrganization: string | null;
  prefs: { permissionLevel: string; backgroundColor: string; };
}

export interface TrelloList {
  [key: string]: unknown;
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
}

export interface TrelloCard {
  [key: string]: unknown;
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  idBoard: string;
  idList: string;
  idMembers: string[];
  idLabels: string[];
  labels: TrelloLabel[];
  due: string | null;
  dueComplete: boolean;
  url: string;
  shortUrl: string;
  pos: number;
  dateLastActivity: string;
}

export interface TrelloLabel {
  [key: string]: unknown;
  id: string;
  idBoard: string;
  name: string;
  color: string;
}
export interface TrelloMember {
  [key: string]: unknown;
  id: string;
  username: string;
  fullName: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface TrelloComment {
  [key: string]: unknown;
  id: string;
  idMemberCreator: string;
  data: {
    text: string;
    card: { id: string; name: string };
    board: { id: string; name: string };
  };
  date: string;
  memberCreator: { id: string; username: string; fullName: string; };
}

export interface TrelloChecklist {
  [key: string]: unknown;
  id: string;
  name: string;
  idCard: string;
  idBoard: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloCheckItem {
  [key: string]: unknown;
  id: string;
  name: string;
  state: 'complete' | 'incomplete';
  idChecklist: string;
  pos: number;
  due: string | null;
}

export interface TrelloAction {
  [key: string]: unknown;
  id: string;
  type: string;
  date: string;
  data: Record<string, unknown>;
  memberCreator: { id: string; username: string; fullName: string; };
}
