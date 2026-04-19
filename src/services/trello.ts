import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  TrelloBoard, TrelloList, TrelloCard, TrelloLabel,
  TrelloMember, TrelloComment, TrelloChecklist, TrelloAction
} from '../types.js';

const BASE_URL = 'https://api.trello.com/1';

export class TrelloClient {
  private http: AxiosInstance;
  private apiKey: string;
  private token: string;

  constructor(apiKey: string, token: string) {
    this.apiKey = apiKey;
    this.token = token;
    this.http = axios.create({ baseURL: BASE_URL, timeout: 15000 });
    this.http.interceptors.response.use(undefined, async (error: AxiosError) => {
      const cfg = error.config as (typeof error.config & { _retry?: number }) | undefined;
      if (!cfg || error.response?.status !== 429 || (cfg._retry ?? 0) >= 2) throw error;
      const attempt = (cfg._retry ?? 0) + 1;
      cfg._retry = attempt;
      await new Promise(r => setTimeout(r, attempt * 1000));
      return this.http.request(cfg);
    });
  }

  private get auth() { return { key: this.apiKey, token: this.token }; }

  private handleError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status;
      const message = (axiosErr.response?.data as { message?: string })?.message ?? axiosErr.message;
      if (status === 401) throw new Error(`Authentication failed — check TRELLO_API_KEY and TRELLO_TOKEN`);
      if (status === 403) throw new Error(`Access denied for ${context} — check board permissions`);
      if (status === 404) throw new Error(`Not found: ${context} — verify the ID is correct`);
      if (status === 429) throw new Error(`Rate limit hit — wait a moment and retry`);
      throw new Error(`Trello API error in ${context}: ${message}`);
    }
    throw new Error(`Unexpected error in ${context}: ${String(error)}`);
  }

  async getMyBoards(filter: 'open' | 'closed' | 'all' = 'open'): Promise<TrelloBoard[]> {
    try {
      const { data } = await this.http.get<TrelloBoard[]>('/members/me/boards', {
        params: { ...this.auth, filter, fields: 'id,name,desc,url,closed,idOrganization,prefs' }
      });
      return data;
    } catch (e) { this.handleError(e, 'getMyBoards'); }
  }

  async getBoard(boardId: string): Promise<TrelloBoard> {
    try {
      const { data } = await this.http.get<TrelloBoard>(`/boards/${boardId}`, {
        params: { ...this.auth, fields: 'id,name,desc,url,closed,idOrganization,prefs' }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoard(${boardId})`); }
  }

  async updateBoard(boardId: string, updates: { name?: string; desc?: string; closed?: boolean; idOrganization?: string; prefs?: Record<string, unknown> }): Promise<TrelloBoard> {
    try {
      const params: Record<string, unknown> = { ...this.auth };
      if (updates.name !== undefined) params.name = updates.name;
      if (updates.desc !== undefined) params.desc = updates.desc;
      if (updates.closed !== undefined) params.closed = updates.closed;
      if (updates.idOrganization !== undefined) params.idOrganization = updates.idOrganization;
      const { data } = await this.http.put<TrelloBoard>(`/boards/${boardId}`, null, { params });
      return data;
    } catch (e) { this.handleError(e, `updateBoard(${boardId})`); }
  }

  async getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
    try {
      const { data } = await this.http.get<TrelloLabel[]>(`/boards/${boardId}/labels`, {
        params: { ...this.auth }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoardLabels(${boardId})`); }
  }

  async getBoardMembers(boardId: string): Promise<TrelloMember[]> {
    try {
      const { data } = await this.http.get<TrelloMember[]>(`/boards/${boardId}/members`, {
        params: { ...this.auth, fields: 'id,username,fullName,avatarUrl' }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoardMembers(${boardId})`); }
  }

  async getBoardLists(boardId: string, filter: 'open' | 'closed' | 'all' = 'open'): Promise<TrelloList[]> {
    try {
      const { data } = await this.http.get<TrelloList[]>(`/boards/${boardId}/lists`, {
        params: { ...this.auth, filter }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoardLists(${boardId})`); }
  }

  async updateList(listId: string, updates: { name?: string; closed?: boolean; idBoard?: string; pos?: 'top' | 'bottom' | number }): Promise<TrelloList> {
    try {
      const params: Record<string, unknown> = { ...this.auth };
      if (updates.name !== undefined) params.name = updates.name;
      if (updates.closed !== undefined) params.closed = updates.closed;
      if (updates.idBoard !== undefined) params.idBoard = updates.idBoard;
      if (updates.pos !== undefined) params.pos = updates.pos;
      const { data } = await this.http.put<TrelloList>(`/lists/${listId}`, null, { params });
      return data;
    } catch (e) { this.handleError(e, `updateList(${listId})`); }
  }

  async getList(listId: string): Promise<TrelloList> {
    try {
      const { data } = await this.http.get<TrelloList>(`/lists/${listId}`, { params: { ...this.auth } });
      return data;
    } catch (e) { this.handleError(e, `getList(${listId})`); }
  }

  async createList(boardId: string, name: string, pos?: 'top' | 'bottom' | number): Promise<TrelloList> {
    try {
      const { data } = await this.http.post<TrelloList>('/lists', null, {
        params: { ...this.auth, idBoard: boardId, name, pos: pos ?? 'bottom' }
      });
      return data;
    } catch (e) { this.handleError(e, 'createList'); }
  }

  async getListCards(listId: string): Promise<TrelloCard[]> {
    try {
      const { data } = await this.http.get<TrelloCard[]>(`/lists/${listId}/cards`, {
        params: { ...this.auth, fields: 'id,name,desc,closed,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,url,shortUrl,pos,dateLastActivity' }
      });
      return data;
    } catch (e) { this.handleError(e, `getListCards(${listId})`); }
  }

  async getBoardCards(boardId: string, filter: 'open' | 'closed' | 'all' = 'open'): Promise<TrelloCard[]> {
    try {
      const { data } = await this.http.get<TrelloCard[]>(`/boards/${boardId}/cards/${filter}`, {
        params: { ...this.auth, fields: 'id,name,desc,closed,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,url,shortUrl,pos,dateLastActivity' }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoardCards(${boardId})`); }
  }

  async getCard(cardId: string): Promise<TrelloCard> {
    try {
      const { data } = await this.http.get<TrelloCard>(`/cards/${cardId}`, { params: { ...this.auth } });
      return data;
    } catch (e) { this.handleError(e, `getCard(${cardId})`); }
  }

  async createCard(listId: string, name: string, desc?: string, due?: string, idMembers?: string[], idLabels?: string[], pos?: 'top' | 'bottom'): Promise<TrelloCard> {
    try {
      const { data } = await this.http.post<TrelloCard>('/cards', null, {
        params: {
          ...this.auth, idList: listId, name,
          ...(desc ? { desc } : {}),
          ...(due ? { due } : {}),
          ...(idMembers?.length ? { idMembers: idMembers.join(',') } : {}),
          ...(idLabels?.length ? { idLabels: idLabels.join(',') } : {}),
          pos: pos ?? 'bottom'
        }
      });
      return data;
    } catch (e) { this.handleError(e, 'createCard'); }
  }

  async updateCard(cardId: string, updates: { name?: string; desc?: string; due?: string | null; dueComplete?: boolean; idList?: string; idMembers?: string[]; idLabels?: string[]; closed?: boolean; pos?: 'top' | 'bottom' | number; }): Promise<TrelloCard> {
    try {
      const params: Record<string, unknown> = { ...this.auth };
      if (updates.name !== undefined) params.name = updates.name;
      if (updates.desc !== undefined) params.desc = updates.desc;
      if (updates.due !== undefined) params.due = updates.due;
      if (updates.dueComplete !== undefined) params.dueComplete = updates.dueComplete;
      if (updates.idList !== undefined) params.idList = updates.idList;
      if (updates.idMembers !== undefined) params.idMembers = updates.idMembers.join(',');
      if (updates.idLabels !== undefined) params.idLabels = updates.idLabels.join(',');
      if (updates.closed !== undefined) params.closed = updates.closed;
      if (updates.pos !== undefined) params.pos = updates.pos;
      const { data } = await this.http.put<TrelloCard>(`/cards/${cardId}`, null, { params });
      return data;
    } catch (e) { this.handleError(e, `updateCard(${cardId})`); }
  }

  async archiveCard(cardId: string): Promise<TrelloCard> { return this.updateCard(cardId, { closed: true }); }
  async moveCard(cardId: string, listId: string, pos?: 'top' | 'bottom'): Promise<TrelloCard> {
    return this.updateCard(cardId, { idList: listId, pos: pos ?? 'bottom' });
  }

  async copyCard(sourceCardId: string, targetListId: string, options?: { name?: string; keepFromSource?: string; pos?: 'top' | 'bottom' }): Promise<TrelloCard> {
    try {
      const { data } = await this.http.post<TrelloCard>('/cards', null, {
        params: {
          ...this.auth,
          idCardSource: sourceCardId,
          idList: targetListId,
          keepFromSource: options?.keepFromSource ?? 'all',
          ...(options?.name ? { name: options.name } : {}),
          pos: options?.pos ?? 'bottom',
        }
      });
      return data;
    } catch (e) { this.handleError(e, `copyCard(${sourceCardId})`); }
  }

  async addLabelToCard(cardId: string, labelId: string): Promise<void> {
    try {
      await this.http.post(`/cards/${cardId}/idLabels`, null, {
        params: { ...this.auth, value: labelId }
      });
    } catch (e) { this.handleError(e, `addLabelToCard(${cardId})`); }
  }

  async removeLabelFromCard(cardId: string, labelId: string): Promise<void> {
    try {
      await this.http.delete(`/cards/${cardId}/idLabels/${labelId}`, {
        params: { ...this.auth }
      });
    } catch (e) { this.handleError(e, `removeLabelFromCard(${cardId})`); }
  }

  async addMemberToCard(cardId: string, memberId: string): Promise<void> {
    try {
      await this.http.post(`/cards/${cardId}/idMembers`, null, {
        params: { ...this.auth, value: memberId }
      });
    } catch (e) { this.handleError(e, `addMemberToCard(${cardId})`); }
  }

  async removeMemberFromCard(cardId: string, memberId: string): Promise<void> {
    try {
      await this.http.delete(`/cards/${cardId}/idMembers/${memberId}`, {
        params: { ...this.auth }
      });
    } catch (e) { this.handleError(e, `removeMemberFromCard(${cardId})`); }
  }

  async addAttachmentToCard(cardId: string, url: string, name?: string): Promise<{ id: string; name: string; url: string }> {
    try {
      const { data } = await this.http.post<{ id: string; name: string; url: string }>(`/cards/${cardId}/attachments`, null, {
        params: { ...this.auth, url, ...(name ? { name } : {}) }
      });
      return data;
    } catch (e) { this.handleError(e, `addAttachmentToCard(${cardId})`); }
  }

  async getCardComments(cardId: string): Promise<TrelloComment[]> {
    try {
      const { data } = await this.http.get<TrelloComment[]>(`/cards/${cardId}/actions`, {
        params: { ...this.auth, filter: 'commentCard' }
      });
      return data;
    } catch (e) { this.handleError(e, `getCardComments(${cardId})`); }
  }

  async addComment(cardId: string, text: string): Promise<TrelloComment> {
    try {
      const { data } = await this.http.post<TrelloComment>(`/cards/${cardId}/actions/comments`, null, {
        params: { ...this.auth, text }
      });
      return data;
    } catch (e) { this.handleError(e, `addComment(${cardId})`); }
  }

  async getCardChecklists(cardId: string): Promise<TrelloChecklist[]> {
    try {
      const { data } = await this.http.get<TrelloChecklist[]>(`/cards/${cardId}/checklists`, { params: { ...this.auth } });
      return data;
    } catch (e) { this.handleError(e, `getCardChecklists(${cardId})`); }
  }

  async createChecklist(cardId: string, name: string): Promise<TrelloChecklist> {
    try {
      const { data } = await this.http.post<TrelloChecklist>('/checklists', null, {
        params: { ...this.auth, idCard: cardId, name }
      });
      return data;
    } catch (e) { this.handleError(e, 'createChecklist'); }
  }

  async addCheckItem(checklistId: string, name: string, checked?: boolean): Promise<TrelloChecklist> {
    try {
      const { data } = await this.http.post<TrelloChecklist>(`/checklists/${checklistId}/checkItems`, null, {
        params: { ...this.auth, name, ...(checked !== undefined ? { checked } : {}) }
      });
      return data;
    } catch (e) { this.handleError(e, 'addCheckItem'); }
  }

  async updateCheckItem(cardId: string, checklistId: string, checkItemId: string, state: 'complete' | 'incomplete'): Promise<TrelloChecklist> {
    try {
      const { data } = await this.http.put<TrelloChecklist>(
        `/cards/${cardId}/checklist/${checklistId}/checkItem/${checkItemId}`, null,
        { params: { ...this.auth, state } }
      );
      return data;
    } catch (e) { this.handleError(e, 'updateCheckItem'); }
  }

  async search(query: string, modelTypes: string[] = ['cards', 'boards'], limit = 10): Promise<{ cards?: TrelloCard[]; boards?: TrelloBoard[]; }> {
    try {
      const { data } = await this.http.get<{ cards?: TrelloCard[]; boards?: TrelloBoard[] }>('/search', {
        params: { ...this.auth, query, modelTypes: modelTypes.join(','), cards_limit: limit, boards_limit: limit,
          cards_fields: 'id,name,desc,idList,idBoard,due,dueComplete,url,closed',
          boards_fields: 'id,name,desc,url,closed' }
      });
      return data;
    } catch (e) { this.handleError(e, 'search'); }
  }

  async getBoardActivity(boardId: string, limit = 20): Promise<TrelloAction[]> {
    try {
      const { data } = await this.http.get<TrelloAction[]>(`/boards/${boardId}/actions`, {
        params: { ...this.auth, limit }
      });
      return data;
    } catch (e) { this.handleError(e, `getBoardActivity(${boardId})`); }
  }
}
