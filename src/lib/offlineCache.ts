import { get, set, del } from "idb-keyval";
import type { Persister } from "@tanstack/react-query-persist-client";

/**
 * IndexedDB persister para o cache do TanStack Query.
 * Mantém consultas salvas em disco → o app abre com dados mesmo offline
 * e revalida em segundo plano quando volta a rede.
 */
export const createIDBPersister = (idbKey = "sj-query-cache"): Persister => ({
  persistClient: async (client) => {
    try {
      await set(idbKey, client);
    } catch {
      /* quota / privado: ignora */
    }
  },
  restoreClient: async () => {
    try {
      return (await get(idbKey)) as any;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(idbKey);
    } catch {
      /* noop */
    }
  },
});
