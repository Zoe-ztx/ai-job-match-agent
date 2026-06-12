# 职引 · AI求职智能匹配智能体

## 快速启动

### 方式一：本地关键词匹配模式（无需API Key）

```bash
cd job-agent
./start.sh
# 或直接：node server.js
```

打开浏览器访问 http://localhost:3000

此模式下智能体只能回答预设的关键词问题，无法理解自然语言。

### 方式二：LLM智能对话模式（推荐）

#### 第1步：获取智谱AI API Key

1. 访问 https://open.bigmodel.cn/ 注册账号
2. 登录后进入「API密钥」页面
3. 点击「添加新API Key」
4. 复制生成的Key（格式如：`xxxxxxxx.xxxxxxxx`）

> 注册即送100万tokens免费额度，足够课程演示使用

#### 第2步：配置并启动

```bash
# 设置API Key
export ZHIPU_API_KEY=你的API密钥

# 启动服务器
cd job-agent
./start.sh
```

打开浏览器访问 http://localhost:3000

## 文件结构

```
job-agent/
├── index.html      # 前端页面（聊天界面）
├── server.js       # 后端代理（调用LLM API）
├── package.json    # 项目依赖
├── start.sh        # 一键启动脚本
└── README.md       # 本文档
```

## 架构说明

```
用户输入 → index.html(前端) → server.js(后端代理) → 智谱AI API
                                                    ↓
用户看到回复 ← index.html ← server.js返回 ← LLM生成结果
```

**为什么需要后端代理？**
- API Key 不能暴露在前端代码中（安全问题）
- 智谱AI API 不允许浏览器直接跨域调用（CORS限制）
- 后端代理负责：API Key管理、请求转发、对话历史管理

## 切换其他LLM提供商

### DeepSeek

```bash
export LLM_PROVIDER=openai-compatible
export LLM_API_URL=https://api.deepseek.com/v1/chat/completions
export LLM_API_KEY=你的DeepSeek密钥
export LLM_MODEL=deepseek-chat
node server.js
```

### 通义千问

```bash
export LLM_PROVIDER=openai-compatible
export LLM_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
export LLM_API_KEY=你的通义千问密钥
export LLM_MODEL=qwen-turbo
node server.js
```

## 降级策略

- 如果后端未启动或API Key未配置，前端会自动降级到本地关键词匹配模式
- 降级模式下只能回答预设格式的问题
- 页面右上角会显示当前连接状态

## 课程作业说明

本项目为课程作业演示，展示AI求职智能匹配智能体的交互设计：

1. **岗位匹配** - 根据用户背景推荐岗位，展示匹配度、来源标注、同背景数据
2. **简历优化** - 分析简历与岗位匹配情况，给出改进建议
3. **对话交互** - 支持多轮对话，用户可以追问和改变条件
4. **LLM集成** - 可接入大语言模型实现真正的自然语言理解
