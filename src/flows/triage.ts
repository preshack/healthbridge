// src/flows/triage.ts
// Conversational, multi-turn symptom assessment — asks one question at a time
import { Session } from '../types/index.js';
import { getSymptomGuidance, formatTriageResponse } from '../services/medlineplus.js';
import { openrouterService } from '../services/openrouter.js';
import { addToConversationHistory } from '../services/session.js';

// Conversational triage questions (asked one at a time)
const QUESTIONS: Record<string, { en: string; es: string }> = {
  onset: {
    en: "I want to help you figure this out 🤝\n\nFirst — *when did this start?* Was it sudden, or has it been building up gradually?",
    es: "Quiero ayudarte a entender esto 🤝\n\nPrimero — *¿cuándo empezó?* ¿Fue de repente, o ha ido aumentando poco a poco?"
  },
  location: {
    en: "Thanks for sharing that. Can you *describe exactly where* it bothers you? For example, if it's a headache — is it the front, sides, back of head, or behind your eyes?",
    es: "Gracias por compartir. ¿Puedes *describir exactamente dónde* te molesta? Por ejemplo, si es dolor de cabeza — ¿es al frente, a los lados, atrás, o detrás de los ojos?"
  },
  severity: {
    en: "On a scale of *1 to 10* (1 = barely noticeable, 10 = worst pain ever), how would you rate it right now?",
    es: "En una escala del *1 al 10* (1 = apenas se nota, 10 = el peor dolor que has sentido), ¿cómo lo calificarías ahora mismo?"
  },
  history: {
    en: "Have you experienced this before? If so, *what helped* last time? Any medication or home remedy that worked?",
    es: "¿Has experimentado esto antes? Si es así, *¿qué te ayudó* la última vez? ¿Algún medicamento o remedio casero que funcionó?"
  },
  medications: {
    en: "Are you currently taking any medications? 💊\n\n_(This is really important — I need to check for dangerous interactions before suggesting anything)_",
    es: "¿Estás tomando algún medicamento actualmente? 💊\n\n_(Esto es muy importante — necesito verificar interacciones peligrosas antes de sugerir algo)_"
  },
  otherSymptoms: {
    en: "Last question — do you have any *other symptoms* along with this? Even things that seem unrelated (fever, nausea, dizziness, etc.)?",
    es: "Última pregunta — ¿tienes algún *otro síntoma* junto con esto? Incluso cosas que parezcan no relacionadas (fiebre, náuseas, mareos, etc.)?"
  }
};

export async function startTriage(
  phone: string,
  message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  session.currentFlow = 'triage';
  session.triageStep = 0;
  session.triageData = { symptoms: [message] };

  // Ask first question
  const lang = session.language === 'es' ? 'es' : 'en';
  const empathy = lang === 'es'
    ? `Entiendo que estás experimentando *${message}*. Lamento que pases por esto. Voy a hacerte algunas preguntas rápidas para poder ayudarte mejor.`
    : `I understand you're experiencing *${message}*. I'm sorry you're going through this. Let me ask you a few quick questions so I can help you better.`;

  await sendFn(phone, empathy);
  addToConversationHistory(session, 'user', message);
  addToConversationHistory(session, 'assistant', empathy);

  const firstQ = QUESTIONS.onset[lang];
  await sendFn(phone, firstQ);
  session.triageStep = 1;
}

export async function continueTriage(
  phone: string,
  message: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const lang = session.language === 'es' ? 'es' : 'en';
  const lower = message.toLowerCase();

  // Store each answer in triageData
  addToConversationHistory(session, 'user', message);

  // Parse answer based on current step
  switch (session.triageStep) {
    case 1: // Onset answer
      if (lower.match(/\d+/) || lower.includes('day') || lower.includes('week') || lower.includes('hour') || lower.includes('día') || lower.includes('semana')) {
        const numMatch = message.match(/(\d+)/);
        if (numMatch) session.triageData.durationDays = parseInt(numMatch[1]);
      }
      session.triageStep = 2;
      await sendFn(phone, QUESTIONS.location[lang]);
      break;

    case 2: // Location answer
      session.triageData.symptoms = [...(session.triageData.symptoms || []), message];
      session.triageStep = 3;
      await sendFn(phone, QUESTIONS.severity[lang]);
      break;

    case 3: // Severity answer
      const severityMatch = message.match(/(\d+)/);
      if (severityMatch) {
        const num = parseInt(severityMatch[1]);
        if (num >= 8) session.triageData.severity = 'severe';
        else if (num >= 5) session.triageData.severity = 'moderate';
        else session.triageData.severity = 'mild';
      }
      session.triageStep = 4;
      await sendFn(phone, QUESTIONS.history[lang]);
      break;

    case 4: // History answer — check if they mention a medication
      session.triageData.symptoms = [...(session.triageData.symptoms || []), `history: ${message}`];
      session.triageStep = 5;
      await sendFn(phone, QUESTIONS.medications[lang]);
      break;

    case 5: // Current medications — THIS IS WHERE WE CHECK INTERACTIONS
      session.triageStep = 6;
      await sendFn(phone, QUESTIONS.otherSymptoms[lang]);
      // Store medications mention for analysis
      session.triageData.symptoms = [...(session.triageData.symptoms || []), `current_meds: ${message}`];
      break;

    case 6: // Final question answered — generate comprehensive assessment
      session.triageData.symptoms = [...(session.triageData.symptoms || []), `other_symptoms: ${message}`];
      await generateAssessment(phone, session, sendFn);
      break;

    default:
      session.currentFlow = 'idle';
      break;
  }
}

async function generateAssessment(
  phone: string,
  session: Session,
  sendFn: (to: string, msg: string) => Promise<void>
): Promise<void> {
  const lang = session.language === 'es' ? 'es' : 'en';
  const processingMsg = lang === 'es'
    ? '🔍 Analizando toda la información que me compartiste...'
    : '🔍 Analyzing everything you\'ve shared with me...';
  await sendFn(phone, processingMsg);

  // Get symptom guidance from MedlinePlus
  const primarySymptom = session.triageData.symptoms?.[0] || '';
  const guidance = await getSymptomGuidance(primarySymptom);

  // Build comprehensive context for AI
  const context = `Patient assessment data:
- Primary concern: ${primarySymptom}
- All symptoms reported: ${session.triageData.symptoms?.join('; ')}
- Duration: ${session.triageData.durationDays || 'unknown'} days
- Severity: ${session.triageData.severity || 'unknown'}
- Patient language: ${session.language}

MedlinePlus guidance for "${primarySymptom}":
- Home remedies: ${guidance.homeRemedies.join(', ')}
- Go to ER if: ${guidance.goToERIf.join(', ')}
- See doctor if: ${guidance.seeDoctorIf.join(', ')}

Based on ALL of this information, provide a comprehensive but conversational assessment. Include:
1. Your interpretation of their symptoms (NOT a diagnosis)  
2. Home care steps they can try RIGHT NOW
3. Clear warning signs that mean "go to the ER"
4. When they should see a doctor
5. Ask if they want to find a nearby free/low-cost clinic (mention their ZIP code)

Respond entirely in ${lang === 'es' ? 'Spanish' : 'English'}. Be warm and caring.`;

  try {
    const response = await openrouterService.assessSymptoms(context, session.language, session.conversationHistory);
    addToConversationHistory(session, 'assistant', response);
    await sendFn(phone, response);
  } catch (err) {
    // Fallback to formatted MedlinePlus data
    const fallback = formatTriageResponse(primarySymptom, guidance);
    await sendFn(phone, fallback);
  }

  // Offer next steps
  const nextSteps = lang === 'es'
    ? `\n📍 ¿Quieres que encuentre una clínica cercana? Envíame tu *código postal*.\n💊 ¿Quieres verificar interacciones de medicamentos? Dime qué tomas.`
    : `\n📍 Want me to find a clinic nearby? Send me your *ZIP code*.\n💊 Want to check drug interactions? Tell me what you're taking.`;
  await sendFn(phone, nextSteps);

  session.currentFlow = 'idle';
  session.triageStep = 0;
}
