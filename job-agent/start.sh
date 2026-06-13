#!/bin/bash
# 职引 - 启动脚本（含环境变量）
cd "$(dirname "$0")"

# 请先设置环境变量，或创建 .env 文件
export LLM_PROVIDER=hunyuan
export HUNYUAN_API_KEY="${HUNYUAN_API_KEY:?请设置 HUNYUAN_API_KEY 环境变量}"
export SERPAPI_KEY="${SERPAPI_KEY:-}"

echo "🚀 启动职引服务器 (端口 3000)..."
echo "   LLM Provider: $LLM_PROVIDER"
node server.js
