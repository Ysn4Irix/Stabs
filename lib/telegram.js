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
 * Sanitizes a device name into a valid alphanumeric Telegram hashtag.
 * @param {string} name
 * @returns {string}
 */
export function generateDeviceHashtag(name) {
  if (!name) return '#device_default';
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? `#device_${slug}` : '#device_default';
}

/**
 * Generates platform and browser tags for caption searchability.
 * @param {string} browser
 * @param {string} os
 * @returns {string}
 */
export function generatePlatformHashtags(browser = '', os = '') {
  const tags = [];
  if (browser) {
    const bSlug = browser.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (bSlug) tags.push(`#browser_${bSlug}`);
  }
  if (os) {
    const osSlug = os.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (osSlug) tags.push(`#os_${osSlug}`);
  }
  return tags.join(' ');
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

  const deviceTag = generateDeviceHashtag(device?.name);
  const platformTags = generatePlatformHashtags(device?.browser, device?.os);
  const tagLine = `\n\n#stabs ${deviceTag} ${platformTags}`.trimEnd();

  let fullCaption = header + items.join('\n') + footer + tagLine;

  // Strict safety bound for Telegram 1024 character limit
  if (fullCaption.length > 980) {
    while (items.length > 1 && (header + items.join('\n') + `\n<i>...and ${meta.totalTabs - items.length} more tabs in attached backup.</i>` + tagLine).length > 980) {
      items.pop();
    }
    footer = `\n<i>...and ${meta.totalTabs - items.length} more tabs in attached backup.</i>`;
    fullCaption = header + items.join('\n') + footer + tagLine;
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
 * Sends a text message to Telegram with optional forum topic support.
 * @param {string} token
 * @param {string} chatId
 * @param {string} textHtml
 * @param {string|number|null} [topicId]
 * @returns {Promise<object>}
 */
export async function sendTelegramMessage(token, chatId, textHtml, topicId = null) {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  const cleanTopicId = topicId ? String(topicId).trim() : null;

  async function postMessage(targetThreadId) {
    const payload = {
      chat_id: cleanChatId,
      text: textHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (targetThreadId) {
      payload.message_thread_id = Number(targetThreadId);
    }

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  let data = await postMessage(cleanTopicId);

  // Fallback to main chat if topic ID is not found or deleted
  if (!data.ok && cleanTopicId && String(data.description || '').toLowerCase().includes('thread not found')) {
    console.warn(`[Stabs] Topic ID ${cleanTopicId} not found or deleted. Falling back to general chat.`);
    data = await postMessage(null);
  }

  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram message');
  }
  return data.result;
}

/**
 * Sends snapshot JSON file as an attachment to Telegram with optional HTML caption and topic thread support.
 * @param {string} token
 * @param {string} chatId
 * @param {object} snapshot
 * @param {string} [captionHtml]
 * @param {string|number|null} [topicId]
 * @returns {Promise<object>}
 */
export async function sendTelegramDocument(token, chatId, snapshot, captionHtml = '', topicId = null) {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  const cleanTopicId = topicId ? String(topicId).trim() : null;

  const jsonString = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const deviceSlug = (snapshot.device?.name || 'browser')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'browser';
  const timestampStr = new Date(snapshot.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `stabs-backup-${deviceSlug}-${timestampStr}.json`;

  const deviceNote = snapshot.device?.name ? ` on ${snapshot.device.name}` : '';
  const caption = captionHtml || `Stabs session backup (${snapshot.meta.totalTabs} tabs${deviceNote})`;

  async function postDocument(targetThreadId) {
    const formData = new FormData();
    formData.append('chat_id', cleanChatId);
    formData.append('document', blob, filename);
    formData.append('caption', caption);
    if (captionHtml) {
      formData.append('parse_mode', 'HTML');
    }
    if (targetThreadId) {
      formData.append('message_thread_id', String(targetThreadId));
    }

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }

  let data = await postDocument(cleanTopicId);

  // Fallback to main chat if topic ID is not found or deleted
  if (!data.ok && cleanTopicId && String(data.description || '').toLowerCase().includes('thread not found')) {
    console.warn(`[Stabs] Topic ID ${cleanTopicId} not found or deleted. Falling back to general chat.`);
    data = await postDocument(null);
  }

  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram document');
  }
  return data.result;
}

/**
 * Executes a consolidated single-message backup sync to Telegram (Document with Summary Caption and Topic support).
 * @param {string} token
 * @param {string} chatId
 * @param {object} snapshot
 * @param {string|number|null} [topicId]
 * @returns {Promise<{ docResult: object }>}
 */
export async function syncSnapshotToTelegram(token, chatId, snapshot, topicId = null) {
  const captionHtml = formatSummaryCaption(snapshot);
  const docResult = await sendTelegramDocument(token, chatId, snapshot, captionHtml, topicId);
  return { docResult };
}
