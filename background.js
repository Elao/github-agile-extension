const icons = {
  enabled: '../icons/icon48.png',
  disabled: '../icons/icon48-disable.png',
};

chrome.tabs.onActivated.addListener(({ tabId }) =>  {
  chrome.tabs.get(tabId, (currentTab) => {
    if (!currentTab.url.includes('github.com')) {
      chrome.browserAction.setIcon({ path: icons['disabled'] });
    } else {
      chrome.browserAction.setIcon({ path: icons['enabled'] });
    }
  });
});
