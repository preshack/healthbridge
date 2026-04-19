// ...existing code with secrets removed and using environment variables...
// src/services/openrouter.ts
// Dual-model architecture:
//   OpenRouter/Claude â†’ fast tasks (intent detection, vision OCR)
//   K2 Think V2 â†’ deep reasoning (chat, medication analysis, document explanation)

import axios from 'axios';
import { SYSTEM_PROMPTS, DEFAULT_SYSTEM_PROMPT, INTENT_PROMPT, DISCHARGE_EXPLAIN_PROMPT } from '../prompts.js';
import { k2ThinkService } from './k2-think.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterService {
  private apiKey: string;
  private textModel = 'anthropic/claude-3-haiku';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Main chat â€” routes to K2 Think V2 for deep reasoning, falls back to OpenRouter
   */
  async chat(
    message: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    // Try K2 Think V2 first â€” it has the mega "5-year-old doctor" prompt
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  Routing to K2 Think V2 for deep reasoning...');
      const k2Response = await k2ThinkService.chat(message, language, history);
      if (k2Response) return k2Response;
      console.log('   âš ï¸ K2 returned empty â€” falling back to OpenRouter');
    }

    // Fallback to OpenRouter
    return this.openRouterChat(message, language, history);
  }

  /**
   * Medication-specific chat â€” K2 with FDA context for thorough drug analysis
   */
  async medicationChat(
    message: string,
    fdaContext: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  K2 Think V2: medication deep analysis...');
      const k2Response = await k2ThinkService.analyzeMedication(message, fdaContext, language, history);
      if (k2Response) return k2Response;
    }
    // Fallback: inject FDA context into OpenRouter chat
    const enhancedMsg = fdaContext
      ? `${message}\n\nFDA DATA:\n${fdaContext}`
      : message;
    return this.openRouterChat(enhancedMsg, language, history);
  }

  /**
   * Symptom assessment â€” K2 for warm, thorough triage analysis
   */
  async assessSymptoms(
    triageContext: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  K2 Think V2: symptom assessment...');
      const k2Response = await k2ThinkService.assessSymptoms(triageContext, language, history);
      if (k2Response) return k2Response;
    }
    return this.openRouterChat(triageContext, language, history);
  }

  /**
   * Document explanation â€” K2 for thorough, warm medical document explanations
   */
  async explainDocument(
    documentText: string,
    documentType: string,
    language: string
  ): Promise<string> {
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  K2 Think V2: document explanation...');
      const k2Response = await k2ThinkService.explainDocument(documentText, documentType, language);
      if (k2Response) return k2Response;
    }
    // Fallback to OpenRouter
    const prompt = DISCHARGE_EXPLAIN_PROMPT + `\n\nDocument type: ${documentType}\nPatient language: ${this.getLanguageName(language)}\n\nDocument content:\n${documentText.substring(0, 3000)}`;
    return this.openRouterChat(prompt, language);
  }

  /**
   * Insurance explanation â€” K2 for making confusing paperwork understandable
   */
  async explainInsurance(
    message: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  K2 Think V2: insurance explanation...');
      const k2Response = await k2ThinkService.explainInsurance(message, language, history);
      if (k2Response) return k2Response;
    }
    return this.openRouterChat(message, language, history);
  }

  /**
   * Pill analysis â€” K2 for deep pill identification reasoning
   */
  async analyzePillDeep(
    visionData: string,
    fdaData: string,
    language: string = 'en'
  ): Promise<string> {
    if (k2ThinkService.isConfigured()) {
      console.log('   ðŸ§  K2 Think V2: pill identification reasoning...');
      const k2Response = await k2ThinkService.analyzePill(visionData, fdaData, language);
      if (k2Response) return k2Response;
    }
    return '';
  }

  /**
   * Vision/Image analysis — OpenRouter multimodal for pill/photo understanding
   */
  async analyzeImage(
    imageBase64: string,
    prompt: string
  ): Promise<string> {
    if (!this.apiKey) {
      console.error('[OpenRouter Vision] OPENROUTER_API_KEY is missing');
      return '{}';
    }

    try {
      const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
      const response = await axios.post(
        `${OPENROUTER_BASE}/chat/completions`,
        {
          model: this.textModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `${prompt}\n\nReturn only valid JSON.` },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'HealthBridge'
          },
          timeout: 25000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '{}';
      const jsonMatch = String(content).match(/\{[\s\S]*\}/);
      if (!jsonMatch) return '{}';

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return JSON.stringify(parsed);
      } catch {
        return '{}';
      }
    } catch (error: any) {
      console.error('[OpenRouter Vision] error:', error.response?.status || error.message);
      return '{}';
    }
  }

  /**
   * Intent detection â€” stays on OpenRouter/Gemma (fast, cheap, reliable)
   */
  async detectIntent(message: string, language: string = 'en'): Promise<{
    intent: string;
    detectedLanguage: string;
    confidence: number;
  }> {
    // Rule-based first for instant critical stuff
    const ruleBased = this.ruleBasedIntent(message);
    if (ruleBased.confidence >= 0.8) return { ...ruleBased, detectedLanguage: this.detectLang(message) };

    if (!this.apiKey) return { ...ruleBased, detectedLanguage: this.detectLang(message) };

    const prompt = INTENT_PROMPT.replace('{message}', message.substring(0, 300));

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE}/chat/completions`,
        {
          model: this.textModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'HealthBridge'
          },
          timeout: 15000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || 'unclear',
          detectedLanguage: parsed.detectedLanguage || language,
          confidence: parsed.confidence || 0.5
        };
      }
    } catch (error: any) {
      console.error('[OpenRouter] Intent error:', error.response?.status || error.message);
    }

    return { ...ruleBased, detectedLanguage: this.detectLang(message) };
  }

  // â”€â”€â”€ OpenRouter direct chat (fallback when K2 is unavailable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async openRouterChat(
    message: string,
    language: string = 'en',
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    if (!this.apiKey) return this.fallbackChat(message, language);

    const systemPrompt = SYSTEM_PROMPTS[language] || DEFAULT_SYSTEM_PROMPT;
    const langInstruction = language !== 'en'
      ? `\n\nIMPORTANT: Respond ENTIRELY in ${this.getLanguageName(language)}. Do not mix languages.`
      : '';

    const messages: any[] = [
      { role: 'system', content: systemPrompt + langInstruction },
      ...(history || []).slice(-12),
      { role: 'user', content: message }
    ];

    try {
      const response = await axios.post(
        `${OPENROUTER_BASE}/chat/completions`,
        { model: this.textModel, messages, max_tokens: 800 },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'HealthBridge'
          },
          timeout: 30000
        }
      );
      return response.data?.choices?.[0]?.message?.content || this.fallbackChat(message, language);
    } catch (error: any) {
      console.error('[OpenRouter] Chat error:', error.response?.status || error.message);
      return this.fallbackChat(message, language);
    }
  }

  // â”€â”€â”€ Language detection (instant, free) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  detectLang(text: string): string {
    const lower = text.toLowerCase();
    if (/[Ã¡Ã©Ã­Ã³ÃºÃ±Â¿Â¡]/.test(text) || ['hola', 'dolor', 'ayuda', 'medicamento', 'tengo'].some(w => lower.includes(w))) return 'es';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u1100-\u11FF\uAC00-\uD7AF]/.test(text)) return 'ko';
    if (/[\u00C0-\u00FF]/.test(text) && lower.includes('nÃ£o')) return 'pt';
    if (/[\u0980-\u09FF]/.test(text)) return 'bn';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';
    if (['xin', 'chÃ o', 'Ä‘au', 'thuá»‘c'].some(w => lower.includes(w))) return 'vi';
    if (['kumusta', 'sakit', 'tulong'].some(w => lower.includes(w))) return 'tl';
    return 'en';
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English', es: 'Spanish', zh: 'Chinese (Mandarin)',
      hi: 'Hindi', ar: 'Arabic', vi: 'Vietnamese',
      ko: 'Korean', tl: 'Tagalog', pt: 'Portuguese',
      fr: 'French', bn: 'Bengali', ta: 'Tamil',
      te: 'Telugu', gu: 'Gujarati', ja: 'Japanese',
      ru: 'Russian', ne: 'Nepali', th: 'Thai',
    };
    return names[code] || 'English';
  }

  private ruleBasedIntent(message: string): { intent: string; confidence: number } {
    const lower = message.toLowerCase();

    // Emergency â€” highest priority
    const emergencyWords = ['chest pain', 'heart attack', "can't breathe", 'not breathing', 'unconscious', 'stroke', 'seizure', 'overdose', 'suicid',
                           'dolor de pecho', 'no puedo respirar', 'ataque al corazÃ³n', 'èƒ¸ç—›', 'à¤¸à¥€à¤¨à¥‡ à¤®à¥‡à¤‚ à¤¦à¤°à¥à¤¦'];
    if (emergencyWords.some(w => lower.includes(w))) return { intent: 'emergency', confidence: 0.95 };

    // TAKEN acknowledgment
    if (['taken', 'tomado', 'å·²æœ', 'à¤²à¤¿à¤¯à¤¾', 'ØªÙ…', 'Ä‘Ã£ uá»‘ng', 'ë³µìš©ì™„ë£Œ', 'ininom'].includes(lower.trim())) return { intent: 'taken', confidence: 0.95 };

    // ZIP code
    if (/^\d{5}$/.test(lower.trim())) return { intent: 'find_provider', confidence: 0.9 };

    // Symptom/triage keywords
    const triageWords = ['hurt', 'pain', 'ache', 'sick', 'fever', 'headache', 'nausea', 'cough', 'dizzy', 'rash', 'sore throat',
                        'stomach', 'vomit', 'diarrhea', 'anxiety', 'depressed', 'tired', 'weak',
                        'dolor', 'fiebre', 'tos', 'nÃ¡usea', 'mareo', 'enfermo'];
    if (triageWords.some(w => lower.includes(w))) return { intent: 'triage', confidence: 0.8 };

    // Medication
    const medWords = ['medication', 'medicine', 'drug', 'prescription', 'pill', 'side effect', 'interaction', 'dose', 'refill',
                     'medicamento', 'medicina', 'pastilla', 'interacciÃ³n', 'dosis', 'è¯', 'à¤¦à¤µà¤¾'];
    if (medWords.some(w => lower.includes(w))) return { intent: 'medication', confidence: 0.8 };

    // Provider
    const provWords = ['clinic', 'doctor', 'hospital', 'near me', 'find', 'nearby', 'free clinic',
                      'clÃ­nica', 'mÃ©dico', 'hospital', 'cerca'];
    if (provWords.some(w => lower.includes(w))) return { intent: 'find_provider', confidence: 0.8 };

    // Safe access
    const safeWords = ['immigration', 'undocumented', 'deport', 'rights', 'afraid', 'scared', 'ice',
                      'migratorio', 'indocumentado', 'derechos', 'miedo'];
    if (safeWords.some(w => lower.includes(w))) return { intent: 'safe_access', confidence: 0.8 };

    // Insurance
    const insWords = ['insurance', 'deductible', 'copay', 'bill', 'cost', 'afford', 'eob',
                     'seguro', 'costo', 'factura'];
    if (insWords.some(w => lower.includes(w))) return { intent: 'insurance', confidence: 0.8 };

    // Greeting
    if (['hello', 'hi', 'hey', 'hola', 'ä½ å¥½', 'à¤¨à¤®à¤¸à¥à¤¤à¥‡', 'Ù…Ø±Ø­Ø¨Ø§', 'xin chÃ o', 'ì•ˆë…•', 'kumusta', 'olÃ¡', 'good morning', 'good afternoon', 'start'].some(g => lower.startsWith(g) || lower === g))
      return { intent: 'greeting', confidence: 0.85 };

    return { intent: 'unclear', confidence: 0 };
  }

  private fallbackChat(_message: string, language: string): string {
    const fallbacks: Record<string, string> = {
      es: 'ðŸ¤– RecibÃ­ tu mensaje. Soy HealthBridge â€” puedo ayudarte con preguntas de salud, medicamentos, encontrar clÃ­nicas gratuitas y mÃ¡s. Â¿En quÃ© puedo ayudarte?',
      zh: 'ðŸ¤– æˆ‘æ”¶åˆ°äº†ä½ çš„æ¶ˆæ¯ã€‚æˆ‘æ˜¯HealthBridge â€” æˆ‘å¯ä»¥å¸®åŠ©ä½ è§£ç­”å¥åº·é—®é¢˜ã€è¯ç‰©ä¿¡æ¯ã€å¯»æ‰¾å…è´¹è¯Šæ‰€ç­‰ã€‚æœ‰ä»€ä¹ˆå¯ä»¥å¸®ä½ çš„ï¼Ÿ',
      hi: 'ðŸ¤– à¤®à¥ˆà¤‚à¤¨à¥‡ à¤†à¤ªà¤•à¤¾ à¤¸à¤‚à¤¦à¥‡à¤¶ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤¿à¤¯à¤¾à¥¤ à¤®à¥ˆà¤‚ HealthBridge à¤¹à¥‚à¤‚ â€” à¤®à¥ˆà¤‚ à¤¸à¥à¤µà¤¾à¤¸à¥à¤¥à¥à¤¯ à¤ªà¥à¤°à¤¶à¥à¤¨à¥‹à¤‚, à¤¦à¤µà¤¾à¤“à¤‚, à¤®à¥à¤«à¥à¤¤ à¤•à¥à¤²à¥€à¤¨à¤¿à¤• à¤–à¥‹à¤œà¤¨à¥‡ à¤®à¥‡à¤‚ à¤®à¤¦à¤¦ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤‚à¥¤ à¤®à¥ˆà¤‚ à¤•à¥ˆà¤¸à¥‡ à¤®à¤¦à¤¦ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤‚?',
      ar: 'ðŸ¤– ØªÙ„Ù‚ÙŠØª Ø±Ø³Ø§Ù„ØªÙƒ. Ø£Ù†Ø§ HealthBridge â€” ÙŠÙ…ÙƒÙ†Ù†ÙŠ Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ ÙÙŠ Ø£Ø³Ø¦Ù„Ø© Ø§Ù„ØµØ­Ø© ÙˆØ§Ù„Ø£Ø¯ÙˆÙŠØ© ÙˆØ§Ù„Ø¹ÙŠØ§Ø¯Ø§Øª Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©. ÙƒÙŠÙ ÙŠÙ…ÙƒÙ†Ù†ÙŠ Ù…Ø³Ø§Ø¹Ø¯ØªÙƒØŸ',
    };
    return fallbacks[language] || 'ðŸ¤– I received your message. I\'m HealthBridge â€” I can help with health questions, medications, finding free clinics, and more. How can I help you?';
  }
}

export const openrouterService = new OpenRouterService();
