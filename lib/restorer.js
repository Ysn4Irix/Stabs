/**
 * Stabs Session Restorer
 * Reconstructs windows, tabs, and tab groups from a snapshot object.
 */

/**
 * Restores all windows, tabs, and tab groups from a snapshot.
 * @param {object} snapshot
 * @returns {Promise<{ restoredWindows: number, restoredTabs: number, restoredGroups: number }>}
 */
export async function restoreSession(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.windows) || snapshot.windows.length === 0) {
    throw new Error('Invalid snapshot data: no windows found.');
  }

  let totalRestoredWindows = 0;
  let totalRestoredTabs = 0;
  let totalRestoredGroups = 0;

  for (const winData of snapshot.windows) {
    const validTabs = (winData.tabs || []).filter(t => t.url);
    if (validTabs.length === 0) continue;

    // Attempt window creation (Desktop), falling back to tab creation in current window (Android)
    const firstTab = validTabs[0];
    let newWindow = null;
    let windowId = undefined;

    if (chrome.windows && typeof chrome.windows.create === 'function') {
      try {
        newWindow = await chrome.windows.create({
          url: firstTab.url,
          focused: true,
          state: winData.state === 'maximized' ? 'maximized' : 'normal'
        });
        windowId = newWindow.id;
        totalRestoredWindows += 1;
        totalRestoredTabs += 1;
      } catch (winErr) {
        console.warn('[Stabs] chrome.windows.create not supported or failed (e.g. mobile/Android):', winErr);
        newWindow = null;
      }
    }

    const createdTabMap = new Map(); // original tab index -> created tabId

    if (newWindow && newWindow.tabs && newWindow.tabs.length > 0) {
      const initialTabId = newWindow.tabs[0].id;
      createdTabMap.set(0, initialTabId);
      if (firstTab.pinned) {
        try {
          await chrome.tabs.update(initialTabId, { pinned: true });
        } catch (err) {
          console.warn('Failed to pin first tab:', err);
        }
      }
    } else {
      // Mobile / Android fallback: create first tab directly in the active context
      try {
        const createdFirst = await chrome.tabs.create({
          url: firstTab.url,
          pinned: Boolean(firstTab.pinned)
        });
        createdTabMap.set(0, createdFirst.id);
        totalRestoredTabs += 1;
      } catch (err) {
        console.warn(`Failed to create first tab for URL ${firstTab.url}:`, err);
      }
    }

    // Create subsequent tabs
    for (let i = 1; i < validTabs.length; i++) {
      const tabData = validTabs[i];
      try {
        const createOptions = {
          url: tabData.url,
          pinned: Boolean(tabData.pinned)
        };
        if (windowId !== undefined) {
          createOptions.windowId = windowId;
        }
        const createdTab = await chrome.tabs.create(createOptions);
        createdTabMap.set(i, createdTab.id);
        totalRestoredTabs += 1;
      } catch (err) {
        console.warn(`Failed to create tab for URL ${tabData.url}:`, err);
      }
    }

    // Reconstruct Tab Groups if supported by browser
    if (chrome.tabGroups && chrome.tabs && typeof chrome.tabs.group === 'function' && Array.isArray(winData.groups) && winData.groups.length > 0) {
      // Build a map of groupId -> list of new tabIds
      const groupTabIdsMap = new Map();

      validTabs.forEach((tabData, index) => {
        if (tabData.groupId !== null && tabData.groupId !== undefined) {
          const tabId = createdTabMap.get(index);
          if (tabId) {
            if (!groupTabIdsMap.has(tabData.groupId)) {
              groupTabIdsMap.set(tabData.groupId, []);
            }
            groupTabIdsMap.get(tabData.groupId).push(tabId);
          }
        }
      });

      // Group tabs and restore metadata
      for (const groupMeta of winData.groups) {
        const tabIds = groupTabIdsMap.get(groupMeta.id);
        if (tabIds && tabIds.length > 0) {
          try {
            const newGroupId = await chrome.tabs.group({
              windowId: newWindow.id,
              tabIds
            });

            await chrome.tabGroups.update(newGroupId, {
              title: groupMeta.title || '',
              color: groupMeta.color || 'grey',
              collapsed: Boolean(groupMeta.collapsed)
            });

            totalRestoredGroups += 1;
          } catch (err) {
            console.warn(`Failed to restore tab group ${groupMeta.title}:`, err);
          }
        }
      }
    }
  }

  return {
    restoredWindows: totalRestoredWindows,
    restoredTabs: totalRestoredTabs,
    restoredGroups: totalRestoredGroups
  };
}
