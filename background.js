let currentTab = null;
let startTime = null;

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Invalid URL:', url);
    return null;
  }
}

async function updateScreenTime(domain, duration) {
  console.log("updateScreenTime", domain, duration);
  if (!domain) return;
  
  try {
    const data = await chrome.storage.local.get('screenTime');
    const screenTime = data.screenTime || {};
    
    // Add time spent on this domain
    screenTime[domain] = (screenTime[domain] || 0) + duration;

    // Sort the screen time object by total time spent in descending order
    const sortedScreenTime = Object.entries(screenTime)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    // Save the sorted screen time back to local storage
    await chrome.storage.local.set({ screenTime: sortedScreenTime });
    console.log('Updated screen time:', sortedScreenTime);
  } catch (error) {
    console.error('Error updating screen time:', error);
  }
}

async function handleTabChange(activeInfo) {
  const now = Date.now();
  
  // If there was a previous tab active, log its time
  if (currentTab && startTime) {
    try {
      const prevTab = await chrome.tabs.get(currentTab);
      const domain = getDomain(prevTab.url);
      if (domain) {
        const duration = now - startTime;
        await updateScreenTime(domain, duration);
      }
    } catch (error) {
      console.error('Error getting previous tab:', error);
    }
  }
  
  // Start tracking new tab
  currentTab = activeInfo.tabId;
  startTime = now;
  console.log('Started tracking new tab:', currentTab, startTime);
}

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(handleTabChange);

// Listen for tab URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTab && changeInfo.url) {
    // Log time for previous URL
    if (startTime) {
      const domain = getDomain(tab.url);
      if (domain) {
        const duration = Date.now() - startTime;
        await updateScreenTime(domain, duration);
      }
    }
    startTime = Date.now();
    console.log('Tab URL updated:', tabId, startTime);
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus, update time for current tab
    if (currentTab && startTime) {
      try {
        const tab = await chrome.tabs.get(currentTab);
        const domain = getDomain(tab.url);
        if (domain) {
          const duration = Date.now() - startTime;
          await updateScreenTime(domain, duration);
        }
        startTime = null;
        console.log('Window lost focus:', currentTab, startTime);
      } catch (error) {
        console.error('Error getting current tab:', error);
      }
    }
  } else {
    // Window gained focus, start tracking current tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) {
        currentTab = tab.id;
        startTime = Date.now();
        console.log('Window gained focus:', currentTab, startTime);
      }
    } catch (error) {
      console.error('Error handling window focus:', error);
    }
  }
});

// Use alarms to periodically check the active tab
chrome.alarms.create('checkActiveTab', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkActiveTab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      handleTabChange({ tabId: tab.id });
    }
  }
});

console.log('Background script loaded');
