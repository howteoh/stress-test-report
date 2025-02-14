// 設置定時檢查
chrome.alarms.create('checkUpdate', {
  periodInMinutes: 60  // 每小時檢查一次
});

// 監聽定時器
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkUpdate') {
    checkForUpdates();
  }
});

// 監聽 Chrome 啟動
chrome.runtime.onStartup.addListener(() => {
  checkForUpdates();
});

// 監聽擴充功能安裝或更新
chrome.runtime.onInstalled.addListener(() => {
  checkForUpdates();
});

// 檢查更新的函數
function checkForUpdates() {
  fetch('https://jira.realtek.com/sr/jira.issueviews:searchrequest-xml/59583/SearchRequest-59583.xml?tempMax=1000', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/xml',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(text => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    const items = xmlDoc.getElementsByTagName('item');
    
    // 儲存最新的數據
    chrome.storage.local.set({ 
      lastUpdate: new Date().toISOString(),
      itemsCount: items.length
    });
  })
  .catch(error => {
    console.error('Error checking for updates:', error);
  });
} 