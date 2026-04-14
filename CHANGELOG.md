# Changelog

## [3.7] - 2026-04-13

### Added (Tampermonkey 版 + Chrome 插件版同步)
- 水印处理后图片可本地保存（默认关闭，避免日常上传时产生大量下载）
- 本地保存 = **原图分辨率 + Logo 水印**（保留原始长宽比，不做任何缩放），作为高清归档使用
- 主图也按原始长宽比归档，不强制正方形、不加白色背景
- JPEG 质量 0.95（近视觉无损，体积可控），格式与上传版一致（JPEG）
- 文件名格式：`{平台前缀}{原文件名}-orig.jpg`，例如 `SZ_product123-orig.jpg`
- 上传到网站的图片保持与 v3.6 一致（详情图 850 宽、主图 500 正方形），不受本地保存影响

### Tampermonkey 版
- 通过 Tampermonkey 菜单 **"切换本地保存 (开/关)"** 控制
- 状态通过 `GM_setValue` 持久化，top 页面与主图 iframe 共享

### Chrome 插件版
- 插件版从 3.5 一次性升至 3.7，与 Tampermonkey 版功能对齐
- **默认一直开启本地保存**，无需任何开关；装了插件就一直归档
- 不需要新增插件权限，零侵入

## [3.6] - 2026-04-08

### Changed
- Logo 改为 @resource 从 GitHub 加载（原图），移除内嵌 base64
- 脚本从 270KB 缩回 19KB

### Added
- Chrome 插件版本（chrome-extension/）：Manifest V3，MAIN world，CKEditor 支持

## [3.5] - 2026-04-08

### Changed
- 主图水印比例从 0.25 调整为 0.35，视觉上与详情图协调

## [3.4] - 2026-04-06

### Added
- Logo 预存为 base64 嵌入脚本（后改为 @resource）

## [3.3] - 2026-04

### Added
- 自动识别详情图对话框，跳过主图处理

## [3.2] - 2026-04

### Added
- 主图上传自动处理：500x500 正方形 + 白色背景 + Logo 水印
- XHR hook + iframe 监听拦截

## [1.0] - 2026-03

### Added
- 初始版本
- 详情图统一缩放 850px + 分平台 Logo 水印
- Alt/Title 属性自动注入（SEO）
- 并发上传控制
