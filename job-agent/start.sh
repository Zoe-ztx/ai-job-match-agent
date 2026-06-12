#!/bin/bash
# 职引 - 启动脚本（含环境变量）
cd "$(dirname "$0")"

export LLM_PROVIDER=hunyuan
export HUNYUAN_API_KEY="sk-QhzjkkJ249JU4KCkhd0IabUB2V4Jzvg4MdZs6mLczqbQ4KNt"
export SERPAPI_KEY="fe88e88a932da7dda253e012bc125cb4816bcb771276aad1b22045915e8ab600"

echo "🚀 启动职引服务器 (端口 3000)..."
echo "   LLM Provider: $LLM_PROVIDER"
node server.js
