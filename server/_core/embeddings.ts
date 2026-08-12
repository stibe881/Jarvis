import { pipeline } from "@xenova/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

/**
 * Generiert ein Embedding (Vektor) für den übergebenen Text.
 * Wir verwenden das lokale Modell Xenova/all-MiniLM-L6-v2 (ca. 80MB),
 * das beim ersten Aufruf automatisch heruntergeladen und gecached wird.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }

  // pooling: 'mean' und normalize: true generieren optimierte Satz-Vektoren
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Berechnet die Cosine Similarity zwischen zwei Vektoren (1 = identisch, -1 = komplett gegensätzlich).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
