let selectedIndex = -1;
const maxResults = 100;

document.addEventListener('DOMContentLoaded', () => {
  
  // Tab Navigation
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      
      // Add active class to clicked tab
      button.classList.add('active');
      const tabId = button.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add('active');

      // Initialize content based on tab
      if (tabId === 'search') {
        document.getElementById('searchInput').focus();
        searchTabs('');
      }
      else if (tabId === 'organize') {
        loadWindowsAndTabs();
      } else if (tabId === 'manage') {
        loadDuplicateTabs();
      }
    });
  });

  const searchInput = document.getElementById('searchInput');

  // Focus search input on popup open
  searchInput.focus();

  searchInput.addEventListener('input', () => {
    searchTabs(searchInput.value.toLowerCase());
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const items = document.querySelectorAll('.tab-item');
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection(items);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection(items);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          items[selectedIndex].click();
        }
        break;
    }
  });

  // Initial search to show all tabs
  searchTabs('');
});

function updateSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
    if (index === selectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

async function searchTabs(query) {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const results = document.getElementById('searchResults');
    const statsContainer = document.getElementById('searchStatsContainer');
    results.innerHTML = '';
    selectedIndex = -1;

    // Calculate total tabs
    const totalTabs = windows.reduce((sum, window) => sum + window.tabs.length, 0);

    let matchingTabs = [];
    const queryWords = query.split(/\s+/).filter(Boolean);

    windows.forEach(window => {
      window.tabs.forEach(tab => {
        const title = tab.title.toLowerCase();
        const url = tab.url.toLowerCase();

        const titleMatches = queryWords.every(word => title.includes(word));
        const urlMatches = queryWords.every(word => url.includes(word));

        if (titleMatches || urlMatches) {
          matchingTabs.push({
            tab,
            window,
            titleMatch: titleMatches,
            urlMatch: urlMatches
          });
        }
      });
    });

    // Sort matches (title matches first)
    matchingTabs.sort((a, b) => {
      if (a.titleMatch && !b.titleMatch) return -1;
      if (!a.titleMatch && b.titleMatch) return 1;
      return 0;
    });

    // Update stats display - MOVED OUTSIDE THE LOOP
    if (query.trim() === '') {
      statsContainer.textContent = `${totalTabs} tab${totalTabs !== 1 ? 's' : ''} open`;
    } else {
      statsContainer.textContent = `${matchingTabs.length} of ${totalTabs} tab${totalTabs !== 1 ? 's' : ''}`;
    }

    // Limit results for performance
    matchingTabs = matchingTabs.slice(0, maxResults);

    matchingTabs.forEach(({ tab, window }) => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.innerHTML = `
       <div class="tab-content">
        <img src="${tab.favIconUrl || 'default-favicon.png'}" class="tab-icon" alt="">
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title)}</div>
          <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
      </div>
      `;

      tabElement.addEventListener('click', async () => {
        try {
          await chrome.windows.update(window.id, { focused: true });
          await chrome.tabs.update(tab.id, { active: true });
          window.close();
        } catch (error) {
          console.error('Failed to switch tab:', error);
        }
      });

      results.appendChild(tabElement);
    });
  } catch (error) {
    console.error('Error searching tabs:', error);
    document.getElementById('searchResults').innerHTML = 
      '<div style="padding: 8px; color: red;">Error accessing tabs</div>';
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadDuplicateTabs() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const duplicateResults = document.getElementById('duplicateResults');
    const statsContainer = document.getElementById('manageStatsContainer');
    duplicateResults.innerHTML = '';

    // Group tabs by URL
    const tabsByUrl = new Map();
    windows.forEach(window => {
      window.tabs.forEach(tab => {
        const normalizedUrl = tab.url.toLowerCase();
        if (!tabsByUrl.has(normalizedUrl)) {
          tabsByUrl.set(normalizedUrl, []);
        }
        tabsByUrl.get(normalizedUrl).push({ tab, window });
      });
    });

    // Filter and display only duplicate tabs
    let duplicateGroups = [];
    tabsByUrl.forEach((tabs, url) => {
      if (tabs.length > 1) {
        duplicateGroups.push(tabs);
      }
    });

    // Update stats with chip style
    statsContainer.textContent = `${duplicateGroups.length} set of duplicate${duplicateGroups.length !== 1 ? 's' : ''} found`;

    // Display duplicate groups
    duplicateGroups.forEach(tabs => {
      const groupElement = document.createElement('div');
      groupElement.className = 'duplicate-group';
      
      const { tab } = tabs[tabs.length - 1]; // Get the latest tab
      groupElement.innerHTML = `
        <div class="duplicate-header">
          <img src="${tab.favIconUrl || 'default-favicon.png'}" class="tab-icon" alt="">
          <div class="duplicate-info">
            <div class="tab-title">${escapeHtml(tab.title)}</div>
            <span class="duplicate-count">${tabs.length} duplicates</span>
          </div>
          <button class="keep-latest-button">Keep Latest</button>
        </div>
      `;

      // Add click handler
      const keepLatestButton = groupElement.querySelector('.keep-latest-button');
      keepLatestButton.addEventListener('click', async () => {
        // Keep the latest tab (last in array) and close others
        const tabIds = tabs.slice(0, -1).map(t => t.tab.id);
        await chrome.tabs.remove(tabIds);
        loadDuplicateTabs(); // Refresh list
      });

      duplicateResults.appendChild(groupElement);
    });

  } catch (error) {
    console.error('Error loading duplicate tabs:', error);
    document.getElementById('duplicateResults').innerHTML = 
      '<div style="padding: 8px; color: red;">Error accessing tabs</div>';
  }
}


async function loadWindowsAndTabs() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const container = document.getElementById('windowsContainer');
    container.innerHTML = '';

    // Get saved window names from storage
    const windowNames = await getWindowNames();

    windows.forEach(window => {
      const windowElement = document.createElement('div');
      windowElement.className = 'window-group';
      const windowName = windowNames[window.id] || `Window ${window.id}`;
      
      windowElement.innerHTML = `
        <div class="window-header">
          <div class="window-title-group">
            <span class="window-name" data-window-id="${window.id}">${escapeHtml(windowName)}</span>
            <button class="edit-name-button" title="Edit window name">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          <span class="tab-count">${window.tabs.length} tabs</span>
        </div>
        <div class="window-tabs" data-window-id="${window.id}">
          ${window.tabs.map(tab => `
            <div class="draggable-tab" draggable="true" data-tab-id="${tab.id}">
              <img src="${tab.favIconUrl || 'default-favicon.png'}" class="tab-icon" alt="">
              <div class="tab-info">
                <div class="tab-title">${escapeHtml(tab.title)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Add edit name functionality
      const editButton = windowElement.querySelector('.edit-name-button');
      const windowNameSpan = windowElement.querySelector('.window-name');
      
      editButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'window-name-input';
        input.value = windowNameSpan.textContent;
        
        windowNameSpan.replaceWith(input);
        input.focus();
        
        input.addEventListener('blur', async () => {
          const newName = input.value.trim() || `Window ${window.id}`;
          await saveWindowName(window.id, newName);
          input.replaceWith(windowNameSpan);
          windowNameSpan.textContent = newName;
        });
        
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            input.blur();
          } else if (e.key === 'Escape') {
            input.value = windowNameSpan.textContent;
            input.blur();
          }
        });
      });

      container.appendChild(windowElement);
    });

    setupDragAndDrop();
  } catch (error) {
    console.error('Error loading windows and tabs:', error);
  }
}

// Helper functions for window name storage
async function getWindowNames() {
  try {
    const data = await chrome.storage.local.get('windowNames');
    return data.windowNames || {};
  } catch (error) {
    console.error('Error getting window names:', error);
    return {};
  }
}

async function saveWindowName(windowId, name) {
  try {
    const windowNames = await getWindowNames();
    windowNames[windowId] = name;
    await chrome.storage.local.set({ windowNames });
  } catch (error) {
    console.error('Error saving window name:', error);
  }
}

function setupDragAndDrop() {
  const draggableTabs = document.querySelectorAll('.draggable-tab');
  const dropZones = document.querySelectorAll('.window-tabs');

  draggableTabs.forEach(tab => {
    tab.addEventListener('dragstart', handleDragStart);
    tab.addEventListener('dragend', handleDragEnd);
  });

  dropZones.forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  e.target.classList.add('dragging');
  e.dataTransfer.setData('text/plain', JSON.stringify({
    tabId: e.target.dataset.tabId,
    sourceWindowId: e.target.closest('.window-tabs').dataset.windowId
  }));
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.window-tabs').forEach(zone => {
    zone.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  const dropZone = e.currentTarget;
  dropZone.classList.remove('drag-over');

  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
  const targetWindowId = parseInt(dropZone.dataset.windowId);
  const tabId = parseInt(data.tabId);

  if (targetWindowId !== parseInt(data.sourceWindowId)) {
    try {
      await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
      loadWindowsAndTabs(); // Refresh the view
    } catch (error) {
      console.error('Error moving tab:', error);
    }
  }
}

