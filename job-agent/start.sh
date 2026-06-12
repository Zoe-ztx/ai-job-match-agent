#!/bin/bash
# AI求职智能匹配智能体 - 启动脚本

echo "================================================"
echo "  职引 · AI求职智能匹配智能体"
echo "================================================"
echo ""

# 检查是否已配置API Key
if [ -z "$ZHIPU_API_KEY" ] && [ -z "$LLM_API_KEY" ]; then
  echo "⚠️  未检测到API Key环境变量"
  echo ""
  echo "当前将以「本地关键词匹配」模式运行（功能有限）"
  echo ""
  echo "要启用LLM智能对话，请先获取API Key："
  echo "  1. 访问 https://open.bigmodel.cn/ 注册智谱AI账号"
  echo "  2. 在控制台创建API Key"
  echo "  3. 运行：export ZHIPU_API_KEY=你的密钥"
  echo "  4. 重新运行本脚本"
  echo ""
  echo "注册即送100万tokens免费额度！"
  echo "================================================"
  echo ""
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "正在安装依赖..."
  npm install --cache /tmp/npm-cache
  echo ""
fi

# 启动服务器
echo "正在启动服务器..."
node server.js
