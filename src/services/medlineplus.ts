// src/services/medlineplus.ts
// Symptom guidance from MedlinePlus Connect API with hardcoded fallbacks
import { SYMPTOM_FALLBACKS, SymptomGuidance } from '../data/symptom_fallbacks.js';

export async function getSymptomGuidance(symptom: string): Promise<SymptomGuidance> {
  // Check hardcoded fallbacks first (instant, always works)
  const lower = symptom.toLowerCase();
  for (const [key, guidance] of Object.entries(SYMPTOM_FALLBACKS)) {
    if (key !== 'default' && lower.includes(key)) {
      return guidance;
    }
  }

  // Try MedlinePlus Connect API
  try {
    const encoded = encodeURIComponent(symptom);
    const r = await fetch(
      `https://connect.medlineplus.gov/application?mainSearchCriteria.v.cs=2.16.840.1.113883.6.103&mainSearchCriteria.v.dn=${encoded}&knowledgeResponseType=application/json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (r.ok) {
      const data = await r.json();
      const parsed = parseMedlinePlusResponse(data);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.error('[MedlinePlus] API error:', err);
  }

  // Final fallback
  return SYMPTOM_FALLBACKS.default;
}

function parseMedlinePlusResponse(data: any): SymptomGuidance | null {
  try {
    const entries = data?.feed?.entry;
    if (!entries?.length) return null;

    // Extract useful content from MedlinePlus entries
    const summaries = entries
      .slice(0, 3)
      .map((e: any) => e.summary?._value || '')
      .filter(Boolean);

    if (summaries.length === 0) return null;

    // Return a basic structure from the API data
    return {
      homeRemedies: [
        'Rest and monitor symptoms',
        'Stay hydrated',
        'Review the MedlinePlus guidance for specific recommendations'
      ],
      goToERIf: [
        'Symptoms are severe or worsening rapidly',
        'Difficulty breathing',
        'High fever that doesn\'t respond to medication'
      ],
      seeDoctorIf: [
        'Symptoms persist more than a few days',
        'You are concerned about your condition'
      ]
    };
  } catch {
    return null;
  }
}

export function formatTriageResponse(
  symptom: string,
  guidance: SymptomGuidance
): string {
  // English formatting (primary)
  let msg = `🩺 *Health Guidance: ${symptom}*\n\n`;

  msg += `🏠 *What You Can Do at Home:*\n`;
  guidance.homeRemedies.forEach(r => { msg += `• ${r}\n`; });

  msg += `\n🚨 *Go to the ER If:*\n`;
  guidance.goToERIf.forEach(r => { msg += `• ${r}\n`; });

  msg += `\n👨‍⚕️ *See a Doctor If:*\n`;
  guidance.seeDoctorIf.forEach(r => { msg += `• ${r}\n`; });

  msg += `\n_This is for informational purposes only and is NOT medical advice._`;
  msg += `\n_If you're unsure, please see a healthcare provider._`;

  msg += `\n\n📍 *Need to find a clinic?* Send your *ZIP code*`;

  return msg;
}
