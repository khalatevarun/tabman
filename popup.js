let selectedIndex = -1;
const maxResults = 100;

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const results = document.getElementById('results');

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
    const results = document.getElementById('results');
    results.innerHTML = '';
    selectedIndex = -1;

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
    document.getElementById('results').innerHTML = 
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