/**
 * Stabs Popup Controller
 */

import { testBotToken } from '../lib/telegram.js';
import { getDeviceIdentifier } from '../lib/device.js';

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const viewPanels = document.querySelectorAll('.view-panel');

// Overview Elements
const deviceDisplay = document.getElementById('device-display');
const targetDisplay = document.getElementById('target-display');
const lastSyncDisplay = document.getElementById('last-sync-display');
const scheduleDisplay = document.getElementById('schedule-display');
const statusMessageDisplay = document.getElementById('status-message-display');
const btnSyncNow = document.getElementById('btn-sync-now');
const syncFeedback = document.getElementById('sync-feedback');

// Restore Elements
const snapshotsList = document.getElementById('snapshots-list');
const importFileInput = document.getElementById('import-file-input');
const restoreFeedback = document.getElementById('restore-feedback');

// Header & Theme Elements
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Settings Elements
const settingsForm = document.getElementById('settings-form');
const inputDeviceName = document.getElementById('input-device-name');
const inputBotToken = document.getElementById('input-bot-token');
const inputChatId = document.getElementById('input-chat-id');
const inputTopicId = document.getElementById('input-topic-id');
const selectInterval = document.getElementById('select-interval');
const customIntervalGroup = document.getElementById('custom-interval-group');
const inputCustomInterval = document.getElementById('input-custom-interval');
const selectTheme = document.getElementById('select-theme');
const inputExcludedDomains = document.getElementById('input-excluded-domains');
const btnTestConnection = document.getElementById('btn-test-connection');
const settingsFeedback = document.getElementById('settings-feedback');

// Tab Switching
function switchTab(targetId) {
  tabBtns.forEach(btn => {
    const isActive = btn.id === targetId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const panelMap = {
    'tab-overview': 'view-overview',
    'tab-history': 'view-history',
    'tab-settings': 'view-settings'
  };

  const activePanelId = panelMap[targetId];
  viewPanels.forEach(panel => {
    if (panel.id === activePanelId) {
      panel.removeAttribute('hidden');
      panel.classList.add('active');
    } else {
      panel.setAttribute('hidden', '');
      panel.classList.remove('active');
    }
  });

  if (targetId === 'tab-history') {
    renderSnapshotsList();
  }
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.id));
});

// Format date helper
function formatDate(timestamp) {
  if (!timestamp) return 'Never';
  const d = new Date(timestamp);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Update Overview Data
async function refreshOverview() {
  const store = await chrome.storage.local.get([
    'botToken',
    'chatId',
    'topicId',
    'intervalMinutes',
    'lastSyncTime',
    'lastSyncStatus',
    'lastSyncError'
  ]);

  const device = await getDeviceIdentifier();
  deviceDisplay.textContent = device.deviceName || 'Browser';

  if (store.chatId) {
    targetDisplay.textContent = store.topicId
      ? `Chat ID: ${store.chatId} (#${store.topicId})`
      : `Chat ID: ${store.chatId}`;
  } else {
    targetDisplay.textContent = 'Not configured';
  }

  lastSyncDisplay.textContent = formatDate(store.lastSyncTime);

  const interval = Number(store.intervalMinutes !== undefined ? store.intervalMinutes : 30);
  if (interval === 0) {
    scheduleDisplay.textContent = 'Disabled (Manual only)';
  } else if (interval >= 60 && interval % 60 === 0) {
    const hours = interval / 60;
    scheduleDisplay.textContent = `Every ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    scheduleDisplay.textContent = `Every ${interval} min`;
  }

  if (store.lastSyncStatus === 'success') {
    statusMessageDisplay.textContent = 'Backup active';
    statusMessageDisplay.style.color = 'var(--color-success)';
  } else if (store.lastSyncStatus === 'skipped') {
    statusMessageDisplay.textContent = 'Unchanged (Diff skipped)';
    statusMessageDisplay.style.color = 'var(--text-secondary)';
  } else if (store.lastSyncStatus === 'error') {
    statusMessageDisplay.textContent = store.lastSyncError || 'Sync failed';
    statusMessageDisplay.style.color = 'var(--color-error)';
  } else {
    statusMessageDisplay.textContent = 'Idle';
    statusMessageDisplay.style.color = 'var(--text-muted)';
  }
}

// Sync Now Handler
btnSyncNow.addEventListener('click', async () => {
  btnSyncNow.disabled = true;
  btnSyncNow.textContent = 'Syncing...';
  syncFeedback.textContent = '';
  syncFeedback.className = 'feedback-text';

  try {
    const res = await chrome.runtime.sendMessage({ action: 'SYNC_NOW' });
    if (res && res.ok) {
      syncFeedback.textContent = `Backed up ${res.result.snapshot.meta.totalTabs} tabs to Telegram.`;
      syncFeedback.className = 'feedback-text success';
    } else {
      syncFeedback.textContent = res ? res.error : 'Sync failed.';
      syncFeedback.className = 'feedback-text error';
    }
  } catch (err) {
    syncFeedback.textContent = err.message || 'Error communicating with service worker.';
    syncFeedback.className = 'feedback-text error';
  } finally {
    btnSyncNow.disabled = false;
    btnSyncNow.textContent = 'Sync Now';
    await refreshOverview();
  }
});

// Render Snapshots for Restore
async function renderSnapshotsList() {
  const store = await chrome.storage.local.get('snapshots');
  const snapshots = store.snapshots || [];

  snapshotsList.replaceChildren();

  if (snapshots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No local snapshots saved yet. Click "Sync Now" to create one.';
    snapshotsList.appendChild(empty);
    return;
  }

  snapshots.forEach((snap, idx) => {
    const item = document.createElement('div');
    item.className = 'snapshot-item';

    const info = document.createElement('div');
    info.className = 'snapshot-info';

    const time = document.createElement('div');
    time.className = 'snapshot-time';
    time.textContent = formatDate(snap.timestamp);

    const details = document.createElement('div');
    details.className = 'snapshot-details';
    const deviceLabel = snap.device?.name ? `${snap.device.name} • ` : '';
    details.textContent = `${deviceLabel}${snap.meta.totalTabs} tabs in ${snap.meta.totalWindows} window(s)${snap.meta.totalGroups ? `, ${snap.meta.totalGroups} group(s)` : ''}`;

    info.appendChild(time);
    info.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'snapshot-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'secondary-btn btn-restore';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => handleRestoreSnapshot(snap, restoreBtn));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'secondary-btn btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.title = 'Delete this backup';
    deleteBtn.setAttribute('aria-label', `Delete backup from ${formatDate(snap.timestamp)}`);
    deleteBtn.addEventListener('click', () => handleDeleteSnapshot(snap, deleteBtn));

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(info);
    item.appendChild(actions);

    snapshotsList.appendChild(item);
  });
}

// Delete Snapshot Action with Inline Confirmation
let deleteConfirmTimeout = null;
async function handleDeleteSnapshot(snapshot, button) {
  if (button.dataset.confirming !== 'true') {
    button.dataset.confirming = 'true';
    button.textContent = 'Confirm?';
    button.classList.add('btn-delete-confirm');
    deleteConfirmTimeout = setTimeout(() => {
      button.dataset.confirming = 'false';
      button.textContent = 'Delete';
      button.classList.remove('btn-delete-confirm');
    }, 3000);
    return;
  }

  if (deleteConfirmTimeout) {
    clearTimeout(deleteConfirmTimeout);
  }
  button.disabled = true;
  button.textContent = 'Deleting...';
  restoreFeedback.textContent = '';
  restoreFeedback.className = 'feedback-text';

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'DELETE_SNAPSHOT',
      hash: snapshot.hash,
      timestamp: snapshot.timestamp,
      telegramMessageId: snapshot.telegramMessageId
    });

    if (res && res.ok) {
      restoreFeedback.textContent = `Deleted backup from ${formatDate(snapshot.timestamp)}.`;
      restoreFeedback.className = 'feedback-text success';
      await renderSnapshotsList();
    } else {
      restoreFeedback.textContent = res ? res.error : 'Failed to delete backup.';
      restoreFeedback.className = 'feedback-text error';
      button.disabled = false;
      button.textContent = 'Delete';
      button.dataset.confirming = 'false';
      button.classList.remove('btn-delete-confirm');
    }
  } catch (err) {
    restoreFeedback.textContent = err.message || 'Deletion failed.';
    restoreFeedback.className = 'feedback-text error';
    button.disabled = false;
    button.textContent = 'Delete';
    button.dataset.confirming = 'false';
    button.classList.remove('btn-delete-confirm');
  }
}

// Restore Snapshot Action
async function handleRestoreSnapshot(snapshot, button) {
  if (button) {
    button.disabled = true;
    button.textContent = 'Restoring...';
  }
  restoreFeedback.textContent = '';
  restoreFeedback.className = 'feedback-text';

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'RESTORE_SNAPSHOT',
      snapshot
    });

    if (res && res.ok) {
      const { restoredWindows, restoredTabs, restoredGroups } = res.result;
      restoreFeedback.textContent = `Restored ${restoredTabs} tabs across ${restoredWindows} window(s) (${restoredGroups} groups).`;
      restoreFeedback.className = 'feedback-text success';
    } else {
      restoreFeedback.textContent = res ? res.error : 'Failed to restore session.';
      restoreFeedback.className = 'feedback-text error';
    }
  } catch (err) {
    restoreFeedback.textContent = err.message || 'Restoration failed.';
    restoreFeedback.className = 'feedback-text error';
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Restore';
    }
  }
}

// Import JSON Backup File
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed.windows || !Array.isArray(parsed.windows)) {
        throw new Error('Invalid Stabs backup format: missing windows array.');
      }

      await handleRestoreSnapshot(parsed, null);

      // Save imported file to local snapshots list
      const store = await chrome.storage.local.get('snapshots');
      const existing = store.snapshots || [];
      const updated = [parsed, ...existing.filter(s => s.hash !== parsed.hash)].slice(0, 10);
      await chrome.storage.local.set({ snapshots: updated });
      await renderSnapshotsList();
    } catch (err) {
      restoreFeedback.textContent = `Import error: ${err.message}`;
      restoreFeedback.className = 'feedback-text error';
    } finally {
      importFileInput.value = '';
    }
  };

  reader.onerror = () => {
    restoreFeedback.textContent = 'Failed to read the selected file.';
    restoreFeedback.className = 'feedback-text error';
    importFileInput.value = '';
  };

  reader.readAsText(file);
});

// Theme Management
function getEffectiveTheme(preference) {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyTheme(preference) {
  const effective = getEffectiveTheme(preference);
  document.documentElement.setAttribute('data-theme', effective);
  if (themeIcon) {
    themeIcon.textContent = effective === 'dark' ? '☀️' : '🌙';
  }
  if (btnThemeToggle) {
    btnThemeToggle.setAttribute('aria-label', `Switch to ${effective === 'dark' ? 'light' : 'dark'} theme`);
    btnThemeToggle.setAttribute('title', `Switch to ${effective === 'dark' ? 'light' : 'dark'} theme`);
  }
  if (selectTheme) {
    selectTheme.value = preference || 'system';
  }
}

// Quick Header Theme Toggle Button
btnThemeToggle.addEventListener('click', async () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  await chrome.storage.local.set({ theme: nextTheme });
});

// Dropdown Theme Change in Settings
selectTheme.addEventListener('change', async () => {
  const selected = selectTheme.value;
  applyTheme(selected);
  await chrome.storage.local.set({ theme: selected });
});

// OS Color Scheme Listener
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const { theme = 'system' } = await chrome.storage.local.get('theme');
    if (theme === 'system') {
      applyTheme('system');
    }
  });
}

// Interval change listener for custom interval
selectInterval.addEventListener('change', () => {
  if (selectInterval.value === 'custom') {
    customIntervalGroup.removeAttribute('hidden');
    inputCustomInterval.focus();
  } else {
    customIntervalGroup.setAttribute('hidden', '');
  }
});

// Load Settings
async function loadSettings() {
  const store = await chrome.storage.local.get([
    'deviceName',
    'botToken',
    'chatId',
    'topicId',
    'intervalMinutes',
    'excludedDomains',
    'theme'
  ]);

  const device = await getDeviceIdentifier();
  inputDeviceName.value = store.deviceName || device.deviceName || '';
  inputBotToken.value = store.botToken || '';
  inputChatId.value = store.chatId || '';
  inputTopicId.value = store.topicId || '';

  const standardIntervals = [15, 30, 60, 240, 0];
  const interval = Number(store.intervalMinutes !== undefined ? store.intervalMinutes : 30);
  if (standardIntervals.includes(interval)) {
    selectInterval.value = String(interval);
    customIntervalGroup.setAttribute('hidden', '');
    inputCustomInterval.value = '';
  } else {
    selectInterval.value = 'custom';
    customIntervalGroup.removeAttribute('hidden');
    inputCustomInterval.value = String(interval);
  }

  selectTheme.value = store.theme || 'system';
  inputExcludedDomains.value = (store.excludedDomains || ['localhost', '127.0.0.1']).join(', ');

  applyTheme(store.theme || 'system');
}

// Test Connection Action
btnTestConnection.addEventListener('click', async () => {
  const token = inputBotToken.value.trim();
  if (!token) {
    settingsFeedback.textContent = 'Please enter a bot token to test.';
    settingsFeedback.className = 'feedback-text error';
    return;
  }

  btnTestConnection.disabled = true;
  btnTestConnection.textContent = 'Testing...';
  settingsFeedback.textContent = '';

  try {
    const res = await testBotToken(token);
    if (res.ok) {
      settingsFeedback.textContent = `Valid bot: @${res.bot.username} (${res.bot.first_name})`;
      settingsFeedback.className = 'feedback-text success';
    } else {
      settingsFeedback.textContent = `Validation failed: ${res.error}`;
      settingsFeedback.className = 'feedback-text error';
    }
  } catch (err) {
    settingsFeedback.textContent = `Connection test error: ${err.message}`;
    settingsFeedback.className = 'feedback-text error';
  } finally {
    btnTestConnection.disabled = false;
    btnTestConnection.textContent = 'Test Connection';
  }
});

// Save Settings Form
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const rawDeviceName = inputDeviceName.value.trim();
  const defaultDevice = await getDeviceIdentifier();
  const deviceName = rawDeviceName || defaultDevice.deviceName;

  const botToken = inputBotToken.value.trim();
  const chatId = inputChatId.value.trim();
  const topicId = inputTopicId.value.trim();

  let intervalMinutes;
  if (selectInterval.value === 'custom') {
    const parsed = parseInt(inputCustomInterval.value, 10);
    if (isNaN(parsed) || parsed < 1) {
      settingsFeedback.textContent = 'Please enter a valid custom interval in minutes (minimum 1 minute).';
      settingsFeedback.className = 'feedback-text error';
      inputCustomInterval.focus();
      return;
    }
    intervalMinutes = parsed;
  } else {
    intervalMinutes = Number(selectInterval.value);
  }

  const theme = selectTheme.value;
  const rawDomains = inputExcludedDomains.value.split(',');
  const excludedDomains = rawDomains.map(d => d.trim()).filter(Boolean);

  await chrome.storage.local.set({
    deviceName,
    botToken,
    chatId,
    topicId,
    intervalMinutes,
    excludedDomains,
    theme
  });

  applyTheme(theme);

  settingsFeedback.textContent = 'Settings saved successfully.';
  settingsFeedback.className = 'feedback-text success';

  await refreshOverview();
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await refreshOverview();
});
