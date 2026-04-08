// 桥接脚本（隔离世界）：将 logo URL 传递给 MAIN 世界
document.documentElement.dataset.logoSz = chrome.runtime.getURL('logos/SZ_logo.png');
document.documentElement.dataset.logoGd = chrome.runtime.getURL('logos/GD_logo.png');
