// AI求职智能匹配智能体 - 后端代理服务器
// 负责调用智谱AI API，避免前端暴露API Key

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = 3000;

// ===== SerpAPI 配置 =====
const SERPAPI_KEY = process.env.SERPAPI_KEY || 'fe88e88a932da7dda253e012bc125cb4816bcb771276aad1b22045915e8ab600';

// ===== 配置 =====
// 支持三种LLM提供商：zhipu（智谱AI）、hunyuan（腾讯混元）、openai-compatible（通用）
// 通过环境变量 LLM_PROVIDER 切换，默认 zhipu

// 预设提供商配置
const PROVIDERS = {
  zhipu: {
    name: '智谱AI (GLM-4)',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKeyEnv: 'ZHIPU_API_KEY',
    model: 'glm-4-flash'
  },
  hunyuan: {
    name: '腾讯混元 (Hunyuan)',
    apiUrl: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    apiKeyEnv: 'HUNYUAN_API_KEY',
    model: 'hunyuan-turbos-latest'
  },
  hunyuan_tokenhub: {
    name: '腾讯混元 TokenHub (Hy3)',
    apiUrl: 'https://tokenhub.tencentmaas.com/v1/chat/completions',
    apiKeyEnv: 'HUNYUAN_API_KEY',
    model: 'hy3-preview'
  }
};

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// multer 配置：文件上传到内存
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ===== 系统提示词 =====
const SYSTEM_PROMPT = `你是"职引"——一个AI求职智能匹配助手，专门帮助应届毕业生匹配岗位并提升简历初筛命中率。

## 你的核心能力
1. 岗位匹配 - 根据用户背景推荐最适合的岗位
2. 竞争力分析 - 分析用户在市场中的定位
3. 简历优化 - 给出具体的简历改进建议
4. 投递计划 - 帮用户规划求职时间表

## 用户画像
当前用户信息未知。你需要在对话开始时主动收集以下信息，但不要一次性全部追问，要自然地融入对话：

必须收集的信息：
1. 学历背景（学校层次/专业/年级）
2. 技术技能（编程语言/框架/工具）
3. 项目经历（做了什么、用了什么技术、成果如何）
4. 实习经历（有无、在哪里、做了什么）
5. 期望薪资范围
6. 意向城市

收集方式：
- 用户第一次打招呼时，先简单介绍自己，然后温和地询问1-2个关键问题（如学历和专业）
- 根据用户回复自然地追问下一项，不要像审讯一样连续提问
- 用户如果主动提供了某些信息，要记住并不要重复追问
- 如果用户上传了简历，则从简历中提取信息，提取后让用户确认和补充
- 收集到足够信息后再开始推荐岗位

## 回复格式要求

### 当你推荐岗位时，必须使用以下HTML格式：
【重要】每个岗位用一个div class="job-card"包裹，必须包含所有子元素，格式严格如下：

<div class="job-card">
  <div class="job-card-header">
    <span class="job-title">岗位完整名称</span>
    <span class="match-badge match-high">匹配度 92%</span>
  </div>
  <div class="job-meta">
    <span>公司名称</span><span>·</span><span>城市</span><span>·</span><span>薪资范围</span><span>·</span><span>应届可投</span><span>·</span><span>投递截止：YYYY-MM-DD</span>
  </div>
  <div class="job-meta"><span class="job-source">来源：BOSS直聘/牛客网/公司官网</span></div>
  <div class="tags">
    <span class="tag match">匹配的技能1</span>
    <span class="tag match">匹配的技能2</span>
    <span class="tag unmatch">不匹配的点1</span>
  </div>
  <div class="section-title">为什么匹配</div>
  <div class="match-item">匹配原因1，具体说明</div>
  <div class="match-item">匹配原因2</div>
  <div class="section-title">为什么不匹配</div>
  <div class="unmatch-item">不匹配原因1</div>
  <div class="section-title">补强建议</div>
  <div class="gap-item">建议1，具体可操作</div>
  <div class="stats-card">
    同背景求职者初筛通过率：XX%<br>
    同背景求职者去向：方向A(X%) · 方向B(X%) · 方向C(X%)<br>
    <div class="stats-source">数据来源：2025校招数据及招聘平台统计</div>
  </div>
  <div class="apply-section">
    <a href="真实投递链接" target="_blank" class="apply-btn">立即投递 →</a>
  </div>
</div>

【颜色规则】match-badge：≥80%用match-high（绿色），60-79%用match-mid（黄色），<60%用match-low（红色）
【数量规则】每次最多推荐3个岗位，按匹配度从高到低排序
【链接规则】apply-btn的href必须等于对应公司的真实招聘链接，不能混搭其他公司链接！

### 当用户询问"同背景求职者去向"时：
展示不受用户前提条件限制的市场真实数据，包括：
- 岗位方向分布
- 城市分布（北京/上海/深圳/杭州/成都等）
- 薪资水平分布
- 具体公司+岗位Top10表格
- 所有数据必须标注来源

### 其他回复格式：
- 使用HTML标签增强可读性（<strong>加粗关键词</strong>）
- 直接输出HTML内容，不要用markdown代码块（三个反引号）包裹
- 用•或数字编号列表
- 适当使用emoji增强视觉
- 建议简短有力，不要废话

## 重要规则
1. 所有数据必须标注来源（如"数据来源：2024-2025校招数据及BOSS直聘统计"）
2. 不确定的数据要注明是"参考数据"或"估算值"
3. 保持专业但亲切的语气，像学长/学姐给建议
4. 可以反问用户以获取更多信息
5. 当用户改变求职方向/城市/薪资期望时，要基于新条件给出建议
6. 支持多轮对话，记住之前讨论的内容
7. 不要预设用户的任何背景信息，一切从对话中获取
8. 如果用户信息不足就要求推荐岗位，先温和地提醒需要了解更多信息，但仍然给出初步建议`;

// ===== 对话历史存储（按session） =====
const sessions = {};

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }
  return sessions[sessionId];
}

// ===== 调用智谱AI API =====
function callZhipuAPI(messages) {
  return new Promise((resolve, reject) => {
    if (!ZHIPU_API_KEY) {
      reject(new Error('API Key未配置，请在server.js中设置ZHIPU_API_KEY或通过环境变量传入'));
      return;
    }

    const body = JSON.stringify({
      model: 'glm-4-flash',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.9
    });

    const options = {
      hostname: 'open.bigmodel.cn',
      port: 443,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API调用失败'));
          } else if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error('API返回格式异常: ' + data.substring(0, 200)));
          }
        } catch (e) {
          reject(new Error('解析API响应失败: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error('网络请求失败: ' + e.message));
    });

    req.write(body);
    req.end();
  });
}

// ===== 兼容OpenAI格式的API调用（适用于DeepSeek等其他API） =====
function callOpenAICompatibleAPI(messages, apiUrl, apiKey, model, maxTokens) {
  return new Promise((resolve, reject) => {
    if (!apiUrl || !apiKey) {
      reject(new Error('API URL或API Key未配置'));
      return;
    }

    const url = new URL(apiUrl);
    const body = JSON.stringify({
      model: model || 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: maxTokens || 2048
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API调用失败'));
          } else if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error('API返回格式异常'));
          }
        } catch (e) {
          reject(new Error('解析API响应失败'));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error('网络请求失败: ' + e.message));
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('LLM API调用超时'));
    });

    req.write(body);
    req.end();
  });
}

// 文本去重处理（解决PDF提取重复问题）
function deduplicateText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const result = [];
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Step 1: 去除双冒号
    trimmed = trimmed.replace(/([：：])\1+/g, '$1');

    // Step 2: 去除 "技能:技能:" 模式
    let prev = '';
    let iters = 10;
    while (prev !== trimmed && iters-- > 0) {
      prev = trimmed;
      trimmed = trimmed.replace(/([^：：\n\r]{1,25})\s*:\s*\1\s*:/g, '$1:');
    }

    // Step 3: 去除 "AbA:" 模式
    prev = '';
    iters = 10;
    while (prev !== trimmed && iters-- > 0) {
      prev = trimmed;
      trimmed = trimmed.replace(/([^：：\n\r]{2,30})\1([：:])/g, '$1$2');
    }

    // Step 4: 中文短词紧邻重复
    prev = '';
    iters = 10;
    while (prev !== trimmed && iters-- > 0) {
      prev = trimmed;
      trimmed = trimmed.replace(/([\u4e00-\u9fa5]{2,15})\1/g, '$1');
    }

    // Step 5: 英文紧邻重复
    prev = '';
    iters = 5;
    while (prev !== trimmed && iters-- > 0) {
      prev = trimmed;
      trimmed = trimmed.replace(/([A-Za-z][A-Za-z\s&.,\-]{5,80}?)\1/g, '$1');
    }

    // Step 6: 长句重复（滑动窗口）
    for (let len = Math.min(100, Math.floor(trimmed.length * 0.45)); len >= 8; len--) {
      let found = false;
      for (let i = 0; i <= trimmed.length - 2 * len && !found; i++) {
        const sub = trimmed.substring(i, i + len);
        const rest = trimmed.substring(i + len);
        const idx = rest.indexOf(sub);
        if (idx !== -1 && idx < len * 1.5) {
          trimmed = trimmed.substring(0, i + len) + rest.substring(idx + len);
          found = true;
        }
      }
      if (found) break;
    }

    // Step 7: catch-all
    prev = '';
    iters = 5;
    while (prev !== trimmed && iters-- > 0) {
      prev = trimmed;
      trimmed = trimmed.replace(/(.{3,50})\1/g, '$1');
    }

    if (trimmed && (result.length === 0 || result[result.length - 1] !== trimmed)) {
      result.push(trimmed);
    }
  }
  return result.join('\n');
}

// 字段名映射（兼容LLM返回的中文键名）
function normalizeParsedFields(parsed) {
  const fieldMap = {
    edu: ['edu', '学历背景', '教育背景', 'education', '学校', '学历', '院校'],
    skills: ['skills', '技术技能', '技能', '专业技能', '技术栈', 'Skill'],
    projects: ['projects', '项目经历', '项目', 'project', '项目经验'],
    intern: ['intern', '实习经历', '工作经历', '工作', '实习', 'work', '工作经验'],
    salary: ['salary', '期望薪资', '薪资', '期望工资', '工资'],
    city: ['city', '意向城市', '城市', 'location', '工作城市'],
    direction: ['direction', '求职方向', '方向', '求职意向', '岗位方向', '意向岗位']
  };

  const normalized = {};
  for (const [stdKey, aliases] of Object.entries(fieldMap)) {
    let value = '';
    for (const alias of aliases) {
      if (parsed[alias] !== undefined && parsed[alias] !== null && parsed[alias] !== '') {
        value = parsed[alias];
        break;
      }
    }
    // 数组转字符串
    if (Array.isArray(value)) {
      value = value.join(stdKey === 'edu' ? '；' : ' / ');
    }
    normalized[stdKey] = String(value);
  }
  return normalized;
}

// ===== 联网搜索岗位（SerpAPI） =====
function searchJobs(query, numResults) {
  return new Promise((resolve, reject) => {
    if (!SERPAPI_KEY) {
      reject(new Error('SerpAPI Key未配置'));
      return;
    }

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&num=${numResults || 10}&hl=zh-cn&gl=cn&api_key=${SERPAPI_KEY}`;

    const url = new URL(searchUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = [];

          // 提取有机搜索结果
          if (json.organic_results) {
            for (const r of json.organic_results) {
              results.push({
                title: r.title || '',
                link: r.link || '',
                snippet: r.snippet || ''
              });
            }
          }

          // 提取招聘相关结果（jobs_results，部分搜索会返回）
          if (json.jobs_results) {
            for (const r of json.jobs_results) {
              results.push({
                title: r.title || '',
                link: r.apply_link || r.link || '',
                snippet: (r.snippet || r.description || '') + (r.location ? ' | 地点：' + r.location : '') + (r.detected_extensions && r.detected_extensions.posted_at ? ' | 发布时间：' + r.detected_extensions.posted_at : ''),
                isJobResult: true
              });
            }
          }

          resolve(results);
        } catch (e) {
          reject(new Error('解析搜索结果失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error('搜索请求失败: ' + e.message));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('搜索请求超时'));
    });

    req.end();
  });
}

// ===== API路由 =====

// 简历解析接口 - 用LLM从简历文本中提取结构化信息
// 简历解析接口 - 用LLM从简历文本中提取结构化信息
// 简历解析接口 - 用LLM从简历文本中提取结构化信息
app.post('/api/parse-resume', async (req, res) => {
  try {
    let { resumeText, sessionId } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: '简历内容不能为空' });
    }

    // 先对文本去重（PDF提取可能有重复）
    resumeText = deduplicateText(resumeText);

    // 如果文本太长，截断保留关键信息（避免LLM超时）
    const MAX_TEXT_LEN = 1200;
    let truncatedText = resumeText;
    if (resumeText.length > MAX_TEXT_LEN) {
      truncatedText = resumeText.substring(0, MAX_TEXT_LEN) + '\n...（简历内容过长，已截断）';
    }

    const parsePrompt = `请从以下简历内容中提取信息，并按以下格式返回（每一行一个类别，前面必须写类别名）：

学历背景：（学校+专业+学历层次+时间，如有多个用分号分隔）
技术技能：（所有技能/证书/语言成绩，用斜杠分隔）
项目经历：（简要概括每个项目名称+角色+关键成果，多条用换行分隔）
实习/工作经历：（公司+岗位+时间+核心工作，无则写"无"）
期望薪资范围：（如"15k-22k"，未提及则写"未填写"）
意向城市：（如"北京/上海"，未提及则写"未填写"）
求职方向：（根据专业和经历推断，未明确则写"未填写"）

注意：
1. 简历文本可能存在重复内容，请忽略重复，只提取一次。
2. 必须按上面7个类别输出，每个类别占一行，以"类别名："开头。
3. 如果某类信息在简历中找不到，该类写"未识别"或"未填写"。
4. 不要输出任何其他文字，只输出这7行。

简历内容：
${truncatedText}`;

    const messages = [
      { role: 'system', content: '你是一个简历信息提取助手。请严格按照指定格式输出7行 categorized 信息，每行以"类别名："开头，不要输出其他内容。' },
      { role: 'user', content: parsePrompt }
    ];

    const provider = process.env.LLM_PROVIDER || 'zhipu';
    const providerConfig = PROVIDERS[provider];
    let reply;

    if (providerConfig) {
      const apiKey = process.env[providerConfig.apiKeyEnv] || '';
      reply = await callOpenAICompatibleAPI(messages, providerConfig.apiUrl, apiKey, providerConfig.model, 2048);
    } else if (provider === 'openai-compatible') {
      const apiUrl = process.env.LLM_API_URL || '';
      const apiKey = process.env.LLM_API_KEY || '';
      const model = process.env.LLM_MODEL || 'deepseek-chat';
      reply = await callOpenAICompatibleAPI(messages, apiUrl, apiKey, model, 2048);
    }

    if (!reply) {
      return res.status(500).json({ error: 'LLM未返回内容' });
    }

    console.log('LLM raw reply:', reply);

    // 从 categorized 文本中提取7个字段
    const parsed = parseCategorizedText(reply);
    console.log('Parsed from text:', JSON.stringify(parsed));

    res.json({ parsed: parsed });
  } catch (err) {
    console.error('Parse resume error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 从 categorized 文本中解析7个字段
function parseCategorizedText(text) {
  const result = {
    edu: '', skills: '', projects: '', intern: '', salary: '', city: '', direction: ''
  };

  // 映射：类别关键词 -> 标准字段名
  const categoryMap = {
    '学历背景': 'edu',
    '技术技能': 'skills',
    '项目经历': 'projects',
    '实习/工作经历': 'intern',
    '实习/工作': 'intern',
    '工作经历': 'intern',
    '实习经历': 'intern',
    '期望薪资范围': 'salary',
    '期望薪资': 'salary',
    '薪资范围': 'salary',
    '意向城市': 'city',
    '城市': 'city',
    '求职方向': 'direction',
    '方向': 'direction'
  };

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 匹配 "类别名：内容" 或 "类别名:内容"
    const match = trimmed.match(/^([^：:]+)[：:]\s*(.*)$/);
    if (match) {
      const catName = match[1].trim();
      const content = match[2].trim();

      // 找到对应的标准字段
      let field = null;
      for (const [key, val] of Object.entries(categoryMap)) {
        if (catName.includes(key)) {
          field = val;
          break;
        }
      }

      if (field && content && content !== '未识别' && content !== '未填写' && content !== '无') {
        result[field] = content;
      }
    }
  }

  return result;
}

app.post('/api/set-context', async (req, res) => {
  try {
    const { sessionId, userInfo, func } = req.body;
    const session = getSession(sessionId || 'default');

    // 构建包含用户信息的系统提示词
    const userInfoStr = Object.entries(userInfo)
      .filter(([k, v]) => v && v !== '未识别，请填写' && v !== '未填写' && v !== '-')
      .map(([k, v]) => {
        const labels = { edu: '学历背景', skills: '技术技能', projects: '项目经历', intern: '实习经历', salary: '期望薪资', city: '意向城市', direction: '求职方向' };
        return labels[k] + '：' + v;
      }).join('\n');

    const funcLabels = { match: '岗位智能匹配', resume: '简历优化诊断', market: '市场竞争分析', plan: '求职计划制定' };
    const funcLabel = funcLabels[func] || '岗位智能匹配';

    const contextPrompt = SYSTEM_PROMPT + '\n\n## 当前用户已确认的信息\n' + userInfoStr + '\n\n当前用户选择的功能是：' + funcLabel + '。用户已通过简历上传和信息确认流程提供了以上信息，你不需要再询问这些已知信息，直接基于这些信息为用户提供服务。';

    // 清空session，设置新的系统提示词
    sessions[sessionId || 'default'] = [
      { role: 'system', content: contextPrompt }
    ];

    res.json({ success: true });
  } catch (err) {
    console.error('Set context error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== 联网岗位匹配接口 =====
app.post('/api/match-jobs', async (req, res) => {
  try {
    const { userInfo, sessionId } = req.body;
    if (!userInfo) {
      return res.status(400).json({ error: '用户信息不能为空' });
    }

    // 1. 根据用户信息构建搜索关键词
    const direction = userInfo.direction || '';
    const city = userInfo.city || '';
    const skills = userInfo.skills || '';
    const edu = userInfo.edu || '';

    // 提取求职方向关键词
    const dirKeywords = direction.replace(/[\/、，,]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
    const cityKeyword = city.replace(/[\/、，,]/g, ' ').trim().split(/\s+/)[0] || '';

    const searchQueries = [];
    if (dirKeywords) {
      searchQueries.push(`${dirKeywords} ${cityKeyword} 2025校招 应届生 招聘`.trim());
      searchQueries.push(`${dirKeywords} 实习 春招 2025`.trim());
    } else {
      searchQueries.push(`应届生 ${cityKeyword} 2025校招 招聘`.trim());
    }

    // 2. 联网搜索真实岗位
    let allSearchResults = [];
    for (const query of searchQueries) {
      try {
        console.log('Searching:', query);
        const results = await searchJobs(query, 8);
        allSearchResults = allSearchResults.concat(results);
      } catch (e) {
        console.error('Search error for query "' + query + '":', e.message);
      }
    }

    // 去重（按link去重）
    const seen = new Set();
    const uniqueResults = allSearchResults.filter(r => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    });

    console.log('Found', uniqueResults.length, 'unique search results');

    // 3. 构建搜索结果摘要（限制8条避免超长），带编号方便LLM对应
    let searchContext = '';
    if (uniqueResults.length > 0) {
      searchContext = '\n\n## 联网搜索到的真实岗位（每条带编号，推荐时必须对应编号使用链接）\n';
      for (let i = 0; i < Math.min(uniqueResults.length, 5); i++) {
        const r = uniqueResults[i];
        searchContext += `\n[搜索结果${i + 1}] 标题：${r.title}\n  链接：${r.link}\n  摘要：${r.snippet}\n`;
      }
    }

    // 4. 构建用户信息摘要
    const labels = { edu: '学历背景', skills: '技术技能', projects: '项目经历', intern: '实习经历', salary: '期望薪资', city: '意向城市', direction: '求职方向' };
    const userInfoStr = Object.entries(userInfo)
      .filter(([k, v]) => v && v !== '未识别' && v !== '未填写' && v !== '未识别，请填写')
      .map(([k, v]) => labels[k] + '：' + v)
      .join('\n');

    // 5. 构建匹配提示词
    var today = new Date().toISOString().split('T')[0];
    var matchPrompt = '用户信息：\n' + userInfoStr + '\n' + searchContext + '\n\n请根据上述信息，推荐3个可投递岗位，按匹配度从高到低排序。\n\n【HTML格式】每个岗位必须用div class="job-card"包裹，包含：\n- job-card-header: job-title + match-badge(匹配度XX%)\n- job-meta: 公司·城市·薪资·应届可投·投递截止YYYY-MM-DD\n- job-source: 来源\n- tags: tag match(匹配技能) + tag unmatch(不匹配点)\n- section-title + match-item(匹配原因)\n- section-title + unmatch-item(不匹配原因)\n- section-title + gap-item(补强建议)\n- stats-card: 同背景通过率+去向\n- apply-section: a.apply-btn(立即投递，href用真实链接)\n\n【颜色】match-badge: >=80% match-high绿色, 60-79% match-mid黄色, <60% match-low红色\n【链接】apply-btn的href必须等于对应公司搜索结果的链接，不能混搭！\n今天是' + today + '。直接输出纯HTML，不要用代码块包裹。';

    // 6. 用精简的system prompt
    var messages = [
      { role: 'system', content: '你是"职引"AI求职助手。推荐岗位时每个岗位必须用div class="job-card"包裹，包含：job-card-header(job-title+match-badge)、job-meta、job-source、tags(tag match/unmatch)、section-title、match-item、unmatch-item、gap-item、stats-card、apply-section(apply-btn)。匹配度>=80%用match-high绿色，60-79%用match-mid黄色，<60%用match-low红色。每次最多3个岗位，按匹配度排序。直接输出纯HTML。' },
      { role: 'user', content: matchPrompt }
    ];

    console.log('Calling LLM, prompt length:', matchPrompt.length);

    const provider = process.env.LLM_PROVIDER || 'zhipu';
    const providerConfig = PROVIDERS[provider];
    let reply;

    if (providerConfig) {
      const apiKey = process.env[providerConfig.apiKeyEnv] || '';
      reply = await callOpenAICompatibleAPI(messages, providerConfig.apiUrl, apiKey, providerConfig.model, 4096);
    } else if (provider === 'openai-compatible') {
      const apiUrl = process.env.LLM_API_URL || '';
      const apiKey = process.env.LLM_API_KEY || '';
      const model = process.env.LLM_MODEL || 'deepseek-chat';
      reply = await callOpenAICompatibleAPI(messages, apiUrl, apiKey, model, 4096);
    }

    if (!reply) {
      return res.status(500).json({ error: 'LLM未返回内容' });
    }

    // 后处理：验证job-card中的链接和公司是否对应
    // 构建域名→链接的映射
    const domainMap = {};
    for (const r of uniqueResults) {
      try {
        const hostname = new URL(r.link).hostname.replace(/^www\./, '');
        const mainDomain = hostname.split('.').slice(-2).join('.');
        if (!domainMap[mainDomain]) domainMap[mainDomain] = [];
        domainMap[mainDomain].push(r.link);
      } catch (e) {}
    }

    // 清理LLM返回的markdown代码标记
    reply = reply.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // 检查每个job-card中的链接：如果公司名和链接域名不匹配，尝试替换
    let fixedReply = reply;
    const jobCards = reply.match(/<div class="job-card">[\s\S]*?<\/div>\s*<\/div>/g) || [];
    for (const card of jobCards) {
      // 提取公司名（从job-meta中的第一个span）
      const companyMatch = card.match(/<div class="job-meta">[\s\S]*?<span>([^<]+)<\/span>/);
      // 提取apply-btn的链接
      const linkMatch = card.match(/href="([^"]+)"[^>]*class="apply-btn"/);

      if (companyMatch && linkMatch) {
        const company = companyMatch[1].trim();
        const applyLink = linkMatch[1];

        // 检查链接域名是否和公司名有关
        try {
          const linkHostname = new URL(applyLink).hostname.replace(/^www\./, '');
          const linkMainDomain = linkHostname.split('.').slice(-2).join('.');

          // 公司名关键词→域名映射
          const companyDomainHints = {
            '腾讯': 'tencent', '阿里': 'alibaba', '阿里巴巴': 'alibaba',
            '字节': 'bytedance', '字节跳动': 'bytedance', '百度': 'baidu',
            '美团': 'meituan', '京东': 'jd', '网易': 'netease',
            '华为': 'huawei', '小米': 'xiaomi', '滴滴': 'didiglobal',
            '拼多多': 'pinduoduo', '快手': 'kuaishou', '携程': 'ctrip',
            '去哪': 'qunar', '小红书': 'xiaohongshu', 'B站': 'bilibili',
            '哔哩哔哩': 'bilibili', 'OPPO': 'oppo', 'VIVO': 'vivo',
            '微众': 'webank', '平安': 'pingan', '顺丰': 'sf-express',
            'BOSS': 'zhipin', '智联': 'zhaopin', '拉勾': 'lagou',
            '牛客': 'nowcoder',
            '招商银行': 'cmbchina', '招行': 'cmbchina', '招商': 'cmbchina',
            '深圳出版': 'sdc', '出版集团': 'sdc',
            '应届生': 'yingjiesheng', '应届': 'yingjiesheng',
            'CUHK': 'cuhk', '港城': 'cityu', '城大': 'cityu'
          };

          let matchedDomain = null;
          for (const [keyword, domain] of Object.entries(companyDomainHints)) {
            if (company.includes(keyword)) {
              matchedDomain = domain;
              break;
            }
          }

          if (matchedDomain && !linkMainDomain.includes(matchedDomain)) {
            // 链接和公司不匹配，尝试替换为搜索结果中正确的链接
            if (domainMap[matchedDomain]) {
              const correctLink = domainMap[matchedDomain][0];
              fixedReply = fixedReply.replace(applyLink, correctLink);
              console.log('Fixed link mismatch: ' + company + ' (' + applyLink + ') -> ' + correctLink);
            }
          }
        } catch (e) {}
      }
    }

    reply = fixedReply;

    // 保存到session历史（供后续对话使用）
    const session = getSession(sessionId || 'default');
    if (session.length === 0 || session[0].role !== 'system') {
      session.length = 0;
      session.push({ role: 'system', content: SYSTEM_PROMPT + '\n\n## 用户信息\n' + userInfoStr });
    }
    session.push({ role: 'user', content: '帮我推荐可以投递的岗位' });
    session.push({ role: 'assistant', content: reply });

    res.json({ reply: reply, searchResultsCount: uniqueResults.length });
  } catch (err) {
    console.error('Match jobs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 聊天接口
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, mode } = req.body;
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const session = getSession(sessionId || 'default');

    // 如果是新会话，添加系统提示词
    if (session.length === 0) {
      session.push({ role: 'system', content: SYSTEM_PROMPT });
    }

    // 添加用户消息到历史
    session.push({ role: 'user', content: message });

    // 限制历史长度（保留最近20条消息 + 系统提示词）
    if (session.length > 22) {
      const systemMsg = session[0];
      session.splice(0, session.length - 20);
      session.unshift(systemMsg);
    }

    let reply;
    const provider = process.env.LLM_PROVIDER || 'zhipu';
    const providerConfig = PROVIDERS[provider];

    if (providerConfig) {
      // 内置提供商（zhipu / hunyuan / hunyuan_tokenhub）
      const apiKey = process.env[providerConfig.apiKeyEnv] || '';
      reply = await callOpenAICompatibleAPI(session, providerConfig.apiUrl, apiKey, providerConfig.model);
    } else if (provider === 'openai-compatible') {
      // 自定义OpenAI兼容API（DeepSeek、通义千问等）
      const apiUrl = process.env.LLM_API_URL || '';
      const apiKey = process.env.LLM_API_KEY || '';
      const model = process.env.LLM_MODEL || 'deepseek-chat';
      reply = await callOpenAICompatibleAPI(session, apiUrl, apiKey, model);
    } else {
      return res.status(400).json({ error: '不支持的LLM提供商: ' + provider + '，可选: zhipu, hunyuan, hunyuan_tokenhub, openai-compatible' });
    }

    // 添加助手回复到历史
    session.push({ role: 'assistant', content: reply });

    res.json({ reply: reply });
  } catch (err) {
    console.error('Chat API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 清空会话
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessions[sessionId || 'default']) {
    delete sessions[sessionId || 'default'];
  }
  res.json({ success: true });
});

// 文件上传解析接口 - 支持 PDF / DOC / DOCX / TXT
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    if (ext === '.txt') {
      // 直接读取文本
      text = file.buffer.toString('utf-8');
    } else if (ext === '.pdf') {
      // 使用 pdf-parse 提取 PDF 文本
      const pdfData = await pdfParse(file.buffer);
      text = deduplicateText(pdfData.text);
    } else if (ext === '.docx' || ext === '.doc') {
      // 使用 mammoth 提取 DOCX/DOC 文本
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = deduplicateText(result.value);
    } else {
      return res.status(400).json({ error: '不支持的文件格式，请上传 .txt / .pdf / .doc / .docx 文件' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: '未能从文件中提取到文本内容，请确认文件内容非空或尝试粘贴文本' });
    }

    res.json({ text: text.trim(), filename: file.originalname });
  } catch (err) {
    console.error('Upload resume error:', err.message);
    res.status(500).json({ error: '文件解析失败：' + err.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  const provider = process.env.LLM_PROVIDER || 'zhipu';
  const providerConfig = PROVIDERS[provider];
  let apiKeyConfigured = false;
  if (providerConfig) {
    apiKeyConfigured = !!process.env[providerConfig.apiKeyEnv];
  } else if (provider === 'openai-compatible') {
    apiKeyConfigured = !!process.env.LLM_API_KEY;
  }
  res.json({
    status: 'ok',
    provider: provider,
    providerName: providerConfig ? providerConfig.name : '自定义OpenAI兼容',
    apiKeyConfigured: apiKeyConfigured
  });
});

// ===== 启动服务器 =====
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  职引 · AI求职智能匹配智能体');
  console.log('  服务器已启动: http://localhost:' + PORT);
  console.log('='.repeat(50));
  console.log();
  const provider = process.env.LLM_PROVIDER || 'zhipu';
  const providerConfig = PROVIDERS[provider];
  console.log('当前LLM提供商: ' + (providerConfig ? providerConfig.name : provider));

  let apiKeyConfigured = false;
  let keyEnvName = '';
  if (providerConfig) {
    keyEnvName = providerConfig.apiKeyEnv;
    apiKeyConfigured = !!process.env[keyEnvName];
  } else if (provider === 'openai-compatible') {
    keyEnvName = 'LLM_API_KEY';
    apiKeyConfigured = !!process.env.LLM_API_KEY;
  }

  if (apiKeyConfigured) {
    console.log('API Key: 已配置 ✓');
  } else {
    console.log('API Key: 未配置 ✗');
    console.log();
    console.log('请通过环境变量配置API Key：');
    console.log();
    console.log('腾讯混元（推荐）：');
    console.log('  export LLM_PROVIDER=hunyuan');
    console.log('  export HUNYUAN_API_KEY=你的API密钥');
    console.log('  node server.js');
    console.log();
    console.log('智谱AI：');
    console.log('  export ZHIPU_API_KEY=你的API密钥');
    console.log('  node server.js');
    console.log();
    console.log('腾讯混元 TokenHub（最新Hy3模型）：');
    console.log('  export LLM_PROVIDER=hunyuan_tokenhub');
    console.log('  export HUNYUAN_API_KEY=你的API密钥');
    console.log('  node server.js');
    console.log();
    console.log('腾讯混元 API Key 获取：https://console.cloud.tencent.com/hunyuan/start');
    console.log('智谱AI API Key 获取：https://open.bigmodel.cn/');
  }
  console.log('='.repeat(50));
});
