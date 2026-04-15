// 桥接脚本（隔离世界）：预取扩展内 logo 资源，转成 data URL 再写入 DOM
// 为什么：MAIN world 通过 <img src=chrome-extension://...> 跨 world 加载资源
// 在某些 Chrome 版本/CSP 环境下会偶发失败；data URL 直接走内存，不走网络，最稳。

(async function () {
  async function toDataUrl(path) {
    const url = chrome.runtime.getURL(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${path} -> HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("FileReader failed"));
      r.readAsDataURL(blob);
    });
  }

  try {
    const [sz, gd] = await Promise.all([
      toDataUrl("logos/SZ_logo.png"),
      toDataUrl("logos/GD_logo.png"),
    ]);
    document.documentElement.dataset.logoSz = sz;
    document.documentElement.dataset.logoGd = gd;
    document.documentElement.dataset.logoReady = "1";
  } catch (e) {
    console.error("[ImageUploader] inject-logos 预取失败:", e);
    document.documentElement.dataset.logoReady = "error";
  }
})();
