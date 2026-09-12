import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

/**
 * Returns a singleton libSQL/Turso database client.
 * Defaults to local SQLite file `file:local.db` if TURSO_DATABASE_URL is not configured.
 */
export function getTursoClient(): Client {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  _client = createClient({
    url,
    authToken,
  });

  return _client;
}

export const turso = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const client = getTursoClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
