# 飞书多维表格 TikTok 采集插件（前端）

## 项目简介
- 前端为飞书多维表格边栏插件 UI，需提交到插件仓库由官方静态托管。
- 后端服务独立部署在自有服务器，前端通过 `VITE_API_BASE_URL` 访问。

## 必要约束（飞书要求）
- **提交 `dist/` 静态产物**（官方会直接部署静态文件，避免二次构建失败）。
- **资源路径使用相对路径**（已在 `vite.config.ts` 中设置 `base: './'`）。
- **禁止 history 路由**（如需路由，请使用 hash）。

## 本地开发
### 环境要求
- Node.js >= 18

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本（生成 dist）
```bash
npm run build
```

## 环境变量（`.env` 示例）
```bash
VITE_API_BASE_URL=https://your-backend.example.com
VITE_TIMEOUT_QUOTA=5000
VITE_TIMEOUT_SEARCH=20000
VITE_TIMEOUT_AUDIO=90000
```

## 发布到插件仓库
1. 配置 `VITE_API_BASE_URL` 指向后端 HTTPS 域名。
2. 执行 `npm run build` 生成 `dist/`。
3. 提交 `dist/` 与源码到插件仓库。

> 后端域名确定后需重新构建 `dist/` 并提交。

## 许可证
MIT
