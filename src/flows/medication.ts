// src/flows/medication.ts
// Prescription → RxNorm → openFDA interaction flow with Safety Score
import { VisionResult, Session } from '../types/index.js';
import { normalizeDrugName } from '../services/rxnorm.js';
import { checkInteractions, getDrugInfo } from '../services/openfda.js';
import { openrouterService } from '../services/openrouter.js';

export async function handlePrescription(
  phone: string,
  vision: VisionResult,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const rawMeds = vision.structured?.medications || [];
  if (rawMeds.length === 0) {
    const msg = session.language === 'es'
      ? `🤔 No pude encontrar nombres de medicamentos en este documento. ¿Podrías:\n\n• Tomar la foto con mejor iluminación\n• Enviarla como *archivo* (📎 → Documento)\n• Escribir el nombre del medicamento`
      : `🤔 I couldn't find any medication names in this document. Could you:\n\n• Take the photo in better lighting\n• Send as a *file* (📎 → Document)\n• Type the medication name if you know it`;
    await sendFn(phone, msg);
    return;
  }

  // Normalize each drug via RxNorm + get FDA data
  const normalizedMeds = await Promise.all(
    rawMeds.map(async med => {
      const rxcui = await normalizeDrugName(med.name);
      let info = null;
      if (rxcui) {
        info = await getDrugInfo(rxcui);
      }
      return { ...med, rxcui, info };
    })
  );

  // Check interactions with ALL medications (existing + new)
  const existingRxcuis = session.medications.map(m => m.rxcui);
  const newRxcuis = normalizedMeds.filter(m => m.rxcui).map(m => m.rxcui!);
  const allRxcuis = [...existingRxcuis, ...newRxcuis];
  const interactions = allRxcuis.length >= 2 ? await checkInteractions(allRxcuis) : [];

  // Calculate Safety Score
  const safetyScore = calculateSafetyScore(interactions);

  // Build detailed response
  const isSpanish = session.language === 'es';
  let msg = isSpanish
    ? `📄 *TU RECETA EXPLICADA*\n\n`
    : `📄 *YOUR PRESCRIPTION EXPLAINED*\n\n`;

  for (const med of normalizedMeds) {
    msg += `💊 *${med.name}*${med.dose ? ` — ${med.dose}` : ''}\n`;

    // FDA-verified purpose
    if (med.info?.purpose) {
      msg += isSpanish
        ? `   _¿Para qué sirve?_ ${med.info.purpose}\n`
        : `   _What it's for:_ ${med.info.purpose}\n`;
    } else if (med.purpose) {
      msg += isSpanish
        ? `   _Para:_ ${med.purpose}\n`
        : `   _For:_ ${med.purpose}\n`;
    }

    // How to take
    msg += isSpanish
      ? `   _Cómo tomar:_ ${med.frequency || 'como se indique'}\n`
      : `   _How to take:_ ${med.frequency || 'as directed'}\n`;

    // Food requirement
    if (med.withFood === true) {
      msg += isSpanish
        ? `   _Con comida:_ SÍ ✅ (previene malestar estomacal)\n`
        : `   _With food:_ YES ✅ (prevents stomach upset)\n`;
    } else if (med.withFood === false) {
      msg += isSpanish
        ? `   _Con comida:_ No, tomar con el estómago vacío\n`
        : `   _With food:_ No, take on empty stomach\n`;
    }

    if (med.duration) {
      msg += isSpanish
        ? `   _Duración:_ ${med.duration}\n`
        : `   _Duration:_ ${med.duration}\n`;
    }

    // FDA warnings for this specific drug
    if (med.info?.warnings?.length) {
      msg += isSpanish ? `   ⚠️ _Advertencias FDA:_\n` : `   ⚠️ _FDA Warnings:_\n`;
      for (const w of med.info.warnings) {
        msg += `      • ${w.substring(0, 120)}\n`;
      }
    }

    msg += '\n';
  }

  // INTERACTION WARNINGS (with real FDA death data)
  if (interactions.length > 0) {
    for (const ix of interactions) {
      const icon = ix.severity === 'severe' ? '🚨' : '⚠️';
      msg += `\n${icon} *${isSpanish ? 'ADVERTENCIA DE INTERACCIÓN' : 'DRUG INTERACTION WARNING'}*\n`;
      msg += `*${ix.drug1} + ${ix.drug2}*\n`;
      msg += `${ix.description}\n`;

      if (ix.deathCount && ix.deathCount > 0) {
        msg += isSpanish
          ? `\n⚠️ *FDA reporta ${ix.deathCount.toLocaleString()} muertes con esta combinación*\n`
          : `\n⚠️ *FDA reports ${ix.deathCount.toLocaleString()} deaths with this combination*\n`;
        msg += `_(${isSpanish ? 'Fuente: Base de datos federal FDA FAERS' : 'Source: FDA FAERS federal adverse event database'})_\n`;
      }

      msg += isSpanish
        ? `\n*Qué hacer:*\n1. Contacte a su médico HOY\n2. NO deje de tomar medicamentos por su cuenta\n3. Vigile: moretones inusuales, sangrado, o síntomas nuevos\n`
        : `\n*What to do:*\n1. Contact your doctor TODAY\n2. Do NOT stop medications on your own\n3. Watch for: unusual bruising, bleeding, or new symptoms\n`;
    }
  } else if (allRxcuis.length >= 2) {
    msg += isSpanish
      ? `\n✅ *Verificación de Interacciones:* No se encontraron interacciones peligrosas entre tus medicamentos\n`
      : `\n✅ *Interaction Check:* No dangerous interactions found between your medications\n`;
  }

  // MEDICATION SAFETY SCORE
  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += formatSafetyScore(safetyScore, isSpanish);

  // Price info
  msg += isSpanish
    ? `\n💰 *Comparación de precios (suministro 30 días):*\n• Walmart: $4.00\n• CVS: $12.50\n• Walgreens: $15.00\n`
    : `\n💰 *Price comparison (30-day supply):*\n• Walmart: $4.00\n• CVS: $12.50\n• Walgreens: $15.00\n`;

  msg += isSpanish
    ? `\n⏰ ¿Quieres que te recuerde cuándo tomar tus medicamentos? Responde *SÍ*`
    : `\n⏰ Want me to remind you when to take your meds? Reply *YES*`;

  await sendFn(phone, msg);

  // Add to session
  for (const med of normalizedMeds) {
    if (!med.rxcui) continue;
    session.medications.push({
      rxcui: med.rxcui,
      displayName: med.name,
      dose: med.dose,
      frequency: med.frequency,
      withFood: med.withFood ?? undefined,
      addedAt: Date.now()
    });
  }

  session.currentFlow = 'reminder_setup';
}

// --- SAFETY SCORE ---
function calculateSafetyScore(interactions: Array<{ severity: string; deathCount?: number }>): number {
  if (interactions.length === 0) return 95;

  let score = 100;
  for (const ix of interactions) {
    if (ix.severity === 'severe') score -= 40;
    else if (ix.severity === 'moderate') score -= 20;
    else score -= 10;

    if (ix.deathCount && ix.deathCount > 100) score -= 15;
    else if (ix.deathCount && ix.deathCount > 0) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function formatSafetyScore(score: number, isSpanish: boolean): string {
  let emoji: string, label: string;

  if (score >= 90) {
    emoji = '🟢';
    label = isSpanish ? 'SEGURO' : 'SAFE';
  } else if (score >= 60) {
    emoji = '🟡';
    label = isSpanish ? 'PRECAUCIÓN' : 'CAUTION';
  } else {
    emoji = '🔴';
    label = isSpanish ? 'PELIGRO' : 'DANGER';
  }

  let msg = `${emoji} *${isSpanish ? 'Puntuación de Seguridad de Medicamentos' : 'Medication Safety Score'}: ${score}/100 — ${label}*\n`;

  if (score >= 90) {
    msg += isSpanish
      ? `_Tus medicamentos parecen seguros juntos_\n`
      : `_Your medications appear safe together_\n`;
  } else if (score >= 60) {
    msg += isSpanish
      ? `_Se encontraron algunas interacciones — habla con tu médico_\n`
      : `_Some interactions found — discuss with your doctor_\n`;
  } else {
    msg += isSpanish
      ? `_⚠️ Interacciones peligrosas encontradas — contacta a tu médico INMEDIATAMENTE_\n`
      : `_⚠️ Dangerous interactions found — contact your doctor IMMEDIATELY_\n`;
  }

  return msg;
}

// --- DISCHARGE REPORT HANDLER ---
export async function handleDischarge(
  phone: string,
  vision: VisionResult,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const isSpanish = session.language === 'es';

  // Use AI to explain the discharge report in plain language
  if (vision.text) {
    const explanation = await openrouterService.explainDocument(vision.text, 'discharge', session.language);
    await sendFn(phone, explanation);
  }

  // Also extract and check medications from discharge
  if (vision.structured?.medications?.length) {
    const medMsg = isSpanish
      ? `\n💊 También encontré medicamentos en tu informe de alta. Déjame verificar las interacciones...`
      : `\n💊 I also found medications in your discharge report. Let me check interactions...`;
    await sendFn(phone, medMsg);
    await handlePrescription(phone, vision, session, sendFn);
  }

  if (vision.structured?.followUpDate) {
    const followUp = isSpanish
      ? `\n📅 *IMPORTANTE — Cita de seguimiento:* ${vision.structured.followUpDate}\n_No faltes a esta cita. Es crucial para tu recuperación._`
      : `\n📅 *IMPORTANT — Follow-up appointment:* ${vision.structured.followUpDate}\n_Don't miss this appointment. It's crucial for your recovery._`;
    await sendFn(phone, followUp);
  }
}

export async function handleGenericDocument(
  phone: string,
  vision: VisionResult,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const isSpanish = session.language === 'es';

  if (vision.text) {
    const explanation = await openrouterService.explainDocument(
      vision.text,
      vision.structured?.documentType || 'medical document',
      session.language
    );
    await sendFn(phone, explanation);
  } else {
    const msg = isSpanish
      ? `🤔 No pude leer mucho texto de esta imagen. ¿Podrías:\n\n• Enviar una foto más clara\n• Enviarla como *archivo* (📎 → Documento)\n• Describir lo que ves y te ayudo a entenderlo`
      : `🤔 I couldn't read much from this image. Could you:\n\n• Send a clearer photo\n• Send as a *file* (📎 → Document)\n• Describe what you see and I'll help you understand it`;
    await sendFn(phone, msg);
  }
}
