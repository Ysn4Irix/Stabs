import assert from 'node:assert';
import { isUrlExcluded, computeSnapshotHash } from '../lib/snapshot.js';
import { formatSummaryMessage, formatSummaryCaption, generateDeviceHashtag, generatePlatformHashtags } from '../lib/telegram.js';

console.log('Running unit tests for Stabs...');

// 1. URL exclusion tests
assert.strictEqual(isUrlExcluded('chrome://extensions'), true, 'chrome:// scheme should be excluded');
assert.strictEqual(isUrlExcluded('chrome-extension://xyz/popup.html'), true, 'chrome-extension:// should be excluded');
assert.strictEqual(isUrlExcluded('edge://settings'), true, 'edge:// should be excluded');
assert.strictEqual(isUrlExcluded('about:blank'), true, 'about:blank should be excluded');
assert.strictEqual(isUrlExcluded('http://localhost:3000', ['localhost']), true, 'localhost should be excluded');
assert.strictEqual(isUrlExcluded('http://127.0.0.1:8080', ['127.0.0.1']), true, '127.0.0.1 should be excluded');
assert.strictEqual(isUrlExcluded('https://sub.corp.internal', ['*.corp.internal']), true, '*.corp.internal wildcard should be excluded');
assert.strictEqual(isUrlExcluded('https://github.com/project', ['localhost']), false, 'github.com should NOT be excluded');
console.log('✓ URL exclusion tests passed');

// 2. Hash calculation tests
const mockSnapshot1 = {
  windows: [
    {
      tabs: [
        { url: 'https://github.com', pinned: false, groupId: null },
        { url: 'https://docs.google.com', pinned: true, groupId: 12 }
      ]
    }
  ]
};

const mockSnapshot2 = {
  windows: [
    {
      tabs: [
        { url: 'https://github.com', pinned: false, groupId: null },
        { url: 'https://docs.google.com', pinned: true, groupId: 12 }
      ]
    }
  ]
};

const mockSnapshotDifferent = {
  windows: [
    {
      tabs: [
        { url: 'https://github.com', pinned: false, groupId: null },
        { url: 'https://news.ycombinator.com', pinned: true, groupId: 12 }
      ]
    }
  ]
};

const hash1 = await computeSnapshotHash(mockSnapshot1);
const hash2 = await computeSnapshotHash(mockSnapshot2);
const hashDiff = await computeSnapshotHash(mockSnapshotDifferent);

assert.strictEqual(hash1, hash2, 'Identical snapshots must yield identical hashes');
assert.notStrictEqual(hash1, hashDiff, 'Different snapshots must yield different hashes');
assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
console.log('✓ Hash calculation tests passed');

// 3. Summary formatting test
const fullMockSnapshot = {
  version: 1,
  timestamp: 1729257600000,
  isoDate: '2026-10-18T13:20:00.000Z',
  meta: {
    totalWindows: 2,
    totalTabs: 7,
    totalGroups: 1,
    totalPinned: 1
  },
  windows: [
    {
      windowId: 1,
      tabs: [
        { title: 'Home <News>', url: 'https://example.com' },
        { title: 'Docs & API', url: 'https://example.org/docs' }
      ]
    }
  ]
};

const formatted = formatSummaryMessage(fullMockSnapshot);
assert.ok(formatted.includes('<b>Stabs Tab Backup</b>'), 'Contains title');
assert.ok(formatted.includes('&lt;News&gt;'), 'HTML escaped <News>');
assert.ok(formatted.includes('&amp; API'), 'HTML escaped & API');
assert.ok(formatted.includes('<b>Tabs:</b> 7'), 'Contains tab count');
assert.ok(formatted.includes('<b>Windows:</b> 2'), 'Contains window count');
assert.ok(formatted.includes('...and 5 more tabs in attached backup.'), 'Shows remaining tabs note');
console.log('✓ Summary formatting tests passed');

// 4. Single-message caption limit test (must never exceed 1024 characters)
const largeMockTabs = [];
for (let i = 0; i < 150; i++) {
  largeMockTabs.push({
    title: `Very long title of page ${i} with extra descriptions and details that could exceed limits`,
    url: `https://example.com/very/long/path/to/article/number/${i}?param=extra&ref=long`
  });
}

const largeSnapshot = {
  version: 1,
  timestamp: Date.now(),
  isoDate: new Date().toISOString(),
  meta: {
    totalWindows: 5,
    totalTabs: 150,
    totalGroups: 4,
    totalPinned: 3
  },
  windows: [{ windowId: 1, tabs: largeMockTabs }]
};

const caption = formatSummaryCaption(largeSnapshot);
assert.ok(caption.length <= 1024, `Caption length must be <= 1024 chars, got ${caption.length}`);
assert.ok(caption.includes('<b>Stabs Tab Backup</b>'), 'Contains header');
assert.ok(caption.includes('150'), 'Contains tab count');
console.log(`✓ Single-message caption bound test passed (${caption.length} chars <= 1024)`);

// 5. Device identifier in summary caption test
const deviceMockSnapshot = {
  version: 1,
  timestamp: 1729257600000,
  isoDate: '2026-10-18T14:15:00.000Z',
  device: {
    id: 'device123',
    name: 'Work Laptop (Chrome)',
    browser: 'Chrome',
    os: 'Windows'
  },
  meta: {
    totalWindows: 1,
    totalTabs: 3,
    totalGroups: 0,
    totalPinned: 0
  },
  windows: [
    {
      windowId: 1,
      tabs: [{ title: 'Code Editor', url: 'https://example.com/code' }]
    }
  ]
};

const deviceCaption = formatSummaryCaption(deviceMockSnapshot);
assert.ok(deviceCaption.includes('<b>Device:</b> Work Laptop (Chrome)'), 'Caption must include device identifier');
assert.ok(deviceCaption.includes('#device_work_laptop_chrome'), 'Caption must include sanitized device hashtag');
assert.ok(deviceCaption.includes('#browser_chrome'), 'Caption must include browser hashtag');
assert.ok(deviceCaption.includes('#os_windows'), 'Caption must include os hashtag');
assert.strictEqual(generateDeviceHashtag('Work PC (Main)'), '#device_work_pc_main', 'Sanitizes special chars in hashtag');
console.log('✓ Device identifier & hashtag integration tests passed');

// 6. Android Browser & Environment detection test
const { detectBrowserEnvironment } = await import('../lib/device.js');

function mockNavigatorUserAgent(userAgentString) {
  if (!globalThis.navigator) {
    globalThis.navigator = { userAgent: userAgentString };
  } else {
    try {
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        value: userAgentString,
        configurable: true
      });
    } catch {
      globalThis.navigator = { userAgent: userAgentString };
    }
  }
}

globalThis.chrome = {
  runtime: {
    getPlatformInfo: async () => ({ os: 'android', arch: 'arm64' })
  }
};

// Mock Kiwi Browser on Android user agent
mockNavigatorUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Kiwi Chrome');
const androidKiwiEnv = await detectBrowserEnvironment();
assert.strictEqual(androidKiwiEnv.os, 'Android', 'OS should be detected as Android');
assert.strictEqual(androidKiwiEnv.browser, 'Kiwi Browser', 'Browser should be detected as Kiwi Browser');
assert.strictEqual(androidKiwiEnv.label, 'Kiwi Browser on Android', 'Label should match Kiwi Browser on Android');

// Mock Firefox / Fenix on Android
mockNavigatorUserAgent('Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0');
const androidFirefoxEnv = await detectBrowserEnvironment();
assert.strictEqual(androidFirefoxEnv.browser, 'Firefox', 'Browser should be detected as Firefox');

// Mock Quetta Browser on Android
mockNavigatorUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Quetta/2.0');
const androidQuettaEnv = await detectBrowserEnvironment();
assert.strictEqual(androidQuettaEnv.os, 'Android', 'OS should be detected as Android');
assert.strictEqual(androidQuettaEnv.browser, 'Quetta Browser', 'Browser should be detected as Quetta Browser');
assert.strictEqual(androidQuettaEnv.label, 'Quetta Browser on Android', 'Label should match Quetta Browser on Android');

console.log('✓ Android browser detection tests passed (Kiwi, Firefox, Quetta)');

// 7. Android snapshot fallback test (chrome.windows missing or throwing)
const { captureSnapshot } = await import('../lib/snapshot.js');

globalThis.chrome = {
  // Simulating an Android browser with no chrome.windows support
  windows: undefined,
  tabGroups: undefined,
  tabs: {
    query: async () => [
      { id: 101, title: 'Android Docs', url: 'https://developer.android.com', pinned: false },
      { id: 102, title: 'GitHub', url: 'https://github.com', pinned: true }
    ]
  },
  storage: {
    local: {
      get: async () => ({ deviceId: 'test-android-id', deviceName: 'Pixel 8' })
    }
  },
  runtime: {
    getPlatformInfo: async () => ({ os: 'android' })
  }
};

const androidSnapshot = await captureSnapshot();
assert.strictEqual(androidSnapshot.meta.totalTabs, 2, 'Snapshot should capture 2 tabs via Android tabs fallback');
assert.strictEqual(androidSnapshot.meta.totalPinned, 1, 'Snapshot should capture 1 pinned tab');
assert.strictEqual(androidSnapshot.windows.length, 1, 'Should bundle into 1 window');
assert.strictEqual(androidSnapshot.windows[0].tabs[0].url, 'https://developer.android.com');
console.log('✓ Android snapshot fallback test passed');

// 8. Quetta Browser on Android duplicate windows bug reproduction test (19 windows * 19 tabs)
const mock19Tabs = [];
for (let i = 1; i <= 19; i++) {
  mock19Tabs.push({
    id: 1000 + i,
    title: `Tab ${i}`,
    url: `https://example.com/page/${i}`,
    pinned: i === 1
  });
}

// Simulate buggy mobile Chromium where chrome.windows.getAll returns 19 windows, each with all 19 tabs
const buggy19Windows = [];
for (let w = 1; w <= 19; w++) {
  buggy19Windows.push({
    id: w,
    state: 'normal',
    incognito: false,
    tabs: [...mock19Tabs]
  });
}

globalThis.chrome = {
  windows: {
    getAll: async () => buggy19Windows
  },
  tabGroups: undefined,
  tabs: {
    query: async () => mock19Tabs
  },
  storage: {
    local: {
      get: async () => ({ deviceId: 'quetta-s24-id', deviceName: 'QuettaS24' })
    }
  },
  runtime: {
    getPlatformInfo: async () => ({ os: 'android' })
  }
};

mockNavigatorUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Quetta/2.1');

const quettaSnapshot = await captureSnapshot();
assert.strictEqual(quettaSnapshot.meta.totalTabs, 19, `Total tabs must be 19 on Quetta Android, not 361. Got ${quettaSnapshot.meta.totalTabs}`);
assert.strictEqual(quettaSnapshot.meta.totalWindows, 1, `Total windows must be 1 on Quetta Android, not 19. Got ${quettaSnapshot.meta.totalWindows}`);
assert.strictEqual(quettaSnapshot.windows.length, 1, 'Windows array length must be 1');
assert.strictEqual(quettaSnapshot.windows[0].tabs.length, 19, 'Single window must contain exactly 19 tabs');
console.log('✓ Quetta Android duplicate tab & window prevention test passed (19 tabs, 1 window)');

// 9. Snapshot deletion & Telegram deleteMessage tests
const { deleteTelegramMessage } = await import('../lib/telegram.js');

assert.strictEqual(await deleteTelegramMessage('', '123', 456), false, 'Empty token must return false');
assert.strictEqual(await deleteTelegramMessage('token', '', 456), false, 'Empty chat ID must return false');
assert.strictEqual(await deleteTelegramMessage('token', '123', null), false, 'Null message ID must return false');

const originalFetch = globalThis.fetch;
let deleteCalled = false;
globalThis.fetch = async (url, opts) => {
  if (url.includes('/deleteMessage')) {
    deleteCalled = true;
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.chat_id, '123456');
    assert.strictEqual(body.message_id, 789);
    return {
      json: async () => ({ ok: true, result: true })
    };
  }
  return originalFetch ? originalFetch(url, opts) : { json: async () => ({ ok: true }) };
};

const delRes = await deleteTelegramMessage('fake-token', '123456', 789);
assert.strictEqual(delRes, true, 'deleteTelegramMessage must return true on success');
assert.strictEqual(deleteCalled, true, 'deleteMessage API must be invoked');
globalThis.fetch = originalFetch;

console.log('✓ Snapshot deletion & deleteTelegramMessage tests passed');

console.log('All tests passed successfully!');
