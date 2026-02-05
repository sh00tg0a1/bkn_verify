# BKN Editor - Business Knowledge Network Editor

一个用于编辑和可视化业务知识网络（BKN）的 Web 应用。

## 功能特性

### 部分1: 文件列表 (FileTree)
- 树形目录结构展示所有 `.bkn` 文件
- 支持增删改查操作：
  - 新建文件/文件夹
  - 重命名文件
  - 删除文件（带确认对话框）
  - 点击文件打开到编辑器
- 文件图标区分类型（network/entity/relation/action）
- 右键菜单支持快速操作

### 部分2: BKN 编辑器 (Editor)
- 基于 Monaco Editor 的 Markdown 编辑器
- 实时语法高亮（YAML frontmatter + Markdown）
- 快捷功能工具栏：
  - **添加实体** - 插入 Entity 模板（含数据属性、逻辑属性结构）
  - **添加关系** - 插入 Relation 模板
  - **添加行动** - 插入 Action 模板
- 自动保存到 localStorage（1秒延迟）

### 部分3: 网络图可视化 (GraphView)
- 使用 React Flow 渲染实体-关系网络图
- 节点类型：
  - Entity 节点（蓝色边框）
  - Action 节点（橙色边框，连接到绑定的 Entity）
- 边类型：
  - Relation 边（实体之间的关系）
- 交互功能：
  - 点击节点查看详情（弹窗显示完整信息）
  - 点击边查看关系详情
  - 缩放、拖拽、自动布局
  - 支持 MiniMap 和 Controls

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI 组件**: shadcn/ui + Tailwind CSS
- **编辑器**: Monaco Editor (@monaco-editor/react)
- **图可视化**: React Flow
- **状态管理**: Zustand
- **解析**: gray-matter (YAML frontmatter) + js-yaml
- **存储**: localStorage
- **图标**: Lucide React
- **主题**: next-themes (支持深色模式)

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 使用说明

1. **初始化**: 首次打开应用会自动加载 `docs/ontology/bkn_docs/examples` 目录下的示例文件
2. **编辑文件**: 在左侧文件树中选择文件，中间编辑器会自动打开
3. **插入模板**: 使用工具栏的"插入"按钮快速添加 Entity/Relation/Action
4. **查看网络图**: 右侧自动显示所有实体和关系的可视化网络图
5. **查看详情**: 点击网络图中的节点或边查看详细信息

## 数据存储

- 所有文件内容存储在浏览器的 `localStorage` 中
- 支持上传 `.bkn` 文件
- 支持下载当前文件
- 支持重置所有数据

## 项目结构

```
bkn_verify/
├── app/                    # Next.js App Router
│   ├── api/examples/      # API 路由：加载示例文件
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 主页面（三栏布局）
│   └── globals.css        # 全局样式
├── components/
│   ├── FileTree/          # 文件树组件
│   ├── Editor/            # 编辑器组件
│   ├── GraphView/         # 网络图组件
│   └── ui/                # shadcn/ui 组件
├── lib/
│   ├── bkn-parser.ts      # BKN 解析器
│   ├── storage.ts         # localStorage 封装
│   ├── store.ts          # Zustand 状态管理
│   └── utils.ts          # 工具函数
├── types/
│   └── bkn.ts            # TypeScript 类型定义
└── docs/ontology/bkn_docs/examples/  # 示例 BKN 文件
```

## 开发说明

### BKN 文件格式

BKN 文件使用 Markdown 格式，包含：
- YAML Frontmatter：文件元数据（type, id, name 等）
- Markdown Body：知识网络定义内容

详细规范请参考 `docs/ontology/bkn_docs/SPECIFICATION.md`

### 解析器

`lib/bkn-parser.ts` 负责：
1. 解析 YAML frontmatter
2. 解析 Markdown body 中的表格和结构化内容
3. 提取 Entity、Relation、Action 信息
4. 合并成统一的 Network JSON 结构

### 状态管理

使用 Zustand store (`lib/store.ts`) 管理：
- 当前打开的文件
- 解析后的网络结构
- 文件变化时的自动刷新

## 许可证

MIT
