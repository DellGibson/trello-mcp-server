/**
 * Single-tenant stateless OAuth 2.1 provider for the Trello MCP server.
 *
 * Design choices driven by Vercel serverless constraints:
 * - No external DB. All state (client registrations, auth codes, tokens,
 *   refresh tokens) is encoded as JWTs signed with OAUTH_JWT_SECRET.
 * - Auto-approves authorization requests — there's only one trusted user
 *   (the operator, i.e. whoever deployed this instance). No consent UI.
 * - Dynamic client registration returns a self-validating client_id/secret
 *   pair: the client_id IS a JWT carrying the client's registered metadata.
 */

import type { Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID, createHash } from 'node:crypto';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const CODE_TTL_SEC = 120;
const ACCESS_TOKEN_TTL_SEC = 3600;
const REFRESH_TOKEN_TTL_SEC = 365 * 24 * 3600;
const CLIENT_TTL_SEC = 365 * 24 * 3600;

/**
 * Hosts allowed as OAuth redirect_uri targets. Restricts drive-by OAuth from
 * anyone who discovers the Vercel URL. Loopback entries (localhost/127.0.0.1/[::1])
 * remain allowed for curl testing and MCP Inspector per RFC 8252 §7.3.
 */
const ALLOWED_REDIRECT_HOSTS = new Set([
  'claude.ai',
  'www.claude.ai',
  'api.anthropic.com',
  'console.anthropic.com',
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const AUD_CLIENT = 'mcp-oauth:client';
const AUD_CODE = 'mcp-oauth:code';
const AUD_ACCESS = 'mcp-oauth:access';
const AUD_REFRESH = 'mcp-oauth:refresh';

function getSecret(): Uint8Array {
  const hex = process.env.OAUTH_JWT_SECRET;
  if (!hex || hex.length < 64) {
    throw new Error('OAUTH_JWT_SECRET must be set to at least 64 hex chars');
  }
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function getIssuer(): string {
  const issuer = process.env.OAUTH_ISSUER_URL;
  if (!issuer) throw new Error('OAUTH_ISSUER_URL must be set');
  return issuer.replace(/\/$/, '');
}

async function signToken(
  payload: Record<string, unknown>,
  audience: string,
  ttlSec: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(getIssuer())
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(getSecret());
}

async function verifyToken<T = Record<string, unknown>>(
  token: string,
  audience: string,
): Promise<T> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: getIssuer(),
    audience,
  });
  return payload as T;
}

class StatelessClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    try {
      const payload = await verifyToken<{ client: OAuthClientInformationFull }>(
        clientId,
        AUD_CLIENT,
      );
      return payload.client;
    } catch {
      return undefined;
    }
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const placeholderId = randomUUID();
    const clientSecret = client.token_endpoint_auth_method === 'none'
      ? undefined
      : randomUUID();

    const full: OAuthClientInformationFull = {
      ...client,
      client_id: placeholderId,
      client_secret: clientSecret,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: clientSecret ? issuedAt + CLIENT_TTL_SEC : 0,
    };

    const clientIdJwt = await signToken({ client: full }, AUD_CLIENT, CLIENT_TTL_SEC);
    full.client_id = clientIdJwt;
    return full;
  }
}

function base64UrlFromBuffer(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function verifyPkceS256(codeVerifier: string, expectedChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64UrlFromBuffer(hash) === expectedChallenge;
}

export class TrelloOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new StatelessClientsStore();

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Reject redirects to untrusted hosts BEFORE issuing a code.
    // The SDK's authorizationHandler catches thrown errors and emits a
    // properly-formed OAuth error response (no redirect to the attacker).
    let redirectHost: string;
    try {
      redirectHost = new URL(params.redirectUri).hostname;
    } catch {
      throw new Error('redirect_uri is not a valid URL');
    }
    if (!ALLOWED_REDIRECT_HOSTS.has(redirectHost)) {
      throw new Error('redirect_uri host not allowed');
    }

    const code = await signToken(
      {
        client_id: client.client_id,
        code_challenge: params.codeChallenge,
        redirect_uri: params.redirectUri,
        scopes: params.scopes,
        resource: params.resource?.href,
      },
      AUD_CODE,
      CODE_TTL_SEC,
    );

    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set('code', code);
    if (params.state !== undefined) redirect.searchParams.set('state', params.state);
    res.redirect(redirect.href);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const payload = await verifyToken<{ code_challenge: string }>(authorizationCode, AUD_CODE);
    return payload.code_challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const payload = await verifyToken<{
      client_id: string;
      code_challenge: string;
      redirect_uri: string;
      scopes?: string[];
      resource?: string;
    }>(authorizationCode, AUD_CODE);

    if (payload.client_id !== client.client_id) {
      throw new Error('client_id mismatch');
    }
    if (redirectUri !== undefined && redirectUri !== payload.redirect_uri) {
      throw new Error('redirect_uri mismatch');
    }
    if (codeVerifier !== undefined) {
      if (!verifyPkceS256(codeVerifier, payload.code_challenge)) {
        throw new Error('PKCE verification failed');
      }
    }

    const accessToken = await signToken(
      { client_id: client.client_id, scopes: payload.scopes ?? [] },
      AUD_ACCESS,
      ACCESS_TOKEN_TTL_SEC,
    );
    const refreshToken = await signToken(
      { client_id: client.client_id, scopes: payload.scopes ?? [] },
      AUD_REFRESH,
      REFRESH_TOKEN_TTL_SEC,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: refreshToken,
      scope: payload.scopes?.join(' '),
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const payload = await verifyToken<{ client_id: string; scopes?: string[] }>(
      refreshToken,
      AUD_REFRESH,
    );
    if (payload.client_id !== client.client_id) {
      throw new Error('client_id mismatch');
    }
    const effectiveScopes = scopes ?? payload.scopes ?? [];

    const newAccess = await signToken(
      { client_id: client.client_id, scopes: effectiveScopes },
      AUD_ACCESS,
      ACCESS_TOKEN_TTL_SEC,
    );
    const newRefresh = await signToken(
      { client_id: client.client_id, scopes: effectiveScopes },
      AUD_REFRESH,
      REFRESH_TOKEN_TTL_SEC,
    );
    return {
      access_token: newAccess,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: newRefresh,
      scope: effectiveScopes.join(' '),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const payload = await verifyToken<{
      client_id: string;
      scopes?: string[];
      exp: number;
    }>(token, AUD_ACCESS);

    return {
      token,
      clientId: payload.client_id,
      scopes: payload.scopes ?? [],
      expiresAt: payload.exp,
    };
  }

  /**
   * Stateless best-effort revocation per RFC 7009.
   *
   * LIMITATION: Because tokens are JWTs with no server-side store, revocation
   * only stops the CLIENT from using the token (they discard it on 200 OK).
   * The token remains cryptographically valid until its TTL expires. For
   * enforceable server-side revocation we would need a denylist (KV/Redis)
   * or rotate OAUTH_JWT_SECRET (invalidates all tokens). Acceptable for
   * single-user deployments; documented in the operator runbook.
   *
   * RFC 7009 §2.2: the server responds 200 regardless of whether the token
   * was valid, to avoid information disclosure. We validate the token purely
   * to log the revocation intent (useful when reviewing logs later).
   */
  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const token = request.token;
    let kind: 'access' | 'refresh' | 'invalid' = 'invalid';
    try {
      await verifyToken(token, AUD_ACCESS);
      kind = 'access';
    } catch {
      try {
        await verifyToken(token, AUD_REFRESH);
        kind = 'refresh';
      } catch {
        kind = 'invalid';
      }
    }
    // Log (not throw) so stateless revocation is observable in Vercel logs
    // without leaking token material.
    console.log(
      JSON.stringify({
        event: 'oauth.revoke',
        kind,
        token_hint: request.token_type_hint ?? null,
      }),
    );
  }
}
