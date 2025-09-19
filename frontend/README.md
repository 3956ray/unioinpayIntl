# Frontend - UnioinPay International

基于 React + TypeScript + Vite 构建的区块链支付前端应用。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
```

### 运行项目

#### 开发模式

```bash
# 启动开发服务器
npm run dev
```

开发服务器将在 `http://localhost:3000` 启动，支持热重载。

#### 构建生产版本

```bash
# 构建项目
npm run build
```

构建文件将输出到 `dist/` 目录。

#### 预览生产版本

```bash
# 预览构建后的项目
npm run preview
```

## 📁 项目结构

```
frontend/
├── public/                 # 静态资源
├── src/                   # 源代码
│   ├── App.tsx           # 主应用组件
│   ├── App.css           # 应用样式
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── index.html            # HTML 模板
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── tsconfig.node.json    # Node.js TypeScript 配置
├── vite.config.ts        # Vite 配置
└── .gitignore           # Git 忽略文件
```

## 🛠️ 技术栈

- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速的构建工具
- **Viem** - 以太坊交互库
- **CSS3** - 样式和布局

## 🔧 开发说明

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 React Hooks 最佳实践
- 保持组件的单一职责原则

### 样式规范

- 使用 CSS Modules 或普通 CSS
- 采用响应式设计
- 支持现代浏览器

### 区块链集成

项目集成了 `viem` 库用于以太坊区块链交互，支持：
- 钱包连接
- 智能合约调用
- 交易处理

## 📝 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run preview` - 预览构建结果
- `npm test` - 运行测试（待配置）

## 🌐 部署

1. 运行 `npm run build` 构建项目
2. 将 `dist/` 目录部署到静态文件服务器
3. 确保服务器支持 SPA 路由（如需要）

## 🤝 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

ISC License