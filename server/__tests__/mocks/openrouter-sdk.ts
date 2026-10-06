export class OpenRouter {
  constructor(_opts: { apiKey: string }) {}
  chat = {
    send: jest.fn(),
  };
}
