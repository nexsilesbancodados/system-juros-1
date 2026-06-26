// Helper para buscar TODAS as linhas do Supabase contornando o limite default de 1000.
// Uso: const rows = await fetchAll((from, to) => supabase.from("x").select("*").range(from, to));
export async function fetchAll<T = any>(
  build: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // limite de segurança: 100k linhas
  for (let i = 0; i < 100; i++) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
