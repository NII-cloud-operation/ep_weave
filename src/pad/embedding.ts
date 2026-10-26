import { logPrefix } from "./util/log";

export type EmbeddingSettings = {
  enabled?: boolean;
  url?: string;
};

export const DIMENSION = 768;

let endpoint: string | null = null;

export function configure(settings: EmbeddingSettings | undefined) {
  if (!settings?.enabled) {
    endpoint = null;
    console.info(logPrefix, "Similarity is disabled");
    return;
  }
  if (typeof settings.url !== "string") {
    throw new Error("ep_weave.embedding.url is required when ep_weave.embedding.enabled is true");
  }
  endpoint = `${settings.url.replace(/\/$/, "")}/embeddings`;
  console.info(logPrefix, "Embedding service:", endpoint);
}

export function isEnabled() {
  return endpoint !== null;
}

export async function embed(title: string, text: string): Promise<number[]> {
  if (!endpoint) {
    throw new Error("Embedding service is not configured");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, text }),
  });
  if (!response.ok) {
    throw new Error(
      `Embedding request failed: ${response.status} ${response.statusText} - ${await response.text()}`
    );
  }
  const { embedding } = await response.json();
  return embedding;
}
