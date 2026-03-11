declare module "gamedig" {
  export interface QueryOptions {
    type: string;
    host: string;
    port?: number;
  }

  export interface QueryResult {
    name?: string;
    map?: string;
    players?: Array<{ name?: string; score?: number; time?: number }>;
    numplayers?: number;
    maxplayers?: number;
    ping?: number;
    type?: string;
    raw?: Record<string, unknown>;
  }

  export class GameDig {
    static query(options: QueryOptions): Promise<QueryResult>;
  }
}
