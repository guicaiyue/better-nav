# 网站源数据与表数据设计

本文件是 Nav 网站源数据的设计依据，随代码库维护，不属于 Agent 项目经验。下列 JSON 合并网站基础信息与 GitHub 仓库快照，示例值不代表真实站点数据。

## 完整数据结构

```json
{
  "name": "示例工具",
  "official_url": "https://example.com",
  "github_url": "https://github.com/example/tool",
  "github": {
    "repo_id": 123456789,
    "full_name": "example/tool",
    "description": "A simple document processing tool",
    "stars": 1280,
    "forks": 96,
    "language": "TypeScript",
    "license": "MIT",
    "archived": false,
    "last_push_at": "2026-09-08T09:00:00Z",
    "fetched_at": "2026-09-10T08:00:00Z"
  },
  "related_links": {
    "使用文档": "https://example.com/docs",
    "在线演示": "https://demo.example.com"
  },
  "self_description": "让每个人都能轻松处理 PDF，无需安装复杂软件。",
  "description": "在浏览器中合并、拆分 PDF 文档",
  "features": [
    "合并多个 PDF",
    "提取指定页面"
  ],
  "category": "媒体与内容",
  "tags": ["无需注册"],
  "ai_review": "适合临时合并或拆分文档。官网说明无需注册，但尚未实测；文件处理位置和留存政策未确认，处理敏感材料前应先核实。",
  "reviewed_at": "2026-09-10T16:10:00+08:00",
  "is_archived": false,
  "created_at": "2026-09-10T16:00:00+08:00"
}
```


## 字段边界

- `github_url` 为关联仓库地址，无关联仓库时可为 `null`；`github` 保存仓库快照。
- `self_description` 为网站自述，`description` 为简洁功能描述，`ai_review` 为评价；未实测、未确认的信息须保留限定。
- `related_links` 为链接名称到 URL 的映射；`features`、`tags` 为字符串数组。
- 网站 `is_archived` 与仓库 `github.archived` 分别表达各自归档状态。
- `created_at`、`reviewed_at`、`github.last_push_at`、`github.fetched_at` 分别记录网站创建、评价、仓库推送、快照抓取时间。

本文件定义业务数据结构，嵌套 JSON 不直接规定物理分表方式。此次归档仅更新设计文档，不代表数据库迁移或 API 实现已同步变更。
