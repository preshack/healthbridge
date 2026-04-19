// ...existing code with secrets removed and using environment variables...
// src/services/vision.ts
// Sharp preprocessing + Gemma OCR via OpenRouter
import axios from 'axios';
import sharp from 'sharp';

import { Language, VisionResult } from '../types/index.js';

export async function processImage(
  buffer: Buffer,
  _mimeType: string,
  language: Language
): Promise<VisionResult> {
  const hfEndpoint = (process.env.HF_ENDPOINT || 'https://rz4jkue1a8x8i8nh.eu-west-1.aws.endpoints.huggingface.cloud').trim();
  const hfToken = (process.env.HF_TOKEN || '').trim();
  const koncileApiUrl = (process.env.KONCILE_API_URL || 'https://api.koncile.ai').trim();
  const koncileApiKey = (process.env.KONCILE_API_KEY || '').trim();

  // Always resize before Hugging Face â€” JSON payload limits can block full 4K PNGs.
  // This resolves the HTTP 500 Error scale issues and greatly speeds up the request.
  const processedImage = await sharp(buffer)
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Prefer Koncile when configured. It uses async task processing designed for document extraction.
  if (koncileApiKey) {
    try {
      const koncileResult = await processWithKoncile(processedImage, koncileApiUrl, koncileApiKey);
      return koncileResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Vision] Koncile processing failed:', msg);
      // If Koncile is configured, do not fall back to HF endpoint.
      // This avoids extra latency/noise when HF is known to be unhealthy.
      return { text: '', confidence: 0, source: 'cloud_vision' };
    }
  }

  try {
    const result = await callHuggingFace(processedImage, language, hfEndpoint, hfToken);
    if (result.confidence >= 0.5) return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Vision] HF Endpoint failed:', msg);
  }

  // Fallback â€” return raw with low confidence
  return { text: '', confidence: 0, source: 'cloud_vision' };
}

async function processWithKoncile(
  imageBuffer: Buffer,
  koncileApiUrl: string,
  koncileApiKey: string
): Promise<VisionResult> {
  const form = new FormData();
  form.append('files', new Blob([imageBuffer], { type: 'image/jpeg' }), 'healthbridge.jpg');

  const uploadRes = await fetch(`${koncileApiUrl}/v1/upload_file/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${koncileApiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(15000),
  });

  const uploadText = await uploadRes.text();
  let uploadData: any = {};
  try {
    uploadData = JSON.parse(uploadText);
  } catch {
    uploadData = {};
  }

  if (!uploadRes.ok) {
    throw new Error(`Koncile upload failed (${uploadRes.status}): ${uploadText.slice(0, 300)}`);
  }

  const taskId: string | undefined =
    uploadData?.task_ids?.[0] || uploadData?.task_id || uploadData?.id;

  if (!taskId) {
    throw new Error(`Koncile upload returned no task id: ${uploadText.slice(0, 300)}`);
  }

  const taskResult = await pollKoncileTask(taskId, koncileApiUrl, koncileApiKey);
  const status = String(taskResult?.status || taskResult?.task_status || '').toUpperCase();
  if (status !== 'DONE' && status !== 'DUPLICATE') {
    throw new Error(`Koncile task did not complete: ${status || 'UNKNOWN'}`);
  }

  const payload =
    taskResult?.result ||
    taskResult?.data ||
    taskResult;
  const generalFields = payload?.General_fields || payload?.general_fields || {};
  const lineFields = payload?.Line_fields || payload?.line_fields || {};

  const textChunks: string[] = [];
  for (const [key, value] of Object.entries(generalFields)) {
    const fieldValue = (value as any)?.value ?? value;
    if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim()) {
      textChunks.push(`${key}: ${String(fieldValue)}`);
    }
  }
  for (const [key, arr] of Object.entries(lineFields)) {
    if (Array.isArray(arr)) {
      const vals = arr
        .map((item: any) => item?.value)
        .filter((v: any) => v !== undefined && v !== null && String(v).trim())
        .map((v: any) => String(v));
      if (vals.length) textChunks.push(`${key}: ${vals.join(', ')}`);
    }
  }

  const text = textChunks.join('\n').trim();
  const documentType = text ? await classifyDocument(text) : 'other';

  return {
    text,
    confidence: text ? 0.75 : 0.4,
    source: 'cloud_vision',
    structured: {
      documentType: (documentType as any),
      warnings: [],
      instructions: [],
      medications: [],
    },
  };
}

async function pollKoncileTask(taskId: string, koncileApiUrl: string, koncileApiKey: string): Promise<any> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const endpoints = [
      `${koncileApiUrl}/v1/fetch_tasks_results/?task_id=${encodeURIComponent(taskId)}`,
      `${koncileApiUrl}/tasks/${encodeURIComponent(taskId)}/`,
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${koncileApiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      const txt = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(txt);
      } catch {
        data = {};
      }

      // Try alternate endpoint if one variant is 404; fail for other hard errors.
      if (res.status === 404) continue;
      if (!res.ok) {
        throw new Error(`Koncile fetch task failed (${res.status}): ${txt.slice(0, 300)}`);
      }

      const status = String(data?.status || data?.task_status || '').toUpperCase();
      if (status === 'DONE' || status === 'DUPLICATE' || status === 'FAILED') return data;
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(`Koncile task timeout for task_id=${taskId}`);
}

async function callHuggingFace(
  imageBuffer: Buffer,
  _language: Language,
  hfEndpoint: string,
  hfToken: string
): Promise<VisionResult> {
  if (!hfToken) {
    throw new Error('HF_TOKEN is not configured');
  }

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  
  const promptText = `Analyze this medical document. Return ONLY this JSON:
{
  "documentType": "prescription|discharge|eob|lab_result|other",
  "confidence": 0.0-1.0,
  "rawText": "complete verbatim text from document",
  "medications": [
    {
      "name": "exact drug name as written",
      "dose": "e.g. 500mg",
      "frequency": "e.g. twice daily",
      "withFood": true or false or null,
      "duration": "e.g. 7 days or null",
      "purpose": "what this treats if stated or null"
    }
  ],
  "prescriber": "doctor name or null",
  "followUpDate": "date string or null",
  "warnings": ["any warnings listed"],
  "instructions": ["any non-medication instructions"]
}`;

  const hfInput = `![](${dataUrl}) ${promptText.replace(/\n/g, ' ')}`;

  const data = await postToHfWithRetry(hfInput, hfEndpoint, hfToken);

  const content = Array.isArray(data)
    ? data[0]?.generated_text || ''
    : data?.generated_text
      || data?.output_text
      || data?.choices?.[0]?.message?.content
      || '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If it doesn't return JSON, at least return the raw text extracted
    return { text: content, confidence: 0.5, source: 'cloud_vision' };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    // If the 198 token limit truncated the JSON, fall back to raw text so K2 can read it
    return { text: content, confidence: 0.5, source: 'cloud_vision' };
  }

  return {
    text: parsed.rawText || '',
    confidence: parsed.confidence || 0.5,
    source: 'cloud_vision',
    structured: {
      medications: parsed.medications || [],
      documentType: parsed.documentType,
      followUpDate: parsed.followUpDate,
      prescriber: parsed.prescriber,
      warnings: parsed.warnings || [],
      instructions: parsed.instructions || [],
    }
  };
}

async function postToHfWithRetry(hfInput: string, hfEndpoint: string, hfToken: string): Promise<any> {
  const payload = {
    inputs: hfInput,
    parameters: {
      top_k: -1,
      max_new_tokens: 140,
      temperature: 0.1
    }
  };

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${hfToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await axios.post(hfEndpoint, payload, { headers, timeout: 18000 });
    if (res.data?.error) throw new Error(String(res.data.error));
    return res.data;
  } catch (err: any) {
    const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''));
    if (!isTimeout) throw err;
    const retryRes = await axios.post(hfEndpoint, payload, { headers, timeout: 12000 });
    if (retryRes.data?.error) throw new Error(String(retryRes.data.error));
    return retryRes.data;
  }
}
// PDF handler â€” try text extraction first, Vision as fallback
export async function processPDF(buffer: Buffer): Promise<VisionResult> {
  try {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    if (data.text.trim().length > 50) {
      // Searchable PDF â€” perfect text, zero API cost
      return { text: data.text, confidence: 0.99, source: 'cloud_vision' };
    }
  } catch {}
  // Scanned PDF â€” can't process without Vision
  return { text: '', confidence: 0, source: 'cloud_vision' };
}

// Classify document type from text
export async function classifyDocument(text: string): Promise<string> {
  const lower = text.toLowerCase();
  if (lower.includes('rx') || lower.includes('prescri') || lower.includes('dispense') || lower.includes('refill')) {
    return 'prescription';
  }
  if (lower.includes('discharge') || lower.includes('admitted') || lower.includes('follow-up')) {
    return 'discharge';
  }
  if (lower.includes('explanation of benefits') || lower.includes('eob') || lower.includes('amount billed')) {
    return 'eob';
  }
  if (lower.includes('lab result') || lower.includes('specimen') || lower.includes('reference range')) {
    return 'lab_result';
  }
  return 'other';
}


