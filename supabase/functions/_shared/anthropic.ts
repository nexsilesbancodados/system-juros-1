// Helper compartilhado para chamadas à API Anthropic (Claude)
export const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | any[];
}

export interface CallAnthropicParams {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/**
 * Chama a API Anthropic. Retorna o texto da resposta.
 */
export async function callAnthropic(params: CallAnthropicParams): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model || ANTHROPIC_MODEL,
      max_tokens: params.maxTokens || 1024,
      temperature: params.temperature ?? 0.7,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

/**
 * Chama Anthropic esperando uma resposta JSON. Faz parse automático.
 */
export async function callAnthropicJSON<T = any>(params: CallAnthropicParams): Promise<T> {
  const text = await callAnthropic(params);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta sem JSON válido");
  return JSON.parse(match[0]) as T;
}
