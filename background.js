chrome.action.onClicked.addListener(() => {
    // First get the current window to calculate the center position
    chrome.windows.getCurrent((currentWindow) => {
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 500,
        height: 600,
        left: Math.round((currentWindow.width - 500) / 2),
        top: Math.round((currentWindow.height - 600) / 2)
      });
    });
  });