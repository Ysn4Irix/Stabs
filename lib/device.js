/**
 * Stabs Browser & Device Identifier Utility
 * Detects browser environment, generates a stable device ID, and manages user-configured device labels.
 */

/**
 * Detects the browser brand and operating system.
 * @returns {Promise<{ browser: string, os: string, label: string }>}
 */
export async function detectBrowserEnvironment() {
  let osName = 'Desktop';
  try {
    if (chrome?.runtime?.getPlatformInfo) {
      const platform = await chrome.runtime.getPlatformInfo();
      const osMap = {
        win: 'Windows',
        mac: 'macOS',
        linux: 'Linux',
        cros: 'ChromeOS',
        android: 'Android',
        openbsd: 'OpenBSD'
      };
      osName = osMap[platform.os] || platform.os || 'Desktop';
    }
  } catch (err) {
    console.warn('Could not read platform info:', err);
  }

  let browserName = 'Chrome';
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  if (ua.includes('Edg/')) {
    browserName = 'Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browserName = 'Opera';
  } else if (ua.includes('Vivaldi')) {
    browserName = 'Vivaldi';
  } else if (ua.includes('Brave')) {
    browserName = 'Brave';
  }

  return {
    browser: browserName,
    os: osName,
    label: `${browserName} on ${osName}`
  };
}

/**
 * Gets or initializes the device identifier and device display name.
 * @returns {Promise<{ deviceId: string, deviceName: string, browser: string, os: string }>}
 */
export async function getDeviceIdentifier() {
  const store = await chrome.storage.local.get(['deviceId', 'deviceName']);
  const env = await detectBrowserEnvironment();

  let deviceId = store.deviceId;
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID().slice(0, 8);
    } else {
      deviceId = Math.random().toString(36).substring(2, 10);
    }
    await chrome.storage.local.set({ deviceId });
  }

  const deviceName = store.deviceName || env.label;
  if (!store.deviceName) {
    await chrome.storage.local.set({ deviceName });
  }

  return {
    deviceId,
    deviceName,
    browser: env.browser,
    os: env.os
  };
}
