/**
 * Stabs Background Service Worker (Manifest V3)
 * Manages periodic alarms, diff detection, and Telegram synchronization.
 */

import { captureSnapshot } from '../lib/snapshot.js';
import { syncSnapshotToTelegram, deleteTelegramMessage } from '../lib/telegram.js';
import { restoreSession } from '../lib/restorer.js';
import { getDeviceIdentifier } from '../lib/device.js';

const ALARM_NAME = 'STABS_PERIODIC_ALARM';
const MAX_LOCAL_SNAPSHOTS = 10;

// Setup or reconfigure alarms based on stored interval
async function configureAlarm(intervalMinutes) {
  await chrome.alarms.clear(ALARM_NAME);
  const minutes = Math.max(1, Math.round(Number(intervalMinutes) || 0));
  if (intervalMinutes && Number(intervalMinutes) > 0) {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: minutes,
      delayInMinutes: minutes
    });
    console.log(`[Stabs] Alarm scheduled every ${minutes} minutes.`);
  } else {
    console.log('[Stabs] Periodic backup is disabled.');
  }
}

// Executes backup process with diff checking
async function runBackupProcess({ isManual = false } = {}) {
  const store = await chrome.storage.local.get([
    'botToken',
    'chatId',
    'topicId',
    'intervalMinutes',
    'excludedDomains',
    'lastSyncHash',
    'snapshots'
  ]);

  const { botToken, chatId, topicId, excludedDomains = [], lastSyncHash, snapshots = [] } = store;

  if (!botToken || !chatId) {
    const errorMsg = 'Telegram bot token or chat ID is not configured.';
    await chrome.storage.local.set({
      lastSyncStatus: 'unconfigured',
      lastSyncError: errorMsg,
      lastCheckedTime: Date.now()
    });
    if (isManual) {
      throw new Error(errorMsg);
    }
    return { status: 'unconfigured', message: errorMsg };
  }

  // Capture current session
  const snapshot = await captureSnapshot({ excludedDomains });

  if (snapshot.meta.totalTabs === 0) {
    await chrome.storage.local.set({
      lastSyncStatus: 'empty',
      lastSyncError: 'No tabs found matching criteria',
      lastCheckedTime: Date.now()
    });
    return { status: 'empty', message: 'No tabs to preserve.' };
  }

  // Diff detection: skip if unchanged and not manual
  if (!isManual && lastSyncHash && snapshot.hash === lastSyncHash) {
    console.log('[Stabs] Tab state unchanged. Skipping Telegram message to prevent spam.');
    await chrome.storage.local.set({
      lastSyncStatus: 'skipped',
      lastSyncError: null,
      lastCheckedTime: Date.now()
    });
    return { status: 'skipped', message: 'Tabs unchanged since last backup.' };
  }

  try {
    // Deliver hybrid backup to Telegram
    const { docResult } = await syncSnapshotToTelegram(botToken, chatId, snapshot, topicId);
    if (docResult && docResult.message_id) {
      snapshot.telegramMessageId = docResult.message_id;
    }

    // Save snapshot in local history
    const updatedSnapshots = [snapshot, ...snapshots.filter(s => s.hash !== snapshot.hash)].slice(0, MAX_LOCAL_SNAPSHOTS);

    await chrome.storage.local.set({
      lastSyncTime: snapshot.timestamp,
      lastCheckedTime: snapshot.timestamp,
      lastSyncHash: snapshot.hash,
      lastSyncStatus: 'success',
      lastSyncError: null,
      snapshots: updatedSnapshots
    });

    // Brief badge feedback
    await chrome.action.setBadgeText({ text: '✓' });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(async () => {
      await chrome.action.setBadgeText({ text: '' });
    }, 4000);

    return { status: 'success', snapshot };
  } catch (err) {
    console.error('[Stabs] Backup failed:', err);
    await chrome.storage.local.set({
      lastSyncStatus: 'error',
      lastSyncError: err.message || 'Unknown network error',
      lastCheckedTime: Date.now()
    });

    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

    if (isManual) {
      throw err;
    }
    return { status: 'error', error: err.message };
  }
}

// Lifecycle: Install & Update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Stabs] Extension installed or updated:', details.reason);
  const defaults = {
    intervalMinutes: 30,
    excludedDomains: ['localhost', '127.0.0.1'],
    snapshots: []
  };

  const current = await chrome.storage.local.get(Object.keys(defaults));
  const toSet = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (current[k] === undefined) {
      toSet[k] = v;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  await getDeviceIdentifier();

  const { intervalMinutes } = await chrome.storage.local.get('intervalMinutes');
  await configureAlarm(intervalMinutes || 30);
});

// Lifecycle: Service worker startup
chrome.runtime.onStartup.addListener(async () => {
  const { intervalMinutes } = await chrome.storage.local.get('intervalMinutes');
  await configureAlarm(intervalMinutes || 30);
});

// Listen to Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Stabs] Alarm triggered periodic backup...');
    await runBackupProcess({ isManual: false });
  }
});

// Watch for interval setting changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.intervalMinutes) {
    configureAlarm(changes.intervalMinutes.newValue);
  }
});

// Message Passing API
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SYNC_NOW') {
    runBackupProcess({ isManual: true })
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'RESTORE_SNAPSHOT') {
    restoreSession(message.snapshot)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'DELETE_SNAPSHOT') {
    (async () => {
      try {
        const store = await chrome.storage.local.get(['snapshots', 'lastSyncHash', 'botToken', 'chatId']);
        const snapshots = store.snapshots || [];
        const targetHash = message.hash;
        const targetTimestamp = message.timestamp;

        const targetSnapshot = snapshots.find(s => (targetHash && s.hash === targetHash) || (targetTimestamp && s.timestamp === targetTimestamp));

        const updatedSnapshots = snapshots.filter(s => {
          if (targetHash && s.hash) {
            return s.hash !== targetHash;
          }
          return s.timestamp !== targetTimestamp;
        });

        const updates = { snapshots: updatedSnapshots };
        if (store.lastSyncHash && targetSnapshot && targetSnapshot.hash === store.lastSyncHash) {
          updates.lastSyncHash = updatedSnapshots.length > 0 ? updatedSnapshots[0].hash : null;
        }

        await chrome.storage.local.set(updates);

        if (store.botToken && store.chatId && (message.telegramMessageId || targetSnapshot?.telegramMessageId)) {
          const msgId = message.telegramMessageId || targetSnapshot?.telegramMessageId;
          await deleteTelegramMessage(store.botToken, store.chatId, msgId);
        }

        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'GET_STATUS') {
    (async () => {
      const alarm = await chrome.alarms.get(ALARM_NAME);
      const store = await chrome.storage.local.get([
        'lastSyncTime',
        'lastCheckedTime',
        'lastSyncStatus',
        'lastSyncError',
        'botToken',
        'chatId',
        'snapshots'
      ]);
      sendResponse({
        ok: true,
        alarmNext: alarm ? alarm.scheduledTime : null,
        data: store
      });
    })();
    return true;
  }

  return false;
});
