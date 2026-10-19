/**
 * Stabs Snapshot Extractor
 * Extracts open windows, tabs, and tab groups into a clean structured snapshot.
 */

import { getDeviceIdentifier } from './device.js';

const INTERNAL_SCHEMES = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'view-source:'];

/**
 * Checks if a URL matches excluded internal schemes or user-defined domain rules.
 * @param {string} urlString
 * @param {string[]} excludedDomains
 * @returns {boolean}
 */
export function isUrlExcluded(urlString, excludedDomains = []) {
  if (!urlString) return true;

  try {
    const parsed = new URL(urlString);
    if (INTERNAL_SCHEMES.includes(parsed.protocol)) {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();
    for (const rule of excludedDomains) {
      const cleanRule = rule.trim().toLowerCase();
      if (!cleanRule) continue;

      if (cleanRule.startsWith('*.')) {
        const rootDomain = cleanRule.slice(2);
        if (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)) {
          return true;
        }
      } else if (hostname === cleanRule || hostname.endsWith(`.${cleanRule}`)) {
        return true;
      }
    }
  } catch {
    return true;
  }

  return false;
}

/**
 * Computes a SHA-256 hash string from snapshot tab data.
 * @param {object} snapshot
 * @returns {Promise<string>}
 */
export async function computeSnapshotHash(snapshot) {
  const parts = [];
  for (const win of snapshot.windows) {
    for (const tab of win.tabs) {
      parts.push(`${tab.pinned ? '1' : '0'}|${tab.groupId || '-1'}|${tab.url}`);
    }
  }

  const payload = parts.join('\n');
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Captures all open non-incognito windows, groups, and tabs.
 * @param {object} options
 * @param {string[]} [options.excludedDomains]
 * @returns {Promise<object>}
 */
export async function captureSnapshot(options = {}) {
  const excludedDomains = options.excludedDomains || [];
  const device = options.device || (await getDeviceIdentifier());
  const isAndroid = device.os === 'Android';

  let windows = [];

  if (isAndroid) {
    // Android browsers (Quetta, Kiwi, Lemur, etc.) operate as a single mobile window.
    // In Quetta and mobile Chromium builds, chrome.windows.getAll is known to report
    // phantom duplicate windows repeating all open tabs (e.g. 19 windows with 19 tabs = 361 tabs).
    // On Android, always query chrome.tabs directly.
    try {
      if (chrome.tabs && typeof chrome.tabs.query === 'function') {
        const allTabs = await chrome.tabs.query({});
        if (allTabs && allTabs.length > 0) {
          windows = [{
            id: 1,
            focused: true,
            state: 'normal',
            incognito: false,
            tabs: allTabs
          }];
        }
      }
    } catch (tabErr) {
      console.warn('[Stabs] chrome.tabs.query failed on Android:', tabErr);
      windows = [];
    }
  } else {
    // Desktop browsers: query all normal windows with their tabs
    try {
      if (chrome.windows && typeof chrome.windows.getAll === 'function') {
        windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
      }
    } catch (winErr) {
      console.warn('[Stabs] chrome.windows.getAll failed or unavailable:', winErr);
    }

    // Fallback if chrome.windows returned empty or threw
    if (!windows || windows.length === 0) {
      try {
        if (chrome.tabs && typeof chrome.tabs.query === 'function') {
          const allTabs = await chrome.tabs.query({});
          if (allTabs && allTabs.length > 0) {
            windows = [{
              id: 1,
              focused: true,
              state: 'normal',
              incognito: false,
              tabs: allTabs
            }];
          }
        }
      } catch (tabErr) {
        console.warn('[Stabs] chrome.tabs.query fallback failed:', tabErr);
        windows = [];
      }
    }
  }

  // Query tab groups if available
  let tabGroups = [];
  try {
    if (chrome.tabGroups) {
      tabGroups = await chrome.tabGroups.query({});
    }
  } catch (err) {
    console.warn('Could not query tab groups:', err);
  }

  const groupsMap = new Map();
  for (const g of tabGroups) {
    groupsMap.set(g.id, {
      id: g.id,
      title: g.title || '',
      color: g.color || 'grey',
      collapsed: Boolean(g.collapsed)
    });
  }

  const snapshotWindows = [];
  let totalTabs = 0;
  let totalPinned = 0;
  const referencedGroupIds = new Set();
  const seenTabIds = new Set();

  for (const win of windows) {
    // Exclude incognito windows
    if (win.incognito) continue;

    const filteredTabs = [];
    for (const tab of win.tabs || []) {
      if (tab.incognito) continue;
      if (isUrlExcluded(tab.url, excludedDomains)) continue;

      // Deduplicate tab instances across windows (prevents phantom duplicates)
      if (tab.id !== undefined && tab.id !== null) {
        if (seenTabIds.has(tab.id)) {
          continue;
        }
        seenTabIds.add(tab.id);
      }

      const hasGroup = tab.groupId && tab.groupId !== -1;
      if (hasGroup) {
        referencedGroupIds.add(tab.groupId);
      }

      if (tab.pinned) {
        totalPinned += 1;
      }

      filteredTabs.push({
        id: tab.id,
        title: tab.title || tab.url,
        url: tab.url,
        pinned: Boolean(tab.pinned),
        groupId: hasGroup ? tab.groupId : null,
        favIconUrl: tab.favIconUrl || ''
      });
    }

    if (filteredTabs.length > 0) {
      // Find groups that belong to this window
      const windowGroups = [];
      for (const [gid, gMeta] of groupsMap.entries()) {
        if (referencedGroupIds.has(gid)) {
          windowGroups.push(gMeta);
        }
      }

      snapshotWindows.push({
        windowId: win.id,
        state: win.state || 'normal',
        groups: windowGroups,
        tabs: filteredTabs
      });

      totalTabs += filteredTabs.length;
    }
  }

  const now = new Date();
  const snapshot = {
    version: 1,
    timestamp: now.getTime(),
    isoDate: now.toISOString(),
    device: {
      id: device.deviceId || device.id || 'unknown',
      name: device.deviceName || device.name || 'Browser',
      browser: device.browser || 'Chrome',
      os: device.os || 'Desktop'
    },
    meta: {
      totalWindows: snapshotWindows.length,
      totalTabs,
      totalGroups: referencedGroupIds.size,
      totalPinned
    },
    windows: snapshotWindows
  };

  snapshot.hash = await computeSnapshotHash(snapshot);
  return snapshot;
}
