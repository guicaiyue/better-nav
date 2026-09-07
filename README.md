<div align="center">
  <img alt="Better Nav logo" src="./public/logo.svg" width="80" />
  <h1>Better Nav</h1>
  <p>一个把常用网址收拾得干干净净的小站。</p>
</div>

<div align="center">
  <a href="https://dream.baiwumm.com/" target="_blank">
    <img alt="Preview" src="https://img.shields.io/badge/在线预览-dream.baiwumm.com-black?style=flat" />
  </a>
  <a href="https://nextjs.org/" target="_blank">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js" />
  </a>
  <a href="https://www.heroui.com/" target="_blank">
    <img alt="HeroUI" src="https://img.shields.io/badge/HeroUI-v3-black?style=flat" />
  </a>
  <a href="./LICENSE" target="_blank">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue?style=flat" />
  </a>
</div>

## 🌱 简介

`Better Nav` 是一个基于 Next.js 与 PostgreSQL 的个人导航站。

它专注做一件小事：把常用网址放在一起，打开就能用。支持亮暗主题、响应式布局、基础 SEO，以及网站分类与管理。

## 🌿 截图

| 亮色模式 | 暗色模式 |
| --- | --- |
| ![亮色模式](./public/light.png) | ![暗色模式](./public/dark.png) |

| 分类管理 | 站点列表 |
| --- | --- |
| ![分类列表](./public/categorys.png) | ![站点列表](./public/websites.png) |

## ☘️ 技术栈

- Next.js 16 + React 19
- HeroUI v3
- Tailwind CSS v4
- PostgreSQL
- 本地静态文件上传

## 🪴 本地开发

### 🌱 环境要求

- Node.js >= 24
- pnpm

### 🌵 启动项目

```bash
git clone https://github.com/baiwumm/better-nav.git
cd better-nav
pnpm install
pnpm dev
```

先将 `.env.example` 复制为 `.env.local`，再补全你自己的环境变量。

默认访问：`http://localhost:3000`

## 🌼 环境变量

项目主要使用这些环境变量：

```bash
NEXT_PUBLIC_APP_NAME=Better Nav
NEXT_PUBLIC_APP_TITLE=一个把常用网址收拾得干干净净的小站
NEXT_PUBLIC_APP_DESC=把常用网址放在一起，打开就能用。
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_AUTHOR_NAME=
NEXT_PUBLIC_AUTHOR_ROLE=
```

完整示例见 [`.env.example`](./.env.example)。

## 🍀 本地 PostgreSQL 配置

开发环境使用 NAS 本机 PostgreSQL 数据库 `nav`，应用通过 Unix socket 连接。首次部署时创建 `ds_categorys` 和 `ds_websites` 数据表。

## 🌲 部署

生产使用 Docker standalone 镜像 `xirizhi/better-nav:latest`。

- `main` 推送 → GitHub Actions 测试/构建 → Docker Hub 推送 `latest` 和完整提交 SHA → n8n `Watchtower：按镜像检查更新` → 定向更新容器。
- Actions secrets：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`、`N8N_WATCHTOWER_WEBHOOK_URL`。Webhook JSON 仅传不带 tag 的镜像仓库名。
- 首发在仓库目录执行 `docker compose pull`，确认镜像 revision 与目标提交一致后，停止旧 `nav.service`，再 `docker compose up -d`。容器复用 `39125` 端口、宿主 PostgreSQL socket 和 `public/uploads`，不迁移或初始化数据。
- 容器保留 root 身份，以兼容既有 root-owned 0700 上传目录；不扩大宿主目录权限。
- 验收必须核对 Actions 两个 job、n8n 最新执行、容器健康、OCI revision，以及公网首页/管理页/已有数据；HTTP 202 仅表示接收，不等于已上线。
- 回滚：保存日志，`docker compose down`（不加 `-v`），`sudo systemctl enable --now nav.service`。旧 unit 保留，禁止删除数据库或上传目录。
- `NEXT_PUBLIC_*` 是构建期变量；生产公开 URL 在 CI build args 中设置。密钥禁止放入 build args 或镜像。

## 🌸 许可证

[MIT](./LICENSE) © [baiwumm](https://baiwumm.com)
