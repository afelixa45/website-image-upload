# 网站图片上传助手

Tampermonkey 油猴脚本，用于电商网站商品图片的批量上传。

## 功能

- 图片统一缩放到 850px 宽度（支持小图放大）
- 自动叠加分平台 Logo 水印
- 自动注入 Alt / Title 属性（SEO 优化）
- 并发上传控制（默认最多 3 张同时上传）
- 输出格式 JPEG，质量 100%

## 支持平台

- GundamIT (`gundamit.com`)
- ShowzStore (`showzstore.com`)

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 将 `图片上传脚本.user.js` 导入 Tampermonkey

## 文件说明

| 文件 | 说明 |
|------|------|
| `图片上传脚本.user.js` | 当前版本（V3.1） |
| `图片上传脚本-v1.5-初始版.user.js` | 初始版本存档 |
