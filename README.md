# Bangumi to Notion Sync

一个基于Github Action平台的定时同步工具，用于将Bangumi的用户动漫收藏信息同步到Notion的画廊视图数据库中。

## 功能特点

- 自动同步用户在Bangumi上的想看、在看、看过的动漫列表
- 在Notion中以画廊视图展示，卡片预览使用番剧封面
- 同步番剧的详细信息，包括：番剧名称、中文名、话数、放送时间、状态、评分、类型、标签等
- 每天自动同步，也可手动触发

## 配置步骤

### 1. Fork 本仓库

首先，点击页面右上角的 "Fork" 按钮，将本仓库复制到你自己的Github账户中。

### 2. 获取 Notion API Key

1. 访问 [Notion Developers](https://developers.notion.com/)
2. 点击 "My integrations"，然后点击 "New integration"
3. 填写集成名称（例如：Bangumi Sync），选择相关工作区
4. 在 "Capabilities" 部分，确保勾选了 "Read content"、"Update content"、"Insert content" 权限
5. 点击 "Submit"，然后复制生成的 API Key

### 3. 创建 Notion 数据库

1. 在Notion中创建一个新的数据库（选择 "Table" 视图即可）
2. 复制数据库的 ID（从URL中获取，格式为：`https://www.notion.so/{workspace}/{database_id}?v=...`）
3. 分享数据库给你的集成：
   - 点击数据库右上角的 "Share" 按钮
   - 点击 "Add people, emails, groups"
   - 输入你创建的集成名称，然后点击 "Invite"

### 4. 配置 Github Secrets

在你Fork的仓库中：

1. 点击 "Settings" -> "Secrets and variables" -> "Actions"
2. 点击 "New repository secret"
3. 添加以下三个Secret：

   - `BANGUMI_USERNAME`: 你的Bangumi用户名
   - `NOTION_API_KEY`: 你在步骤2中获取的Notion API Key
   - `NOTION_DATABASE_ID`: 你在步骤3中获取的Notion数据库ID

### 5. 触发同步

- **手动触发**：在仓库的 "Actions" 标签页中，选择 "Sync Bangumi to Notion" 工作流，然后点击 "Run workflow"
- **自动触发**：工作流会每天凌晨自动执行

## 数据映射

| Bangumi 字段 | Notion 属性 | 类型 |
|-------------|------------|------|
| name | 番剧名称 | 标题 |
| name_cn | 中文名 | 富文本 |
| eps | 话数 | 数字 |
| air_date | 放送时间 | 日期 |
| status | 状态 | 选择 |
| id | Bangumi ID | 数字 |
| rating.score | 评分 | 数字 |
| tags (category=genre) | 类型 | 多选 |
| tags (category!=genre) | 标签 | 多选 |
| collection_status | 收藏状态 | 选择 |
| images.large | 封面 | 页面封面 |

## 常见问题

### 同步失败怎么办？

1. 检查Github Action的运行日志，查看具体错误信息
2. 确保Secrets配置正确
3. 确保Notion数据库已正确分享给集成
4. 确保Bangumi用户名正确

### 如何更新同步频率？

编辑 `.github/workflows/sync.yml` 文件中的 `cron` 表达式，修改为你想要的同步频率。

## 技术栈

- Node.js
- @notionhq/client
- node-fetch
- Github Actions

## API 文档

- [Notion API 文档](https://developers.notion.com/guides/get-started/getting-started)
- [Bangumi API 文档](https://bangumi.github.io/api/)