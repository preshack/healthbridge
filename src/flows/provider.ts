// src/flows/provider.ts
// FQHC finder flow
import { Session } from '../types/index.js';
import { findNearestFQHCs, formatProviderResults } from '../services/fqhc.js';
import { RIGHTS_TEXT } from '../data/rights_text.js';

export async function startProvider(
  phone: string,
  message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  // Check if message contains a ZIP code
  const zipMatch = message.match(/\b(\d{5})\b/);

  if (zipMatch) {
    await handleZipLookup(phone, zipMatch[1], session, sendFn);
  } else {
    session.currentFlow = 'provider';
    const askZip = session.language === 'es'
      ? `📍 Para encontrar clínicas cercanas, envíe su *código postal* (5 dígitos).`
      : `📍 To find clinics near you, send your *ZIP code* (5 digits).`;
    await sendFn(phone, askZip);
  }
}

export async function continueProvider(
  phone: string,
  message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const zipMatch = message.match(/\b(\d{5})\b/);

  if (zipMatch) {
    await handleZipLookup(phone, zipMatch[1], session, sendFn);
    session.currentFlow = 'idle';
  } else {
    const retry = session.language === 'es'
      ? `❌ No reconocí un código postal. Por favor envíe un código postal de 5 dígitos (ejemplo: 08540).`
      : `❌ I didn't recognize a ZIP code. Please send a 5-digit ZIP code (example: 08540).`;
    await sendFn(phone, retry);
  }
}

async function handleZipLookup(
  phone: string,
  zip: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  try {
    const providers = await findNearestFQHCs(zip, 3);
    const response = formatProviderResults(providers, session.language);
    await sendFn(phone, response);
  } catch (err) {
    const errorMsg = session.language === 'es'
      ? `❌ No pude buscar el código postal ${zip}. Verifique que sea correcto e intente de nuevo.`
      : `❌ I couldn't look up ZIP code ${zip}. Please check it's correct and try again.`;
    await sendFn(phone, errorMsg);
  }
}

export async function handleSafeAccess(
  phone: string,
  _message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  // Send rights text + prompt for ZIP
  const rights = RIGHTS_TEXT[session.language] || RIGHTS_TEXT.en;
  await sendFn(phone, rights);

  const prompt = session.language === 'es'
    ? `\n📍 Envíe su *código postal* para encontrar centros de salud comunitarios seguros cerca de usted.`
    : `\n📍 Send your *ZIP code* to find safe community health centers near you.`;
  await sendFn(phone, prompt);
  session.currentFlow = 'provider';
}

export async function handleInsurance(
  phone: string,
  _message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const msg = session.language === 'es'
    ? `💳 *Guía de Seguros*

Términos comunes:
• *Deducible* — Lo que paga antes de que el seguro cubra
• *Copago* — Monto fijo por visita (ej: $25)
• *Coseguro* — Su porcentaje después del deducible (ej: 20%)
• *Máximo de bolsillo* — El máximo que pagará en un año

Si no tiene seguro:
• Los centros de salud comunitarios ofrecen escala de pago ($0–$50)
• Medicaid puede estar disponible — pregunte en la clínica
• Los hospitales deben ofrecer programas de asistencia financiera

📍 Envíe su *código postal* para encontrar opciones de bajo costo cerca de usted.`

    : `💳 *Insurance Guide*

Common terms:
• *Deductible* — What you pay before insurance kicks in
• *Copay* — Fixed amount per visit (e.g., $25)
• *Coinsurance* — Your percentage after deductible (e.g., 20%)
• *Out-of-pocket max* — The most you'll pay in a year

If you don't have insurance:
• Community health centers offer sliding fee scale ($0–$50)
• Medicaid may be available — ask at the clinic
• Hospitals must offer financial assistance programs

📍 Send your *ZIP code* to find low-cost options near you.`;

  await sendFn(phone, msg);
  session.currentFlow = 'provider';
}
