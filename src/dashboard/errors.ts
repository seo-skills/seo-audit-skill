/**
 * The one error shape the API speaks.
 *
 * Every failure comes back as `{ error: { code, message, hint?, details? } }`.
 * `hint` says what to do about it, `details` carries structured context an
 * agent can branch on. A caller never has to parse a sentence.
 */

export type ApiErrorCode =
  | 'unauthorized'
  | 'bad-origin'
  | 'unknown-route'
  | 'method-not-allowed'
  | 'not-found'
  | 'invalid-id'
  | 'invalid-option'
  | 'unsupported-option'
  | 'unsupported-media-type'
  | 'payload-too-large'
  | 'run-in-progress'
  | 'too-many-streams'
  | 'internal';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    hint?: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly hint: string | undefined;
  readonly details: Record<string, unknown> | undefined;
  /** Extra response headers this failure requires, e.g. `Location` on a 409 */
  readonly headers: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { hint?: string; details?: Record<string, unknown>; headers?: Record<string, string> } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
    this.headers = options.headers;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.hint && { hint: this.hint }),
        ...(this.details && { details: this.details }),
      },
    };
  }
}

export const unauthorized = (): ApiError =>
  new ApiError(401, 'unauthorized', 'This request carried no valid dashboard token.', {
    hint: 'Read the token from $SEOMATOR_HOME/serve.json (or the serve output) and send it as the X-SEOmator-Token header.',
  });

export const badOrigin = (details: Record<string, unknown>): ApiError =>
  new ApiError(403, 'bad-origin', 'This request did not come from the local dashboard.', {
    hint: 'The dashboard only answers same-origin requests from 127.0.0.1.',
    details,
  });

export const notFound = (what: string, hint?: string): ApiError =>
  new ApiError(404, 'not-found', `${what} was not found.`, hint ? { hint } : {});

export const invalidId = (id: string): ApiError =>
  new ApiError(400, 'invalid-id', `"${id}" is not an audit id.`, {
    hint: 'Audit ids look like 2026-09-03-a1b2c3. GET /api/audits lists them.',
  });
