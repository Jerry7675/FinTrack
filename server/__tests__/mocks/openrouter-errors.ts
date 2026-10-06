/** Jest stand-in for @openrouter/sdk/models/errors (ESM); mirrors OpenRouterError shape. */

export class OpenRouterError extends Error {
  readonly statusCode: number;
  readonly body: string;
  readonly headers: Headers;
  readonly contentType: string;
  readonly rawResponse: Response;

  constructor(
    message: string,
    httpMeta: { response: Response; request: Request; body: string }
  ) {
    super(message);
    this.statusCode = httpMeta.response.status;
    this.body = httpMeta.body;
    this.headers = httpMeta.response.headers;
    this.contentType =
      httpMeta.response.headers.get('content-type') ?? 'application/json';
    this.rawResponse = httpMeta.response;
  }
}

export class PaymentRequiredResponseError extends OpenRouterError {
  error: { code: number; message: string };

  constructor(
    err: { error: { code: number; message: string } },
    httpMeta: { response: Response; request: Request; body: string }
  ) {
    super('Payment Required', httpMeta);
    this.error = err.error;
  }
}

export class TooManyRequestsResponseError extends OpenRouterError {
  error: { code: number; message: string };

  constructor(
    err: { error: { code: number; message: string } },
    httpMeta: { response: Response; request: Request; body: string }
  ) {
    super('Too Many Requests', httpMeta);
    this.error = err.error;
  }
}
