/**
 * Stabs Telegram Client
 * Handles communication with Telegram Bot API directly from the browser extension.
 */

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Validates bot token and returns bot user info.
 * @param {string} token
 * @returns {Promise<{ ok: boolean, bot?: object, error?: string }>}
 */
export async function testBotToken(token) {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { ok: false, error: 'Token is empty' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, bot: data.result };
    }
    return { ok: false, error: data.description || 'Invalid token' };
  } catch (err) {
    return { ok: false, error: err.message || 'Network request failed' };
  }
}

/**
 * Formats a clean HTML summary caption for Telegram document (max 1024 characters).
 * @param {object} snapshot
 * @returns {string}
 */
export function formatSummaryCaption(snapshot) {
  const { meta, isoDate, windows, device } = snapshot;
  const dateStr = new Date(isoDate).toLocaleString();

  let header = `<b>Stabs Tab Backup</b>\n`;
  if (device && device.name) {
    header += `<b>Device:</b> ${escapeHtml(device.name)}\n`;
  }
  header += `<b>Saved:</b> ${escapeHtml(dateStr)}\n`;
  header += `<b>Windows:</b> ${meta.totalWindows} | <b>Tabs:</b> ${meta.totalTabs}\n`;
  if (meta.totalGroups > 0) {
    header += `<b>Groups:</b> ${meta.totalGroups} `;
  }
  if (meta.totalPinned > 0) {
    header += `| <b>Pinned:</b> ${meta.totalPinned}`;
  }
  header += `\n\n<b>Highlights:</b>\n`;

  const items = [];
  for (const win of windows) {
    for (const tab of win.tabs) {
      if (items.length < 4) {
        let title = (tab.title || tab.url).trim();
        if (title.length > 35) {
          title = `${title.slice(0, 32)}...`;
        }
        items.push(`• <a href="${escapeHtml(tab.url)}">${escapeHtml(title)}</a>`);
      }
    }
  }

  const remaining = meta.totalTabs - items.length;
  let footer = '';
  if (remaining > 0) {
    footer = `\n<i>...and ${remaining} more tabs in attached backup.</i>`;
  }

  let fullCaption = header + items.join('\n') + footer;

  // Strict safety bound for Telegram 1024 character limit
  if (fullCaption.length > 980) {
    while (items.length > 1 && (header + items.join('\n') + `\n<i>...and ${meta.totalTabs - items.length} more tabs in attached backup.</i>`).length > 980) {
      items.pop();
    }
    footer = `\n<i>...and ${meta.totalTabs - items.length} more tabs in attached backup.</i>`;
    fullCaption = header + items.join('\n') + footer;
  }

  return fullCaption;
}

/**
 * Formats full HTML summary message (kept for compatibility).
 * @param {object} snapshot
 * @returns {string}
 */
export function formatSummaryMessage(snapshot) {
  return formatSummaryCaption(snapshot);
}

/**
 * Sends a text message to Telegram.
 * @param {string} token
 * @param {string} chatId
 * @param {string} textHtml
 * @returns {Promise<object>}
 */
export async function sendTelegramMessage(token, chatId, textHtml) {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: cleanChatId,
      text: textHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram message');
  }
  return data.result;
}

/**
 * Sends snapshot JSON file as an attachment to Telegram with optional HTML caption.
 * @param {string} token
 * @param {string} chatId
 * @param {object} snapshot
 * @param {string} [captionHtml]
 * @returns {Promise<object>}
 */
export async function sendTelegramDocument(token, chatId, snapshot, captionHtml = '') {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  const jsonString = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const deviceSlug = (snapshot.device?.name || 'browser')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'browser';
  const timestampStr = new Date(snapshot.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `stabs-backup-${deviceSlug}-${timestampStr}.json`;

  const formData = new FormData();
  formData.append('chat_id', cleanChatId);
  formData.append('document', blob, filename);

  const deviceNote = snapshot.device?.name ? ` on ${snapshot.device.name}` : '';
  const caption = captionHtml || `Stabs session backup (${snapshot.meta.totalTabs} tabs${deviceNote})`;
  formData.append('caption', caption);
  if (captionHtml) {
    formData.append('parse_mode', 'HTML');
  }

  const url = `https://api.telegram.org/bot${cleanToken}/sendDocument`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram document');
  }
  return data.result;
}

/**
 * Executes a consolidated single-message backup sync to Telegram (Document with Summary Caption).
 * @param {string} token
 * @param {string} chatId
 * @param {object} snapshot
 * @returns {Promise<{ docResult: object }>}
 */
export async function syncSnapshotToTelegram(token, chatId, snapshot) {
  const captionHtml = formatSummaryCaption(snapshot);
  const docResult = await sendTelegramDocument(token, chatId, snapshot, captionHtml);
  return { docResult };
}
