// ==UserScript==
// @name         新品图片上传1.5
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  从本地电脑上传多张图片，并通过队列管理显示上传进度
// @author       name
// @match        https://gundamit.com/manage/?m=products&a=products&d=edit*
// @match        https://showzstore.com/manage/?m=products&a=products&d=edit*
// @match        https://www.gundamit.com/manage/?m=products&a=products&d=edit*
// @match        https://www.showzstore.com/manage/?m=products&a=products&d=edit*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const maxConcurrentUploads = 3;
    let currentUploads = 0;
    let uploadQueue = [];
    let filesLink = [];

    const uploadSpan = document.createElement("div");
    uploadSpan.className = 'input';
    uploadSpan.style.display = 'flex';

    const uploadButton = document.createElement('input');
    uploadButton.type = 'button';
    uploadButton.className = 'btn_ok';
    uploadButton.value = '上传图片';
    uploadButton.style.display = 'block';
    uploadSpan.appendChild(uploadButton);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const progressContainer = document.createElement('div');
    progressContainer.style.zIndex = '9999';
    progressContainer.style.width = '300px';
    progressContainer.style.padding = '10px';
    progressContainer.style.display = 'none';
    uploadSpan.appendChild(progressContainer);

    const targetElement = document.querySelector('#edit_form > div.pro_box.pro_box_basic_info.current > div:nth-child(14) > span');
    if (targetElement) {
        targetElement.appendChild(uploadSpan);
    }

    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        if (files.length > 0) {
            progressContainer.style.display = 'block';
            progressContainer.innerHTML = '';
            Array.from(files).forEach(file => uploadQueue.push(file));
            processQueue();
        }
    });

    function processQueue() {
        while (currentUploads < maxConcurrentUploads && uploadQueue.length > 0) {
            const file = uploadQueue.shift();
            uploadFile(file);
        }
    }
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

    function uploadFile(file) {
        currentUploads++;
        var origin = window.location.origin;
        var postUrl = origin + '/manage/?do_action=action.file_upload_plugin&size=editor';

        const progressBar = createProgressBar();
        const formData = new FormData();
        formData.append('Filedata', file, file.name);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', postUrl, true);
        xhr.withCredentials = true; // 确保发送Cookie
        xhr.setRequestHeader("accept", "application/json, text/javascript, */*; q=0.01");
        xhr.setRequestHeader("x-requested-with", "XMLHttpRequest");

        xhr.upload.addEventListener('progress', (event) => handleProgress(event, progressBar));
        xhr.addEventListener('load', () => handleLoad(xhr, progressBar, file.name));
        xhr.addEventListener('error', () => handleError(xhr, progressBar, file.name));

        xhr.send(formData);
    }
    function handleProgress(event, progressBar) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = percentComplete + '%';
            progressBar.innerText = percentComplete.toFixed(2) + '%';
        }
    }

    function handleLoad(xhr, progressBar, fileName) {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            const fileUrl = response.files[0].url;
            filesLink.push({ name: fileName, link: fileUrl });
            progressBar.style.backgroundColor = '#4caf50';
            progressBar.innerText = '上传完成';
            setTimeout(() => {
                progressBar.style.display = 'none';
            }, 200);
        } else {
            handleError(xhr, progressBar, fileName);
        }
        currentUploads--;
        processQueue();

        if (uploadQueue.length === 0 && currentUploads === 0) {
            insertImg();
        }
    }

    function handleError(xhr, progressBar, fileName = '') {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#f44336';
        progressBar.innerText = '上传失败 ' + fileName;
        try {
            const response = JSON.parse(xhr.responseText);
            console.log('上传失败，服务器响应：', response);
        } catch (e) {
            console.log('上传失败，服务器响应：', xhr.responseText);
        }
    }

    function insertImg() {
        filesLink.sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));
        filesLink.forEach(file => {
            const imgHtml = `\n<br /><br /><img src="${file.link}" />`;
            const textareaElement = document.querySelector('#cke_1_contents > textarea');
            if (textareaElement) {
                const cursorPos = textareaElement.selectionStart;
                const textBeforeCursor = textareaElement.value.substring(0, cursorPos);
                const textAfterCursor = textareaElement.value.substring(cursorPos, textareaElement.value.length);
                textareaElement.value = textBeforeCursor + imgHtml + textAfterCursor;

                const newCursorPos = cursorPos + imgHtml.length;
                textareaElement.setSelectionRange(newCursorPos, newCursorPos);
                textareaElement.focus();
            } else {
                console.error('未找到文本区域元素。');
            }
        });
        filesLink = [];
    }
})();