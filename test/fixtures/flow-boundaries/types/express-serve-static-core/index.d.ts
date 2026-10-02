export interface Response { status(code: number): Response; json(value: unknown): Response; send(value: unknown): Response; end(): Response }
export interface Application { get(path: string, ...handlers: Array<(request: unknown, response: Response) => unknown>): void }
