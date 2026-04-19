// src/services/rxnorm.ts
// Drug name normalization via NIH RxNorm API — deterministic, no LLM

interface RxNormApproximateResponse {
  approximateGroup?: {
    candidate?: Array<{ rxcui?: string }>;
  };
}

export async function normalizeDrugName(rawName: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(rawName.trim());
    const r = await fetch(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encoded}&maxEntries=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const data = await r.json() as RxNormApproximateResponse;
    return data.approximateGroup?.candidate?.[0]?.rxcui || null;
  } catch (err) {
    console.error('[RxNorm] Normalization failed for:', rawName, err);
    return null;
  }
}
