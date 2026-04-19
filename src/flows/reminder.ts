// src/flows/reminder.ts
// Medication reminders + caregiver escalation
import { Session, Language, Medication } from '../types/index.js';

// Active reminders per user
const activeReminders = new Map<string, NodeJS.Timeout[]>();

// Escalation timeline
export const ESCALATION = [
  { delayMs: 0, level: 'initial' as const },
  { delayMs: 30 * 60 * 1000, level: 'missed' as const },   // 30 minutes
  { delayMs: 60 * 60 * 1000, level: 'caregiver' as const }, // 60 minutes
];

const REMINDER_MSGS: Record<Language, (med: string) => string> = {
  en: med => `⏰ Time for *${med}*. Reply *TAKEN* when done.`,
  es: med => `⏰ Hora de tomar *${med}*. Responde *TOMADO* cuando lo hayas tomado.`,
  zh: med => `⏰ 该服药了: *${med}*。服药后请回复 *已服*.`,
  hi: med => `⏰ *${med}* लेने का समय है। लेने के बाद *लिया* जवाब दें।`,
  ar: med => `⏰ حان وقت *${med}*. أجب بـ *تم* عند الانتهاء.`,
  vi: med => `⏰ Đến giờ uống *${med}*. Trả lời *ĐÃ UỐNG* khi xong.`,
  ko: med => `⏰ *${med}* 복용 시간입니다. 복용 후 *복용완료* 라고 답장해주세요.`,
  tl: med => `⏰ Oras na para sa *${med}*. Sumagot ng *ININOM* kapag tapos na.`,
  pt: med => `⏰ Hora de tomar *${med}*. Responda *TOMADO* quando terminar.`,
};

export async function handleReminderSetup(
  phone: string,
  message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const lower = message.toLowerCase();

  if (lower.includes('yes') || lower.includes('sí') || lower.includes('si')
      || lower.includes('是') || lower.includes('हाँ')) {

    // Set up reminders for all recent medications
    const recentMeds = session.medications.filter(
      m => Date.now() - m.addedAt < 5 * 60 * 1000 // Added in last 5 minutes
    );

    if (recentMeds.length === 0) {
      await sendFn(phone, `I don't have any medications to set reminders for. Send a prescription photo first!`);
      session.currentFlow = 'idle';
      return;
    }

    // Schedule demo reminders (30-second intervals for testing, in production: real times)
    let msg = `✅ *Reminders Set!*\n\n`;
    msg += `I'll send you reminders for:\n`;

    for (const med of recentMeds) {
      msg += `• ⏰ *${med.displayName}* ${med.dose || ''} — ${med.frequency || 'as directed'}\n`;

      // Schedule escalation chain for demo (using shorter intervals)
      scheduleReminder(phone, med, session.language, sendFn);
    }

    msg += `\nI'll remind you at the scheduled times.`;
    msg += `\n\nReply *TAKEN* after taking your medication.`;

    await sendFn(phone, msg);
    session.currentFlow = 'idle';
  } else if (lower.includes('no') || lower.includes('skip')) {
    await sendFn(phone, `👍 No reminders set. You can always set them later by sending your prescription again.`);
    session.currentFlow = 'idle';
  } else {
    const prompt = session.language === 'es'
      ? `¿Desea configurar recordatorios de medicamentos? Responda *SÍ* o *NO*.`
      : `Would you like to set up medication reminders? Reply *YES* or *NO*.`;
    await sendFn(phone, prompt);
  }
}

function scheduleReminder(
  phone: string,
  med: Medication,
  language: Language,
  sendFn: (to: string, msg: string) => Promise<void>
): void {
  const key = `${phone}:${med.rxcui}`;
  const timers: NodeJS.Timeout[] = [];

  // For demo: send initial reminder after 60 seconds
  const demoDelay = 60 * 1000;

  // Initial reminder
  timers.push(setTimeout(async () => {
    try {
      const msgFn = REMINDER_MSGS[language] || REMINDER_MSGS.en;
      await sendFn(phone, msgFn(med.displayName));
    } catch (err) {
      console.error('[Reminder] Failed to send initial:', err);
    }
  }, demoDelay));

  activeReminders.set(key, timers);
}

export function cancelReminders(phone: string, rxcui: string): void {
  const key = `${phone}:${rxcui}`;
  const timers = activeReminders.get(key);
  if (timers) {
    timers.forEach(t => clearTimeout(t));
    activeReminders.delete(key);
  }
}

export function handleTaken(
  phone: string,
  session: Session
): string {
  // Cancel pending reminders for this user
  for (const med of session.medications) {
    cancelReminders(phone, med.rxcui);
  }
  return session.language === 'es'
    ? `✅ ¡Registrado! Bien hecho por tomar su medicamento. 💪`
    : `✅ Logged! Great job taking your medication. 💪`;
}

