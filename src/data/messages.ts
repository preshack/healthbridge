// src/data/messages.ts — Production messages (no demos)
import { Language } from '../types/index.js';

export const WELCOME: Record<Language, string> = {
  en: `🌟 *Welcome to HealthBridge* 🏥

I'm your personal health companion on WhatsApp — here to help you navigate healthcare in the US, in *your language*.

Here's what I can do:

📸 *Send a photo of any medication, prescription, or medical document* — I'll identify it and explain everything in plain language

💊 *Ask about any medication* — I'll check FDA records for safety, side effects, and dangerous interactions

🩺 *Describe your symptoms* — I'll walk you through it step by step (I won't just throw info at you!)

🏥 *Find free or low-cost clinics* — Just send your ZIP code

📋 *Hospital discharge report?* — Send a photo and I'll translate the medical jargon

🔒 *Your privacy matters* — I never store personal info

_Just send me a message, a photo, or your ZIP code to get started!_`,

  es: `🌟 *Bienvenido a HealthBridge* 🏥

Soy tu compañero de salud personal en WhatsApp — aquí para ayudarte a navegar el sistema de salud en EE.UU., en *tu idioma*.

Esto es lo que puedo hacer:

📸 *Envía una foto de cualquier medicamento, receta o documento médico* — lo identificaré y te lo explicaré en palabras simples

💊 *Pregunta sobre cualquier medicamento* — verificaré los registros de la FDA por seguridad e interacciones peligrosas

🩺 *Describe tus síntomas* — te guiaré paso a paso (¡no te voy a soltar toda la información de golpe!)

🏥 *Encuentra clínicas gratuitas o de bajo costo* — Solo envía tu código postal

📋 *¿Informe de alta del hospital?* — Envía una foto y traduciré la jerga médica

🔒 *Tu privacidad importa* — Nunca almaceno información personal

_¡Envíame un mensaje, una foto o tu código postal para empezar!_`,

  zh: `🌟 *欢迎使用 HealthBridge* 🏥

我是您在WhatsApp上的个人健康助手——用*您的语言*帮助您在美国获得医疗服务。

我可以做什么：

📸 *发送任何药物、处方或医疗文件的照片* — 我会识别并用简单的语言解释
💊 *询问任何药物* — 我会检查FDA记录的安全性和危险的相互作用
🩺 *描述您的症状* — 我会一步步引导您
🏥 *找到免费或低价诊所* — 只需发送您的邮政编码
📋 *出院报告？* — 发送照片，我会翻译医学术语

_发送消息、照片或邮政编码即可开始！_`,

  hi: `🌟 *HealthBridge में आपका स्वागत है* 🏥

मैं WhatsApp पर आपका व्यक्तिगत स्वास्थ्य साथी हूं — *आपकी भाषा* में अमेरिका में स्वास्थ्य सेवा में मदद करने के लिए।

📸 *किसी भी दवा या मेडिकल डॉक्यूमेंट की फोटो भेजें* — मैं पहचानूंगा और सरल भाषा में समझाऊंगा
💊 *किसी भी दवा के बारे में पूछें* — FDA रिकॉर्ड की जांच करूंगा
🩺 *अपने लक्षण बताएं* — कदम दर कदम गाइड करूंगा
🏥 *मुफ्त क्लीनिक खोजें* — बस अपना ZIP कोड भेजें

_शुरू करने के लिए एक संदेश, फोटो या ZIP कोड भेजें!_`,

  ar: `🌟 *مرحباً بك في HealthBridge* 🏥

أنا رفيقك الصحي الشخصي على واتساب — هنا لمساعدتك في الحصول على الرعاية الصحية في أمريكا، *بلغتك*.

📸 *أرسل صورة لأي دواء أو وصفة طبية* — سأحددها وأشرح كل شيء بلغة بسيطة
💊 *اسأل عن أي دواء* — سأتحقق من سجلات FDA
🩺 *صف أعراضك* — سأرشدك خطوة بخطوة
🏥 *ابحث عن عيادات مجانية* — فقط أرسل الرمز البريدي

_أرسل رسالة أو صورة أو رمز بريدي للبدء!_`,

  vi: `🌟 *Chào mừng đến HealthBridge* 🏥

Tôi là trợ lý sức khỏe cá nhân trên WhatsApp — giúp bạn tiếp cận dịch vụ y tế tại Mỹ, bằng *ngôn ngữ của bạn*.

📸 *Gửi ảnh thuốc hoặc tài liệu y tế* — tôi sẽ nhận dạng và giải thích
💊 *Hỏi về bất kỳ loại thuốc nào* — tôi sẽ kiểm tra dữ liệu FDA
🩺 *Mô tả triệu chứng* — tôi sẽ hướng dẫn từng bước
🏥 *Tìm phòng khám miễn phí* — chỉ cần gửi mã ZIP

_Gửi tin nhắn, ảnh hoặc mã ZIP để bắt đầu!_`,

  ko: `🌟 *HealthBridge에 오신 것을 환영합니다* 🏥

WhatsApp에서 당신의 개인 건강 도우미입니다 — *당신의 언어*로 미국 의료 서비스를 안내합니다.

📸 *약이나 의료 문서 사진을 보내세요* — 식별하고 쉬운 말로 설명해드립니다
💊 *어떤 약이든 물어보세요* — FDA 기록을 확인합니다
🩺 *증상을 설명하세요* — 단계별로 안내합니다
🏥 *무료 클리닉 찾기* — ZIP 코드만 보내세요

_메시지, 사진 또는 ZIP 코드를 보내서 시작하세요!_`,

  tl: `🌟 *Maligayang pagdating sa HealthBridge* 🏥

Ako ang iyong personal na health companion sa WhatsApp — tumutulong sa healthcare sa US, sa *iyong wika*.

📸 *Magpadala ng larawan ng gamot o medical document* — i-identify ko at ipaliwanag sa simpleng salita
💊 *Magtanong tungkol sa anumang gamot* — susuriin ko ang FDA records
🩺 *Ilarawan ang iyong mga sintomas* — gagabayan kita hakbang-hakbang
🏥 *Maghanap ng libreng klinika* — ipadala lang ang iyong ZIP code

_Magpadala ng mensahe, larawan, o ZIP code para magsimula!_`,

  pt: `🌟 *Bem-vindo ao HealthBridge* 🏥

Sou seu assistente de saúde pessoal no WhatsApp — aqui para ajudar com saúde nos EUA, no *seu idioma*.

📸 *Envie foto de qualquer medicamento ou documento médico* — vou identificar e explicar em linguagem simples
💊 *Pergunte sobre qualquer medicamento* — verifico registros da FDA
🩺 *Descreva seus sintomas* — vou guiar passo a passo
🏥 *Encontre clínicas gratuitas* — envie seu CEP

_Envie uma mensagem, foto ou código postal para começar!_`,
};

export const UPLOAD_TIP: Partial<Record<Language, string>> = {
  en: `📎 *Quick tip for best results:*

Send images as a *file* instead of a photo — this prevents WhatsApp from compressing it.

How: Tap 📎 → *Document* → select your image → Send

This helps me read small text on prescriptions and labels accurately! ✅`,

  es: `📎 *Consejo rápido para mejores resultados:*

Envía imágenes como *archivo* en vez de foto — esto evita que WhatsApp las comprima.

Cómo: Toca 📎 → *Documento* → selecciona la imagen → Enviar

¡Esto me ayuda a leer texto pequeño en recetas y etiquetas! ✅`,
};

export const PROCESSING_MSG: Partial<Record<Language, string>> = {
  en: `🔍 *Analyzing your document...*\n\nI'm checking FDA databases and reading all the details. This takes a few seconds.`,
  es: `🔍 *Analizando tu documento...*\n\nEstoy verificando las bases de datos de la FDA y leyendo todos los detalles. Esto toma unos segundos.`,
  zh: `🔍 *正在分析您的文档...*\n\n正在查询FDA数据库和读取所有细节。这需要几秒钟。`,
};

export const RATE_LIMIT_MSG: Partial<Record<Language, string>> = {
  en: `⏳ You're sending messages really fast! Let me catch up. Try again in a minute.`,
  es: `⏳ ¡Estás enviando mensajes muy rápido! Déjame ponerme al día. Inténtalo de nuevo en un minuto.`,
};
