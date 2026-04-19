// src/services/openfda.ts
// Drug interaction checking via FDA FAERS database — deterministic, no LLM
import { DrugInteraction } from '../types/index.js';

interface OpenFdaReactionCount {
  term: string;
  count?: number;
}

interface OpenFdaEventCountResponse {
  results?: OpenFdaReactionCount[];
}

interface OpenFdaMetaResponse {
  meta?: {
    results?: {
      total?: number;
    };
  };
}

interface OpenFdaLabel {
  purpose?: string[];
  indications_and_usage?: string[];
  warnings?: string[];
  openfda?: {
    generic_name?: string[];
  };
}

interface OpenFdaLabelResponse {
  results?: OpenFdaLabel[];
}

interface RxNormPropertyResponse {
  propConceptGroup?: {
    propConcept?: Array<{ propValue?: string }>;
  };
}

export async function checkInteractions(rxcuiList: string[]): Promise<DrugInteraction[]> {
  if (rxcuiList.length < 2) return [];

  const interactions: DrugInteraction[] = [];
  const newDrug = rxcuiList[rxcuiList.length - 1];
  const existingDrugs = rxcuiList.slice(0, -1);

  for (const existing of existingDrugs) {
    try {
      // Get adverse event reports where both drugs appear
      const newName = await getDrugNameFromRxcui(newDrug);
      const existName = await getDrugNameFromRxcui(existing);

      if (!newName || !existName) continue;

      const query = encodeURIComponent(
        `patient.drug.medicinalproduct:"${newName}" AND patient.drug.medicinalproduct:"${existName}"`
      );

      const r = await fetch(
        `https://api.fda.gov/drug/event.json?search=${query}&count=patient.reaction.reactionmeddrapt.exact&limit=5`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!r.ok) continue;

      const data = await r.json() as OpenFdaEventCountResponse;
      if (!data.results?.length) continue;

      // Get death count — THE NUMBER THAT WINS THE DEMO
      let deathCount = 0;
      try {
        const deathQuery = encodeURIComponent(
          `patient.drug.medicinalproduct:"${newName}" AND patient.drug.medicinalproduct:"${existName}" AND seriousnessdeath:1`
        );
        const deathR = await fetch(
          `https://api.fda.gov/drug/event.json?search=${deathQuery}&limit=1`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (deathR.ok) {
          const deathData = await deathR.json() as OpenFdaMetaResponse;
          deathCount = deathData.meta?.results?.total || 0;
        }
      } catch {
        // Death count is optional enhancement
      }

      interactions.push({
        drug1: newName,
        drug2: existName,
        severity: deathCount > 100 ? 'severe' : deathCount > 0 ? 'moderate' : 'mild',
        description: data.results.slice(0, 3).map((item) => item.term).join(', '),
        deathCount
      });
    } catch (err) {
      console.error('[openFDA] Interaction check failed:', err);
      continue;
    }
  }

  return interactions;
}

export async function getDrugInfo(rxcui: string): Promise<{
  purpose: string;
  warnings: string[];
  genericName: string;
}> {
  try {
    const r = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.rxcui:"${rxcui}"&limit=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return { purpose: '', warnings: [], genericName: '' };

    const data = await r.json() as OpenFdaLabelResponse;
    const label = data.results?.[0];
    return {
      purpose: label?.purpose?.[0]?.substring(0, 200)
        || label?.indications_and_usage?.[0]?.substring(0, 200) || '',
      warnings: (label?.warnings || []).slice(0, 2).map((w: string) => w.substring(0, 150)),
      genericName: label?.openfda?.generic_name?.[0] || '',
    };
  } catch {
    return { purpose: '', warnings: [], genericName: '' };
  }
}

async function getDrugNameFromRxcui(rxcui: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const data = await r.json() as RxNormPropertyResponse;
    return data.propConceptGroup?.propConcept?.[0]?.propValue || null;
  } catch {
    return null;
  }
}
