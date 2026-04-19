<p align="center">
  <img src="https://img.shields.io/badge/HackPrinceton-Spring%202026-orange?style=for-the-badge" alt="HackPrinceton Spring 2026"/>
  <img src="https://img.shields.io/badge/Built%20in-36%20Hours-blueviolet?style=for-the-badge" alt="Built in 36 hours"/>
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp"/>
</p>

<h1 align="center">✚ HealthBridge</h1>
<h3 align="center"><em>Healthcare for Everyone — in Your Language, on WhatsApp</em></h3>

<p align="center">
  <strong>A WhatsApp-based healthcare assistant that delivers drug interaction checks, symptom triage, prescription translation, and safe clinic navigation — powered by deterministic federal data sources and AI explanation — in 9+ languages.</strong>
</p>

<p align="center">
  <a href="https://wa.me/19204895575">📱 Try on WhatsApp</a> •
  <a href="https://health-bridge-theta.vercel.app">🌐 Landing Page</a> •
  <a href="#demo">🎥 Demo</a> •
  <a href="#architecture">🏗️ Architecture</a>
</p>

---

## 🚨 The Problem

Two crises. Millions of people. Zero good solutions.

| Metric | Scale | Source |
|--------|-------|--------|
| **53M** caregivers managing medications for family members | Most have zero medical training to check drug interactions | AARP / NAC 2023 |
| **14,821** deaths annually from drug-drug interactions | Many preventable with basic interaction checking | FDA FAERS Database |
| **48%** of undocumented immigrants stopped seeking care | Fear of immigration enforcement at medical facilities | KFF Health Policy Survey 2025 |
| **25M+** limited-English speakers in the US | Cannot read prescriptions, navigate insurance, or call 911 | US Census Bureau |
| **1.3M** ER visits annually from adverse drug events | A simple lookup could prevent the majority | CDC |

### 💊 The Caregiver Crisis
- 72% manage 2+ medications with no system to check interactions
- 24 hours/week of average unpaid care with no dose-tracking tools
- Adverse drug events send 1.3M people to the ER annually

### 🌍 The Immigrant Access Crisis
- 48% stopped seeking care after January 2025 policy changes
- 25M+ people can't read English prescriptions or navigate the US healthcare system
- FQHCs (Federally Qualified Health Centers) serve everyone regardless of immigration status — but most families don't know they exist

---

## 💡 The Solution

**HealthBridge** is a WhatsApp chatbot that acts as a healthcare companion for immigrant families and caregivers. One message. No app download. No account. No insurance required. No immigration questions asked.

### ✨ Seven Features. One WhatsApp Number.

| Feature | How It Works | Data Source |
|---------|-------------|-------------|
| 🚨 **Emergency Override** | 911 dispatch in <50ms via keyword matching across 8 languages — no AI involved | Pure regex matching |
| 🔬 **Symptom Triage** | CDC protocol rule tree routes users to ER vs. urgent care vs. home care | CDC + NIH MedlinePlus |
| 💊 **Drug Interaction Scanner** | Queries real federal adverse event reports — "556 deaths" is a database lookup, not an AI guess | FDA FAERS (14M+ reports) |
| 📄 **Prescription Translator** | Send a photo → structured extraction in your language (dosage, frequency, warnings) | MedGemma 4B + K2 Think V2 |
| 🏥 **Safe Clinic Finder** | 1,400+ FQHCs with Haversine distance math — real addresses, not AI-generated ones | CMS Federal Dataset |
| ⏰ **Medication Reminders** | Caregiver escalation chain: missed dose → 30min alert → 60min family notification | Deterministic timer system |
| 🌐 **9+ Language Support** | Auto-detects language via Unicode script analysis + keyword detection | Zero-cost regex layer |

---

<a id="architecture"></a>
## 🏗️ Architecture — Not an AI Wrapper

> *"Ask ChatGPT if warfarin and aspirin are dangerous. It'll say 'they might be.' HealthBridge queries the FDA database and tells you 556 people died. That number is federal data — not a language model."*

### The Golden Rule
**Every critical health decision is made by rule engines and federal data. AI only explains what the system already knows.**

```
┌──────────┐    ┌──────────┐    ┌─────────┐    ┌───────────┐    ┌──────────────────┐
│ WhatsApp │───▶│ Security │───▶│  911?   │───▶│  Intent   │───▶│  Specialized     │
│ Message  │    │   Gate   │    │(regex)  │    │  Router   │    │  Handlers        │
└──────────┘    └──────────┘    └────┬────┘    └───────────┘    │                  │
                                     │ YES                      │ • Symptom Triage │
                                     ▼                          │ • Drug Scanner   │
                              ┌────────────┐                    │ • Rx Translator  │
                              │ 911 Direct │                    │ • Clinic Finder  │
                              │   <50ms    │                    │ • Reminders      │
                              └────────────┘                    └──────────────────┘
```

### What AI Does vs. What AI Does NOT Do

| ✅ AI Does | ❌ AI Does NOT |
|-----------|---------------|
| Translates messages between 9+ languages | Detect emergency keywords (pure regex) |
| Explains drug interactions in plain language | Look up drug interactions (FDA FAERS query) |
| Reads prescription images (MedGemma OCR) | Find safe clinics (CMS dataset + Haversine math) |
| Routes conversation intent | Check immigration-safe rights (static legal data) |
| Generates warm, culturally-sensitive explanations | Flag interaction severity (deterministic scoring) |

---

## 🧠 AI Stack

### Two-Model Architecture

| Model | Role | Why |
|-------|------|-----|
| **MedGemma 4B** ("The Eyes") | Medical image OCR — reads pill labels, prescription photos, packaging text | Google's model trained specifically on medical images. Handles 35+ language labels. Low temperature (0.1) for precise extraction. |
| **K2 Think V2** ("The Brain") | Reasoning engine — maps foreign drugs to US equivalents, generates explanations | MBZUAI's 70B-parameter reasoning model. Multi-step problem solving with transparency. |

**Why this split works:** MedGemma excels at visual perception accuracy (reading tiny text on blister packs). K2 Think V2 excels at reasoning depth (mapping Crocin → Paracetamol → Tylenol → safety warnings in Hindi with culturally relevant analogies). Neither alone is as good as both together.

### The "5-Year-Old Doctor" Standard

Every response must pass this test: **Could a grandmother in a village who's never seen a hospital understand this?**

| ❌ Too Clinical | ✅ HealthBridge Style |
|---|---|
| "Acetaminophen is an analgesic and antipyretic" | "Acetaminophen helps with two things: it makes pain go away and it brings down fever (when your body gets too hot from fighting germs)" |
| "Contraindicated in hepatic insufficiency" | "Don't take this if your liver is sick — your liver is like a filter that cleans your blood, and this medicine makes it work extra hard" |
| "Take 500mg PO q6h PRN" | "Take one pill every 6 hours when you need it (morning, noon, evening, bedtime — 4 times maximum)" |

---

## 🔒 Privacy & Security

HealthBridge is built for the most vulnerable users — privacy is not a policy, it's the architecture.

| Feature | Implementation |
|---------|---------------|
| 🔐 **Phone Hashing** | HMAC-SHA256 — raw phone numbers are never stored |
| 🗑️ **Zero PHI at Rest** | Prescription images processed in memory, deleted immediately |
| ✅ **Request Validation** | Twilio signature verification on every inbound webhook |
| 🏛️ **Federal Data Only** | CMS, FDA FAERS, NIH MedlinePlus, RxNorm — public, auditable, verifiable |
| 🚫 **No Accounts** | No registration, no login, no personal data collection |

---

## 🛠️ Tech Stack

### Backend (WhatsApp Bot)
| Technology | Purpose |
|-----------|---------|
| **TypeScript** | Type-safe backend logic |
| **Fastify** | High-performance HTTP server |
| **Baileys** | WhatsApp Web API client |
| **MedGemma 4B** | Medical image OCR via Google AI |
| **K2 Think V2** | Multi-step medical reasoning (MBZUAI) |
| **OpenFDA API** | Drug interaction verification |
| **Sharp** | Image processing pipeline |

### Landing Page
| Technology | Purpose |
|-----------|---------|
| **Vanilla HTML/CSS/JS** | Zero-dependency static site |
| **Three.js** | Interactive neural network hero + Earth globe |
| **Space Grotesk + Inter** | Typography system |

### Data Sources
| Source | Data | Records |
|--------|------|---------|
| FDA FAERS | Adverse drug event reports | 14M+ |
| CMS FQHC | Federally Qualified Health Centers | 1,400+ |
| NIH MedlinePlus | Medical conditions & treatments | — |
| RxNorm | Drug name normalization | — |
| CDC Protocols | Symptom triage decision trees | — |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
# Clone the repo
git clone https://github.com/preshack/healthbridge.git
cd healthbridge

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys:
#   K2_API_KEY=IFM-xxxxx
#   GOOGLE_AI_KEY=xxxxx

# Run development server
npm run dev
```

### Landing Page
```bash
# Clone the landing page
git clone https://github.com/sakshamXnp/health-bridge.git
cd health-bridge

# Serve locally (any static server works)
npx http-server . -p 8080

# Or deploy to Vercel
# Just import the repo — zero config needed
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `K2_API_KEY` | K2 Think V2 API key from MBZUAI |
| `GOOGLE_AI_KEY` | Google AI API key for MedGemma |

---

## 📱 Try It Now

**WhatsApp:** [+1 (920) 489-5575](https://wa.me/19204895575)

Send any of these to get started:
- `"My mom takes warfarin and just got aspirin prescribed"` → Drug interaction check
- `"chest pain"` → Emergency 911 dispatch (<50ms)
- `"No tengo seguro, ¿puedo ir al médico?"` → Safe clinic finder (in Spanish)
- 📸 *Send a prescription photo* → Instant translation in your language

---

<a id="demo"></a>
## 🎥 Demo Scenarios

### Emergency Override (<50ms)
```
User: "chest pain"
HealthBridge: 🚨 EMERGENCY DETECTED
  → Connecting to 911 immediately
  → Sharing approximate location
  → Response: 23ms | No AI processed | Pure keyword match
```

### Drug Interaction Check
```
User: "My mom takes warfarin and just got aspirin prescribed"
HealthBridge: 🚨 DRUG INTERACTION WARNING
  → Warfarin + Aspirin: 556 deaths in FDA FAERS reports
  → High severity bleeding risk
  → Action: Contact prescriber immediately
  → Source: FDA Federal Adverse Event Data
```

### Multilingual Prescription Translation
```
User: [sends photo of Indian Crocin 500mg box]
User: "यह दवा क्या है?"

HealthBridge (in Hindi):
→ यह Paracetamol 500mg है (अमेरिका में इसे Tylenol कहते हैं)
→ बिना डॉक्टर की पर्ची के मिल सकती है
→ Walmart पर $3 में 100 गोलियाँ मिलती हैं
→ ⚠️ शराब के साथ न लें — आपका लीवर वॉशिंग मशीन जैसा है...
```

---

## 🏆 HackPrinceton 2026 Tracks

| Track | Relevance |
|-------|-----------|
| 🏥 **Healthcare Innovation** | End-to-end WhatsApp health system for underserved communities |
| 🧬 **Regeneron Clinical Trials** | Drug interaction pipeline using FDA FAERS real-world evidence (14M+ reports) |
| 🤖 **Eragon Internal Agents** | Multi-agent architecture: security gate → intent classifier → specialized handlers |
| 📊 **Sonar Code Quality** | Clean TypeScript architecture, typed interfaces, comprehensive error handling |

---

## 📁 Project Structure

```
healthbridge/                    # Backend (WhatsApp Bot)
├── src/
│   ├── test-server.ts          # Fastify server entry point
│   ├── webhook.ts              # WhatsApp webhook handler
│   ├── prompts.ts              # AI prompt engineering
│   ├── data/                   # Federal data sources
│   ├── flows/                  # Conversation flow handlers
│   ├── services/               # External API integrations
│   └── types/                  # TypeScript type definitions
├── package.json
├── tsconfig.json
├── PROMPT_ENGINEERING.md       # Detailed prompt design documentation
└── README.md

health-bridge/                   # Landing Page
├── index.html                  # Single-page static site
├── earth-day.jpg               # Globe texture
├── earth-bump.png              # Globe bump map
├── earth-specular.png          # Globe specular map
└── README.md
```

---

## 👥 Team

| Member | Role | GitHub |
|--------|------|--------|
| **Preshak Bhattarai** | Backend Lead — WhatsApp bot, AI pipeline, Federal data integration | [@preshack](https://github.com/preshack) |
| **Saksham** | Frontend Lead — Landing page, UI/UX design, deployment | [@sakshamXnp](https://github.com/sakshamXnp) |

---

## 📄 License

Built with ❤️ at HackPrinceton Spring 2026.

---

<p align="center">
  <strong>One WhatsApp message away from healthcare that speaks your language.</strong>
  <br/>
  <a href="https://wa.me/19204895575">📱 Try HealthBridge Now</a>
</p>
