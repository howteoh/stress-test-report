// 配置常量
const CONFIG = {
  JIRA_URL: 'https://jira.realtek.com/sr/jira.issueviews:searchrequest-xml/59583/SearchRequest-59583.xml?tempMax=1000',
  TARGET_USERS: ['JIRAUSER50632', 'JIRAUSER51966'],
  TARGET_PHRASES: ['請協助查看', '也有同样问题'],
  STYLES: {
    FONT_FAMILY: "'Times New Roman', Times, serif",
    INDENT: '<span style="font-size: 10pt;">&nbsp;&nbsp;&nbsp;&nbsp;</span>'
  }
};

// JIRA 數據處理類
class JiraDataProcessor {
  static async fetchJiraData() {
    const response = await fetch(CONFIG.JIRA_URL, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/xml',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      this.handleFetchError(response);
    }

    const text = await response.text();
    return new DOMParser().parseFromString(text, 'text/xml');
  }

  static handleFetchError(response) {
    if (response.status === 0) {
      throw new Error('無法連接到 JIRA。請確認：\n1. 是否已連接 VPN\n2. 是否已登入 JIRA');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

// 日期處理類
class DateProcessor {
  static extractDateFromPath(commentText) {
    const pathIndex = commentText.indexOf('\\172.22.48.92\\');
    if (pathIndex === -1) return null;

    const pathLine = commentText.substring(pathIndex);
    const dateMatch = pathLine.match(/Demo_stress_Test_log\\2024\\(\d{8})/);
    if (!dateMatch) return null;

    const dateStr8 = dateMatch[1];
    return `${dateStr8.substring(0, 4)}/${dateStr8.substring(4, 6)}/${dateStr8.substring(6, 8)}`;
  }

  static getFormattedToday() {
    const today = new Date();
    return `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  }
}

// HTML 生成器類
class HtmlGenerator {
  static generateSummaryHtml(dateStr, summaryText) {
    return `
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 10pt;">Hi all，<br>公版 ${dateStr} stability night run results:<br><br></div>
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 15pt;">[壓測結果回報]</div>
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 12pt;">
        ${summaryText.split('<br>').map(line => `${CONFIG.STYLES.INDENT}${line}`).join('<br>')}<br>
      </div>
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 15pt;">[壓測詳細分析log]</div>
    `;
  }

  static generateIssueHtml(displayText, title, assignee, link, lastTargetComment) {
    return `
      <div class="bracket-text">${CONFIG.STYLES.INDENT}${displayText}的jira題目</div>
      <div class="title">${CONFIG.STYLES.INDENT}${title || 'No title'} - ${assignee || 'Unassigned'}</div>
      <div>${CONFIG.STYLES.INDENT}<span class="link"><a href="${link}" target="_blank">${link}</a></span></div>
      <table class="comment-table" style="display: inline-block;">
        ${lastTargetComment ? `<tr><td class="comment">${lastTargetComment}</td></tr>` : ''}
      </table>
      <br>
    `;
  }

  static generateEndingHtml() {
    return `
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 15pt;">[壓測計畫-總表]</div>
      <div style="margin-bottom: 20px; color: red; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 12pt;">
        Note: 下表反灰項目為keep set.<br><br><br>
      </div>
      <div style="margin-bottom: 20px; font-family: ${CONFIG.STYLES.FONT_FAMILY}; font-size: 12pt;">
        Log 存放位置：\\172.22.48.92\\nightrun_log\\Demo_stress_Test_log\\2024<br>
        172.22.48.92 這台是linux sever<br>
        可以用帳號: rtk001 密碼: 123456<br>
        也可以用window 連線
      </div>
    `;
  }
}

// 主應用類
class JiraDisplayApp {
  constructor() {
    this.issuesDiv = document.getElementById('issues');
    this.filterKeywords = document.getElementById('filterKeywords');
    this.filterContainer = document.querySelector('.filter-container');
    this.toggleButton = document.getElementById('toggleFilter');
    this.items = null;  // 添加 items 屬性
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 載入儲存的關鍵字和顯示狀態
    chrome.storage.local.get(['keywords', 'filterVisible'], (result) => {
      if (result.keywords) {
        this.filterKeywords.value = result.keywords;
        this.updateDisplay();
      }
      
      // 設置顯示狀態
      if (result.filterVisible) {
        this.filterContainer.style.display = 'block';
        this.toggleButton.textContent = '隱藏關鍵字設定';
      } else {
        this.toggleButton.textContent = '顯示關鍵字設定';
      }
    });
    
    // 切換顯示/隱藏
    this.toggleButton.addEventListener('click', () => {
      const isVisible = this.filterContainer.style.display === 'block';
      this.filterContainer.style.display = isVisible ? 'none' : 'block';
      this.toggleButton.textContent = isVisible ? '' : '隱藏關鍵字設定';
      
      // 儲存顯示狀態
      chrome.storage.local.set({ filterVisible: !isVisible });
    });

    // 監聽輸入變化，使用 debounce 避免過於頻繁的更新
    let timeoutId;
    this.filterKeywords.addEventListener('input', () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => this.updateDisplay(), 300);
    });
  }

  async init() {
    try {
      const xmlDoc = await JiraDataProcessor.fetchJiraData();
      // 找出所有 issues
      this.items = xmlDoc.getElementsByTagName('item');
      
      if (this.items.length === 0) {
        this.issuesDiv.innerHTML = 'No issues found. Please make sure you are logged into Jira.';
        return;
      }
      
      // 更新顯示函數
      this.updateDisplay();
      
    } catch (error) {
      this.handleError(error);
    }
  }

  updateDisplay() {
    const keywords = this.filterKeywords.value.split('\n').map(k => k.trim()).filter(k => k);
    
    // 儲存關鍵字
    chrome.storage.local.set({ keywords: this.filterKeywords.value });
    
    // 設定目標關鍵字
    const targetPhrases = CONFIG.TARGET_PHRASES;
    
    let summaryText = '';  // 只宣告一次
    let dateStr = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Reset time to 00:00:00 of current day
    
    // 尋找第一個符合條件的留言來獲取日期
    for (const item of this.items) {
      const comments = item.getElementsByTagName('comment');
      
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        const author = comment.getAttribute('author');
        const created = new Date(comment.getAttribute('created'));
        const commentText = comment.textContent;
        
        if ((author === 'JIRAUSER50632' || author === 'JIRAUSER51966') && 
            created >= today &&
            targetPhrases.some(phrase => commentText.includes(phrase))) {
          
          const pathIndex = commentText.indexOf('\\172.22.48.92\\');
          if (pathIndex !== -1) {
            // 獲取完整路徑
            const pathLine = commentText.substring(pathIndex);
            // 尋找日期格式 YYYYMMDD，在 Demo_stress_Test_log\2024\ 之後
            const dateMatch = pathLine.match(/Demo_stress_Test_log\\2024\\(\d{8})/);
            if (dateMatch) {
              // 將 YYYYMMDD 轉換為 YYYY/MM/DD 格式
              const dateStr8 = dateMatch[1];  // 使用第一個捕獲組
              dateStr = `${dateStr8.substring(0, 4)}/${dateStr8.substring(4, 6)}/${dateStr8.substring(6, 8)}`;
              break;
            }
          }
        }
      }
      if (dateStr) break;  // 如果找到日期就停止搜尋
    }
    
    // 如果沒有找到日期，使用當前日期作為備用
    if (!dateStr) {
      dateStr = DateProcessor.getFormattedToday();
    }
    
    // 收集所有符合條件的 issues 摘要
    for (const item of this.items) {
      const title = item.getElementsByTagName('title')[0]?.textContent;
      const cleanTitle = title.replace(/\[[^\]]*\]/g, '').trim();
      const comments = item.getElementsByTagName('comment');
      
      let hasTargetUserCommentToday = false;
      let bracketText = '';
      let matchedKeywords = [];
      
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        const author = comment.getAttribute('author');
        const created = new Date(comment.getAttribute('created'));
        const commentText = comment.textContent;
        
        // 使用相同的條件檢查
        if ((author === 'JIRAUSER50632' || author === 'JIRAUSER51966') && 
            created >= today &&
            targetPhrases.some(phrase => commentText.includes(phrase))) {
          
          hasTargetUserCommentToday = true;
          const pathIndex = commentText.indexOf('\\172.22.48.92\\');
          
          if (pathIndex !== -1) {
            bracketText = commentText.substring(0, pathIndex).trim();
            
            // 找出所有匹配的關鍵字
            matchedKeywords = keywords.filter(key => 
              bracketText.toLowerCase().includes(key.toLowerCase())
            );
            
            // 使用匹配到的關鍵字，如果沒有關鍵字則使用原始文字
            const displayText = matchedKeywords.length > 0 
              ? `<span style="color: red;">${matchedKeywords.join(', ')}</span>`
              : bracketText;
            
            // 只有當符合所有條件時才添加到摘要
            if (hasTargetUserCommentToday && (keywords.length === 0 || matchedKeywords.length > 0)) {
              // 第一行：顯示標題
              summaryText += `${displayText}: ${cleanTitle}<br>`;
              // 第二行：顯示連結和負責人，並添加縮排
              const assignee = item.getElementsByTagName('assignee')[0]?.textContent || 'Unassigned';
              const link = item.getElementsByTagName('link')[0]?.textContent;
              summaryText += `<a href="${link}" target="_blank">${link}</a> - ${assignee}<br><br>`;  // 添加額外的 <br>
            }
            break;
          }
        }
      }
    }
    
    // 設置標題文字和摘要
    this.issuesDiv.innerHTML = HtmlGenerator.generateSummaryHtml(dateStr, summaryText);
    
    // 處理所有 issues
    for (const item of this.items) {
      const title = item.getElementsByTagName('title')[0]?.textContent;
      const link = item.getElementsByTagName('link')[0]?.textContent;
      const assignee = item.getElementsByTagName('assignee')[0]?.textContent;
      
      const comments = item.getElementsByTagName('comment');
      let lastTargetComment = null;
      let hasTargetUserCommentToday = false;
      let bracketText = '';
      let matchedKeywords = []; // 用於儲存匹配的關鍵字        
      
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        const author = comment.getAttribute('author');
        const created = new Date(comment.getAttribute('created'));
        const commentText = comment.textContent;
        
        if ((author === 'JIRAUSER50632' || author === 'JIRAUSER51966') && 
            created >= today &&
            targetPhrases.some(phrase => commentText.includes(phrase))) {
          
          hasTargetUserCommentToday = true;
          
          if (!lastTargetComment) {
            const pathIndex = commentText.indexOf('\\172.22.48.92\\');
            if (pathIndex !== -1) {
              // 取得路徑前的文字
              bracketText = commentText.substring(0, pathIndex).trim();
              
              // 找出所有匹配的關鍵字
              matchedKeywords = keywords.filter(key => 
                bracketText.toLowerCase().includes(key.toLowerCase())
              );
              
              // 處理留言內容
              let processedText = commentText.substring(pathIndex);
              const lines = processedText.split('\n').map(line => line.trim()).filter(line => line);
              const imageLineIndex = lines.findIndex(line => line.toLowerCase().includes('image'));
              
              if (imageLineIndex !== -1) {
                processedText = lines.slice(0, imageLineIndex).join('\n');
              }
              
              lastTargetComment = processedText;
            }
          }
        }
      }
      
      // 檢查是否有匹配的關鍵字
      const hasMatchingKeywords = keywords.length === 0 || matchedKeywords.length > 0;
      
      // 只有當符合所有條件時才顯示
      if (hasTargetUserCommentToday && hasMatchingKeywords) {
        const issueDiv = document.createElement('div');
        issueDiv.className = 'issue';
        
        // 使用匹配到的關鍵字，如果沒有關鍵字則使用原始文字
        const displayText = matchedKeywords.length > 0 
          ? `<span style="color: red;">${matchedKeywords.join(', ')}</span>`
          : bracketText;
        
        issueDiv.innerHTML = HtmlGenerator.generateIssueHtml(displayText, title, assignee, link, lastTargetComment);
        
        this.issuesDiv.appendChild(issueDiv);
      }
    }
    
    // 在所有 issue 後添加結尾資訊
    const endingDiv = document.createElement('div');
    endingDiv.innerHTML = HtmlGenerator.generateEndingHtml();
    this.issuesDiv.appendChild(endingDiv);
  }

  handleError(error) {
    console.error('Error fetching data:', error);
    this.issuesDiv.innerHTML = `
      <div style="color: red; padding: 10px;">
        Error: ${error.message}<br><br>
        如需協助，請聯繫：<br>
        - HelpDesk (#17885)<br>
        - <a href="https://jira.realtek.com" target="_blank">登入 JIRA</a>
      </div>
    `;
  }
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
  const app = new JiraDisplayApp();
  app.init();
});