// ==UserScript==
// @name         图片上传助手 (V3.1 图片缩放+分平台Logo水印)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  上传图片前统一缩放到850宽（可选放大）并叠加Logo水印 + Alt/Title注入
// @author       You
// @match        https://*.gundamit.com/manage/?m=products&a=products&d=edit*
// @match        https://*.showzstore.com/manage/?m=products&a=products&d=edit*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_VERSION = "3.1";

  // ================= 配置区域 =================
  const maxConcurrentUploads = 3;

  // ===== 图片预处理配置 =====
  const IMAGE_MAX_WIDTH = 850;
  const SCALE_UP_SMALL_IMAGES = true;
  const OUTPUT_MIME = "image/jpeg";
  const OUTPUT_QUALITY = 1;
  const LOGO_REL_WIDTH = 0.25;
  const LOGO_OPACITY = 1.0;
  const LOGO_MARGIN = 5;
  const LOGO_POS = "bl";
  // ===========================================

  let currentUploads = 0;
  let uploadQueue = [];
  let filesLink = [];

  function log(...args) {
    try { console.log(`[ImageUploader v${SCRIPT_VERSION}]`, ...args); } catch (_) {}
  }

  function getBaseUrl() {
    const url = window.location.href;
    const idx = url.indexOf('?');
    return (idx !== -1) ? url.substring(0, idx) : url;
  }

  function sanitizeTitle(title) {
    let t = (title || "");
    t = t.replace(/(\[|\(|【)\s*pre[\s-]*order\s*(\]|\)|】)/ig, " ");
    t = t.replace(/(\[|\(|【)\s*preorder\s*(\]|\)|】)/ig, " ");
    t = t.replace(/\s{2,}/g, " ").trim();
    t = t.replace(/^[-–—]+\s*/, "").trim();
    return t;
  }

  // ================= 图片预处理：缩放 + 水印 =================

  function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function loadImageFromFile(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_) {}
    }
    const dataUrl = await readFileAsDataURL(file);
    return await loadHtmlImage(dataUrl);
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
    });
  }

  function pickLogoAnchor(pos, imgW, imgH, logoW, logoH, margin) {
    let x = margin, y = margin;
    if (pos === "tr") { x = imgW - logoW - margin; y = margin; }
    if (pos === "bl") { x = margin; y = imgH - logoH - margin; }
    if (pos === "br") { x = imgW - logoW - margin; y = imgH - logoH - margin; }
    if (pos === "tl") { x = margin; y = margin; }
    return { x, y };
  }

  // ===== Logo 按平台存储 =====
  const PLATFORM_KEYS = {
    "gundamit.com":   "logo_dataurl_gundamit_v1",
    "showzstore.com": "logo_dataurl_showzstore_v1",
  };

  function getCurrentPlatform() {
    const host = window.location.hostname;
    for (const domain of Object.keys(PLATFORM_KEYS)) {
      if (host.endsWith(domain)) return domain;
    }
    return null;
  }

  function getLogoStoreKey() {
    const platform = getCurrentPlatform();
    return platform ? PLATFORM_KEYS[platform] : null;
  }

  function getPlatformLabel() {
    const platform = getCurrentPlatform();
    if (platform === "gundamit.com") return "Gundamit";
    if (platform === "showzstore.com") return "Showzstore";
    return "未知平台";
  }

  let _logoCache = null;
  let _logoCachePlatform = null;

  async function getLogoImage() {
    const platform = getCurrentPlatform();
    if (_logoCache && _logoCachePlatform === platform) return _logoCache;

    const key = getLogoStoreKey();
    if (!key) return null;

    const dataUrl = await GM_getValue(key, "");
    if (!dataUrl) return null;
    try {
      const img = await loadHtmlImage(dataUrl);
      _logoCache = img;
      _logoCachePlatform = platform;
      return img;
    } catch (e) {
      console.error("Logo load failed:", e);
      return null;
    }
  }

  function pickLogoFileAndSave() {
    const key = getLogoStoreKey();
    const label = getPlatformLabel();
    if (!key) { alert("无法识别当前平台！"); return; }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) {
        document.body.removeChild(input);
        return;
      }
      try {
        const dataUrl = await readFileAsDataURL(file);
        await GM_setValue(key, dataUrl);
        _logoCache = null;
        _logoCachePlatform = null;
        alert(`${label} 的 Logo 已保存！上传图片时会自动叠加此水印。`);
      } catch (e) {
        console.error(e);
        alert("Logo 保存失败，请换一张图片再试。");
      } finally {
        document.body.removeChild(input);
      }
    });

    input.click();
  }

  try {
    const label = getPlatformLabel();
    GM_registerMenuCommand(`设置Logo - ${label}`, pickLogoFileAndSave);
  } catch (e) {}

  async function preprocessImage(file) {
    if ((file.type || "").toLowerCase() === "image/gif") {
      return { blob: file, name: file.name };
    }

    const bitmapOrImg = await loadImageFromFile(file);
    const srcW = bitmapOrImg.width;
    const srcH = bitmapOrImg.height;

    let scale = IMAGE_MAX_WIDTH / srcW;
    if (!SCALE_UP_SMALL_IMAGES && srcW <= IMAGE_MAX_WIDTH) {
      scale = 1;
    }

    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(bitmapOrImg, 0, 0, dstW, dstH);

    const logo = await getLogoImage();
    if (logo) {
      const targetLogoW = Math.round(dstW * LOGO_REL_WIDTH);
      const logoScale = targetLogoW / logo.width;
      const targetLogoH = Math.round(logo.height * logoScale);

      const { x, y } = pickLogoAnchor(LOGO_POS, dstW, dstH, targetLogoW, targetLogoH, LOGO_MARGIN);

      ctx.save();
      ctx.globalAlpha = LOGO_OPACITY;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(logo, x, y, targetLogoW, targetLogoH);
      ctx.restore();
    }

    const blob = await canvasToBlob(canvas, OUTPUT_MIME, OUTPUT_QUALITY);
    if (!blob) return { blob: file, name: file.name };

    const base = (file.name || "image").replace(/\.[^.]+$/, "");
    const ext = OUTPUT_MIME === "image/png" ? "png" : "jpg";
    return { blob, name: `${base}-w${IMAGE_MAX_WIDTH}.${ext}` };
  }

  // ================= UI 构建 =================
  const uploadSpan = document.createElement("div");
  uploadSpan.className = 'input';
  uploadSpan.style.display = 'flex';
  uploadSpan.style.alignItems = 'center';

  const uploadButton = document.createElement('input');
  uploadButton.type = 'button';
  uploadButton.className = 'btn_ok';
  uploadButton.value = '上传图片';
  uploadButton.style.display = 'block';
  uploadSpan.appendChild(uploadButton);

  const statusText = document.createElement('span');
  statusText.style.marginLeft = '10px';
  statusText.style.fontSize = '12px';
  statusText.style.color = '#666';
  uploadSpan.appendChild(statusText);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = "image/*";
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  const progressContainer = document.createElement('div');
  progressContainer.style.zIndex = '9999';
  progressContainer.style.width = '300px';
  progressContainer.style.padding = '10px';
  progressContainer.style.display = 'none';
  uploadSpan.appendChild(progressContainer);

  const targetElement = document.querySelector('#edit_form > div.pro_box.pro_box_basic_info.current > div:nth-child(14) > span');
  if (targetElement) targetElement.appendChild(uploadSpan);

  // ================= 触发逻辑 =================
  uploadButton.addEventListener('click', () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    uploadQueue = [];
    filesLink = [];

    const arr = Array.from(files);

    for (const f of arr) {
      try {
        statusText.innerText = `处理图片中：${f.name}`;
        statusText.style.color = "#666";
        const processed = await preprocessImage(f);
        uploadQueue.push(processed);
      } catch (e) {
        console.error("preprocess failed:", f.name, e);
        uploadQueue.push({ blob: f, name: f.name });
      }
    }

    statusText.innerText = `开始上传（${uploadQueue.length} 张）...`;
    statusText.style.color = "#666";
    processQueue();
  });

  // ================= 上传处理 =================
  function createProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.style.width = '0';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#2196f3';
    progressBar.style.textAlign = 'center';
    progressBar.style.lineHeight = '20px';
    progressBar.style.color = 'white';
    progressBar.style.marginBottom = '5px';
    progressBar.innerText = '0%';
    progressContainer.insertBefore(progressBar, progressContainer.firstChild);
    return progressBar;
  }

  function processQueue() {
    while (currentUploads < maxConcurrentUploads && uploadQueue.length > 0) {
      const item = uploadQueue.shift();
      uploadFile(item);
    }
  }

  function uploadFile(item) {
    currentUploads++;

    const fileBlob = item.blob;
    const fileName = item.name;

    const baseUrl = getBaseUrl();
    const postUrl = baseUrl + '?do_action=action.file_upload_plugin&size=editor';

    const progressBar = createProgressBar();
    const formData = new FormData();
    formData.append('Filedata', fileBlob, fileName);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', postUrl, true);
    xhr.setRequestHeader("accept", "application/json, text/javascript, */*; q=0.01");
    xhr.setRequestHeader("x-requested-with", "XMLHttpRequest");

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = (event.loaded / event.total) * 100;
        progressBar.style.width = pct + '%';
        progressBar.innerText = pct.toFixed(2) + '%';
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        const fileUrl = response.files[0].url;
        filesLink.push({ name: fileName, link: fileUrl });
        progressBar.style.backgroundColor = '#4caf50';
        progressBar.innerText = 'Upload Complete';
        setTimeout(() => { progressBar.style.display = 'none'; }, 200);
      } else {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#f44336';
        progressBar.innerText = 'Upload Failed';
      }

      currentUploads--;
      processQueue();
      if (uploadQueue.length === 0 && currentUploads === 0) insertImg();
    });

    xhr.addEventListener('error', () => {
      progressBar.style.width = '100%';
      progressBar.style.backgroundColor = '#f44336';
      progressBar.innerText = 'Upload Failed';
      currentUploads--;
      processQueue();
    });

    xhr.send(formData);
  }

  // ================= 插图（alt/title） =================
  function insertImg() {
    filesLink.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

    const titleInput = document.querySelector("input[name='Name_en']");
    const rawTitle = titleInput ? titleInput.value.trim() : "";
    const productTitle = sanitizeTitle(rawTitle);

    let allImagesHtml = "";
    filesLink.forEach((file, index) => {
      let imgAttr = "";
      if (productTitle) {
        const altText = `${productTitle} - View ${index + 1}`;
        imgAttr = ` alt="${altText}" title="${altText}"`;
      }
      allImagesHtml += `<br /><br /><img src="${file.link}"${imgAttr} />`;
    });

    if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances['Description_en']) {
      try { CKEDITOR.instances['Description_en'].insertHtml(allImagesHtml); }
      catch (_) { fallbackInsert(allImagesHtml); }
    } else {
      fallbackInsert(allImagesHtml);
    }

    filesLink = [];
    statusText.innerText = `图片已上传并插入（统一宽${IMAGE_MAX_WIDTH}${SCALE_UP_SMALL_IMAGES ? "，含放大" : ""}+水印）`;
    statusText.style.color = "green";
    setTimeout(() => { statusText.innerText = ""; }, 2500);
  }

  function fallbackInsert(htmlContent) {
    const textareaElement = document.querySelector('#cke_1_contents > textarea') || document.querySelector('#Description_en');
    if (textareaElement) textareaElement.value += htmlContent;
  }

})();
