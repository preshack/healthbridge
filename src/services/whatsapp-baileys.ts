import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';

let sock: any;
let qrCode: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
let reconnectTimer: NodeJS.Timeout | null = null;
let isStarting = false;
let activeGeneration = 0;
const mediaLogger = P({ level: 'silent' });

function cleanupSocketListeners() {
  if (!sock) return;
  try { sock.ev?.removeAllListeners?.('connection.update'); } catch {}
  try { sock.ev?.removeAllListeners?.('creds.update'); } catch {}
  try { sock.ev?.removeAllListeners?.('messages.upsert'); } catch {}
}

function scheduleReconnect(
  handleMessage: (from: string, text: string, media?: { type: string; buffer: Buffer; mimeType: string } | null) => Promise<void>
) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startWhatsAppBot(handleMessage);
  }, 5000);
}

export async function startWhatsAppBot(
  handleMessage: (from: string, text: string, media?: { type: string; buffer: Buffer; mimeType: string } | null) => Promise<void>
) {
  if (isStarting) return sock;
  isStarting = true;
  const generation = ++activeGeneration;
  connectionStatus = 'connecting';

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  cleanupSocketListeners();
  if (sock?.ws?.readyState === 1) {
    try { sock.ws.close(); } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state,
    browser: ['HealthBridge', 'Desktop', '1.0.0'],
  });

  isStarting = false;

  sock.ev.on('connection.update', (update: any) => {
    if (generation !== activeGeneration) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      console.log('\n[WhatsApp] QR code generated. Scan with Linked Devices or open /qr');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.connectionReplaced &&
        statusCode !== DisconnectReason.multideviceMismatch;

      const reasonName =
        Object.keys(DisconnectReason).find((k) => (DisconnectReason as any)[k] === statusCode) || 'unknown';

      console.log(`[WhatsApp] Connection closed (${reasonName}/${statusCode ?? 'n/a'}), reconnecting: ${shouldReconnect}`);
      connectionStatus = 'disconnected';
      qrCode = null;

      if (shouldReconnect) scheduleReconnect(handleMessage);
      return;
    }

    if (connection === 'open') {
      console.log('[WhatsApp] Connected. Bot active on:', sock.user?.id);
      connectionStatus = 'connected';
      qrCode = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m: any) => {
    if (generation !== activeGeneration) return;

    const msg = m.messages[0];
    if (!msg) return;

    console.log(`[DEBUG] Received message event. Type: ${m.type}, fromMe: ${msg.key.fromMe}`);
    if (msg.message) {
      console.log('[DEBUG] Keys in raw msg.message:', Object.keys(msg.message));
    }

    if (!msg.key.fromMe && (m.type === 'notify' || m.type === 'append')) {
      const from = msg.key.remoteJid!;
      if (from.endsWith('@g.us') || from.endsWith('@newsletter') || from.endsWith('status@broadcast')) return;

      const content =
        msg.message?.ephemeralMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessage?.message ||
        msg.message;

      if (content) {
        console.log('[DEBUG] Keys in normalized content:', Object.keys(content));
      }

      let text = '';
      let media: { type: string; buffer: Buffer; mimeType: string } | null = null;

      if (content?.conversation) {
        text = content.conversation;
      } else if (content?.extendedTextMessage?.text) {
        text = content.extendedTextMessage.text;
      } else if (content?.imageMessage) {
        text = content.imageMessage.caption || '';
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: mediaLogger, reuploadRequest: sock.updateMediaMessage }
          );
          media = { type: 'image', buffer: buffer as Buffer, mimeType: content.imageMessage.mimetype || 'image/jpeg' };
        } catch (err) {
          console.error('[Media] Failed to download image:', err);
        }
      } else if (content?.documentMessage) {
        text = content.documentMessage.caption || '';
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: mediaLogger, reuploadRequest: sock.updateMediaMessage }
          );
          media = { type: 'document', buffer: buffer as Buffer, mimeType: content.documentMessage.mimetype || 'application/pdf' };
        } catch (err) {
          console.error('[Media] Failed to download document:', err);
        }
      }

      if (!text && !media) {
        console.log('[DEBUG] Unsupported/empty inbound message shape, skipping reply.');
      }

      console.log(`Message from ${from}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}${media ? ` [${media.type}]` : ''}`);
      await handleMessage(from, text, media);
    }
  });

  return sock;
}

export async function sendMessage(to: string, text: string) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp not connected');
  }
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export function getQRCode(): string | null {
  return qrCode;
}

export function getConnectionStatus() {
  return { status: connectionStatus, user: sock?.user };
}
