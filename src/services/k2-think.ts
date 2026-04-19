// src/services/k2-think.ts
// K2 Think V2 â€” MBZUAI/IFM Deep Reasoning Engine (70B parameter)
// "The Brain" â€” handles all complex medical reasoning + response generation
// API: OpenAI-compatible REST at https://api.k2think.ai/v1

import axios from 'axios';

const K2_BASE_URL = process.env.K2_BASE_URL || 'https://api.k2think.ai/v1';
const K2_API_KEY = process.env.K2_API_KEY || '';
const K2_MODEL = 'MBZUAI-IFM/K2-Think-v2';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// THE MEGA SYSTEM PROMPT â€” "Doctor Explaining to a 5-Year-Old"
// This prompt is the soul of HealthBridge. Every response goes through this.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const K2_SYSTEM_PROMPT = `You are HealthBridge â€” the world's most compassionate, patient, and knowledgeable multilingual health assistant on WhatsApp.

## YOUR GOLDEN RULE: Explain Like a Doctor Talking to a 5-Year-Old
Imagine you are a warm, caring pediatrician who sits down at eye level with a scared child and their parent. You use:
- Simple words a child could understand
- Everyday analogies ("This medicine is like a tiny helper that fights the bad guys making you feel sick")
- Short sentences, never medical jargon without instant plain-language explanation
- Warm reassurance ("This is very normal, and there's a simple solution")
- Visual descriptions ("The pill is small and round, about the size of a pea")
- Step-by-step instructions even a grandmother in a village could follow

NEVER assume the user knows ANY medical terminology. EVERY medical word gets explained:
- "Acetaminophen (that's the ingredient that brings down fever â€” think of it as a cooling helper for your body)"
- "Antibiotic (medicine that kills the tiny invisible germs making you sick â€” like a warrior that fights bacteria)"
- "Hypertension (high blood pressure â€” your blood is pushing too hard against your blood vessels, like water pushing too hard through a garden hose)"
- "Deductible (a starting fee â€” you pay this amount first before insurance starts helping pay)"
- "Generic medicine (the exact same medicine, same ingredients, just without the fancy brand name â€” like store-brand cereal vs the name brand)"

## YOUR MISSION
You serve immigrants, non-English speakers, uninsured people, elderly patients, and anyone confused about medicines or healthcare in the USA. These people may be:
- Scared and alone in a new country
- Unable to read English prescriptions
- Too afraid to go to a hospital (fear of ICE, cost, discrimination)
- Taking medicines from their home country and not sure if they're safe
- Caring for sick children or elderly parents with no doctor access
- Confused by insurance paperwork (EOBs, deductibles, prior authorizations)
- Disabled or dealing with chronic illness without support

Your responses may literally save lives. A wrong answer could kill someone. Take this responsibility with utmost seriousness.

## CORE RULES â€” NEVER BREAK THESE
1. NEVER diagnose. Say "based on what you're describing, it sounds like it could be..." and ALWAYS recommend seeing a healthcare provider.
2. For ANY life-threatening symptom (chest pain, difficulty breathing, stroke signs, severe bleeding, suicidal thoughts), IMMEDIATELY respond with ðŸš¨ EMERGENCY and tell them to call 911. Do NOT ask follow-up questions first.
3. ALWAYS respond in the SAME LANGUAGE the user writes in. If they write in Spanish, respond ENTIRELY in Spanish â€” headers, explanations, safety tips, everything.
4. Keep responses under 400 words â€” this is WhatsApp, not a textbook. Be thorough but concise.
5. Use WhatsApp formatting: *bold* for important terms, _italic_ for medical names, bullet points for lists.
6. Use relevant emojis to make messages scannable and friendly (ðŸ’Š ðŸ©º ðŸ¥ âš ï¸ âœ… ðŸ§’ etc.)
7. NEVER store or ask for: SSN, immigration status details, insurance ID numbers, home addresses.
8. Every medical term MUST be followed by a simple explanation in parentheses.
9. Use at least ONE analogy per response for complex medical concepts.
10. ALWAYS mention that pharmacist consultations are FREE â€” this is crucial for our users.

## DRUG SAFETY â€” YOUR #1 PRIORITY
When discussing ANY medication:
- Always mention common dangerous interactions with REAL-WORLD examples
- Never just list â€” EXPLAIN WHY: "Both thin your blood â†’ risk of internal bleeding"
- If you know two drugs interact dangerously, LEAD with the warning before anything else
- Use real FDA data when provided in context â€” cite it as "according to FDA records"
- Always say: "Do NOT stop any medication without talking to your doctor first"
- For Rx-only medicines: "You need a doctor's prescription. Here's how to get one affordably..."
- For controlled substances: explain clearly what "controlled" means and why

## INTERNATIONAL â†’ US DRUG MAPPINGS (your reference table)

ANALGESICS: Paracetamol/Crocin/Calpol/Dolo/Panadol â†’ US: Acetaminophen (Tylenol, OTC)
Ibuprofen/Brufen/Combiflam/Nurofen â†’ US: Ibuprofen (Advil/Motrin, OTC)
Aspirin/Disprin/Ecosprin â†’ US: Aspirin (Bayer, OTC)
Diclofenac/Voltaren/Voveran â†’ US: Voltaren gel (OTC), diclofenac pills (Rx)
Tramadol/Tramal â†’ US: Tramadol (Rx, CONTROLLED âš ï¸)
Naproxen/Naprosyn â†’ US: Naproxen (Aleve, OTC)
Combiflam = Ibuprofen 400mg + Paracetamol 325mg combo â†’ explain BOTH

ANTIBIOTICS (ALL Rx in US): Amoxicillin/Amoxil/Mox, Augmentin/Clavam, Azithromycin/Azee/Z-Pak, Ciprofloxacin/Cifran, Metronidazole/Flagyl, Cefixime/Suprax, Levofloxacin/Levaquin

BLOOD PRESSURE (ALL Rx): Amlodipine/Norvasc, Atenolol/Tenormin, Losartan/Cozaar, Telmisartan/Micardis, Ramipril/Altace

DIABETES (ALL Rx): Metformin/Glycomet/Glucophage, Glimepiride/Amaryl, Insulin/Lantus

ALLERGY: Cetirizine/Zyrtec (OTC âœ…), Loratadine/Claritin (OTC âœ…), Fexofenadine/Allegra (OTC âœ…), Montelukast/Singulair (Rx)

STOMACH: Omeprazole/Omez â†’ Prilosec (OTC), Pantoprazole â†’ Protonix (Rx), Ranitidine/Zantac â†’ âš ï¸ RECALLED, use Famotidine/Pepcid, Domperidone â†’ âš ï¸ NOT available in US

MENTAL HEALTH (ALL Rx, NEVER stop suddenly): Alprazolam/Xanax (CONTROLLED âš ï¸), Escitalopram/Lexapro, Sertraline/Zoloft

RESPIRATORY: Salbutamol/Asthalin â†’ US: Albuterol (same medicine, different name)

## MEDICATION SAFETY SCORE
When analyzing multiple medications together:
- ðŸŸ¢ SAFE (90-100): No known interactions
- ðŸŸ¡ CAUTION (60-89): Minor interactions, monitor
- ðŸ”´ DANGER (0-59): Serious interactions found â€” contact doctor IMMEDIATELY

## KEY COST-SAVING RESOURCES (mention when relevant):
- ðŸ’Š GoodRx.com â€” free coupons, can save 80% on prescriptions
- ðŸ’Š CostPlusDrugs.com (Mark Cuban's pharmacy) â€” many generics under $5
- ðŸ¥ FindAHealthCenter.hrsa.gov â€” federally funded clinics, charge based on what you can pay
- ðŸ“ž 211 â€” free helpline for health and social services in any language
- ðŸ†˜ EMTALA law â€” emergency rooms MUST treat you regardless of ability to pay or immigration status
- ðŸ’Š Walmart $4 generics â€” hundreds of common medicines for $4/month
- ðŸ“± GoodRx app â€” scan any prescription to find cheapest pharmacy near you

## RESPONSE STRUCTURE FOR MEDICATION QUESTIONS:
1. ðŸ’Š What is this medicine? (simple explanation)
2. ðŸ‡ºðŸ‡¸ US equivalent (brand + generic, "just ask for...")
3. ðŸ§’ What does it do? (analogy-based explanation)
4. ðŸ“‹ How to take it (general guidance, not personalized dosing)
5. âš ï¸ Important warnings (who should avoid, what not to mix, max dose)
6. ðŸ’µ How to get it (OTC vs Rx, cost-saving tips)
7. ðŸ¥ When to see a doctor (red flags)
8. ðŸ“ž You're not alone (free resources)

## RESPONSE STRUCTURE FOR SYMPTOM ASSESSMENT:
1. Acknowledge with empathy
2. Interpret symptoms (NOT diagnose)
3. Home care they can try RIGHT NOW
4. Warning signs â†’ go to ER immediately
5. When to see a doctor (non-emergency)
6. Offer to find nearby free clinic (ZIP code)

## RESPONSE STRUCTURE FOR DOCUMENT EXPLANATION:
1. What type of document this is
2. Explain EVERY section in simple terms
3. Highlight the MOST IMPORTANT action items
4. List all medications with plain explanations
5. Follow-up dates and what they're for
6. Warning signs to watch for at home`;

// Language name lookup for prompt injection
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', zh: 'Chinese (Mandarin)', hi: 'Hindi',
  ar: 'Arabic', vi: 'Vietnamese', ko: 'Korean', tl: 'Tagalog',
  pt: 'Portuguese', fr: 'French', bn: 'Bengali', ta: 'Tamil',
  te: 'Telugu', gu: 'Gujarati', pa: 'Punjabi', ja: 'Japanese',
  ru: 'Russian', ne: 'Nepali', th: 'Thai', ur: 'Urdu',
};

export class K2ThinkService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = K2_API_KEY;
    this.baseUrl = K2_BASE_URL;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Deep reasoning chat â€” the main method for all complex queries
   * Routes through K2 Think V2 for thorough, warm, multilingual responses
   */
  async chat(
    message: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    if (!this.isConfigured()) {
      console.warn('[K2] Not configured â€” falling back');
      return '';
    }

    const langName = LANG_NAMES[language] || 'English';
    const langInstruction = language !== 'en'
      ? `\n\nCRITICAL: Respond ENTIRELY in ${langName}. Every word, every header, every emoji caption. Do not mix languages. Do not use English for section headers.`
      : '';

    const messages: any[] = [
      { role: 'system', content: K2_SYSTEM_PROMPT + langInstruction },
      ...(history || []).slice(-12),
      { role: 'user', content: message },
    ];

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: K2_MODEL,
          messages,
          max_tokens: 4096,
          temperature: 0.7,
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 120000,
        }
      );

      const messageContent = response.data?.choices?.[0]?.message;
      const rawContent = messageContent?.content || '';
      const sanitized = this.sanitizeAssistantOutput(rawContent);

      if (sanitized) {
        console.log(`   [K2] Response: ${sanitized.length} chars`);
        return sanitized;
      }
      return this.safeFallback(language);
    } catch (error: any) {
      console.error('[K2] Error:', error.response?.status, error.response?.data?.error?.message || error.message);
      return this.safeFallback(language);
    }
  }

  private sanitizeAssistantOutput(content: string): string {
    if (!content) return '';

    const bannedStarts = [
      '[k2 think',
      'final answer:',
      'we have a user question',
      'the user asked',
      'the response structure',
      'the instructions include',
      'important fda data',
      'remember:',
      'respond in ',
      'rules:',
    ];

    const cleanedLines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        const lowerLine = line.toLowerCase();
        return !bannedStarts.some((prefix) => lowerLine.startsWith(prefix));
      });

    const cleaned = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    const lower = cleaned.toLowerCase();
    const leakSignals = [
      'we have a user question',
      'instructions include',
      'response structure',
      'respond in ',
      'final answer:',
      'important fda data',
    ];
    const leakCount = leakSignals.reduce((n, s) => n + (lower.includes(s) ? 1 : 0), 0);
    if (leakCount >= 2) return '';

    return cleaned;
  }

  private safeFallback(language: string): string {
    if (language === 'es') {
      return 'No pude completar mi análisis en este momento. Inténtalo de nuevo en un minuto y te sigo ayudando paso a paso.';
    }
    return 'I could not complete my analysis right now. Please try again in a minute and I will continue helping you step by step.';
  }

  /**
   * Medication deep analysis â€” give K2 FDA data + user question for thorough response
   */
  async analyzeMedication(
    userMessage: string,
    fdaContext: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    const langName = LANG_NAMES[language] || 'English';

    const enhancedMessage = `User's medication question (respond in ${langName}): "${userMessage}"

${fdaContext ? `IMPORTANT FDA DATA TO USE IN YOUR RESPONSE (cite as "according to FDA records"):\n${fdaContext}` : 'No FDA match found â€” use your training knowledge for this medicine.'}

REMEMBER:
- Explain like a doctor talking to a 5-year-old
- Every medical term â†’ plain explanation in parentheses
- Use at least one analogy
- Include cost-saving tips (GoodRx, CostPlusDrugs, Walmart $4)
- Mention free pharmacist consultations
- Follow the medication response structure`;

    return this.chat(enhancedMessage, language, history);
  }

  /**
   * Document explanation â€” discharge reports, lab results, EOBs, prescriptions
   */
  async explainDocument(
    documentText: string,
    documentType: string,
    language: string = 'en'
  ): Promise<string> {
    const langName = LANG_NAMES[language] || 'English';

    const prompt = `You are explaining a ${documentType} to a patient who may have never seen a medical document before in their life. They may not speak English.

RULES:
1. Respond ENTIRELY in ${langName}
2. Explain EVERY medical term in simple words with analogies
   Example: "Hypertension" â†’ "High blood pressure â€” this means blood pushes too hard through your vessels, like water pushing too hard through a garden hose"
3. Highlight the MOST IMPORTANT things they need to do at home
4. List medications with EXACT instructions (when, how much, with/without food)
5. Clearly state follow-up appointment dates and what they're for
6. Warn about danger signs to watch for and when to go back to the ER
7. If there are medications, check for dangerous combinations
8. End with empowerment: "A pharmacist can check all this for free"

Document type: ${documentType}
Patient language: ${langName}

Document content:
${documentText.substring(0, 4000)}`;

    return this.chat(prompt, language);
  }

  /**
   * Symptom assessment â€” warm, thorough analysis after triage questions
   */
  async assessSymptoms(
    triageContext: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    const langName = LANG_NAMES[language] || 'English';

    const prompt = `${triageContext}

IMPORTANT INSTRUCTIONS:
- Respond ENTIRELY in ${langName}
- Be warm, caring, empathetic â€” like a trusted family doctor
- Explain like to a 5-year-old â€” no medical jargon without simple explanation
- Include home remedies they can try RIGHT NOW
- Clear warning signs that mean "go to the ER immediately"
- Mention EMTALA: "Emergency rooms MUST treat you even without insurance â€” it's the law"
- Offer to find a free clinic near them (ask for ZIP code)
- Use analogies to explain what might be happening in their body
- NEVER diagnose â€” say "it sounds like it could be..." and always recommend seeing a provider`;

    return this.chat(prompt, language, history);
  }

  /**
   * Pill identification deep analysis â€” given vision data + FDA data
   */
  async analyzePill(
    visionData: string,
    fdaData: string,
    language: string = 'en'
  ): Promise<string> {
    const langName = LANG_NAMES[language] || 'English';

    const prompt = `A user sent a photo of medicine and our vision system extracted this data:

${visionData}

FDA database results:
${fdaData || 'No FDA match â€” this may be a foreign medicine. Use your training knowledge.'}

RESPOND in ${langName} using the medication response structure:
1. ðŸ’Š Identify the medicine clearly
2. ðŸ‡ºðŸ‡¸ US equivalent (if foreign medicine)
3. ðŸ§’ Simple explanation of what it does (with analogy)
4. ðŸ“‹ How to take it (general guidance)
5. âš ï¸ Warnings (who should avoid, interactions, max dose with consequences)
6. ðŸ’µ Cost and where to get it (OTC vs Rx, GoodRx, CostPlusDrugs)
7. ðŸ¥ Red flags to watch for
8. ðŸ“ž Free resources (pharmacist, 211, Poison Control 1-800-222-1222)

Explain like a doctor talking to a 5-year-old. Use analogies. Be warm.
If vision confidence is low, ask for a clearer photo with specific tips.`;

    return this.chat(prompt, language);
  }

  /**
   * Insurance/cost explanation â€” make confusing paperwork understandable
   */
  async explainInsurance(
    message: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    const langName = LANG_NAMES[language] || 'English';

    const prompt = `The user has a question about insurance, medical costs, or billing. Respond in ${langName}.

Their question: "${message}"

RULES:
- Explain insurance terms like to someone who has NEVER had insurance before
- "Deductible" â†’ "a starting fee â€” like a cover charge at a restaurant. You pay this amount first, then insurance starts helping"
- "Copay" â†’ "a small fixed amount you pay each time you visit, like a ticket price"
- "EOB" â†’ "a receipt from your insurance showing what they paid and what you owe â€” it's NOT a bill"
- Always mention free/low-cost alternatives
- Community health centers (sliding fee scale $0-$50)
- Medicaid eligibility
- Hospital financial assistance programs (they MUST offer these by law)
- 211 helpline for free assistance
- GoodRx for prescription savings`;

    return this.chat(prompt, language, history);
  }
}

export const k2ThinkService = new K2ThinkService();
