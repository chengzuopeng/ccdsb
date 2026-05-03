# ccdsb — Claude Code 用量看板设计方案

> Claude Code Dashboard：一个零配置、本地启动、浏览器查看的 Claude Code 用量可视化工具
>
> **运行方式**：`npx ccdsb` → 自动起本地服务 + 自动开浏览器 → 看到所有用量
>
> **版本**：v0 设计稿 · 2026-05-02

---

## 0. TL;DR

- **是什么**：一个本地跑的 Web 看板，读 `~/.claude/projects/` 下的 JSONL，按天/会话/项目/5h-block/模型 多维度展示 token、cost、缓存命中等指标。
- **为什么做**：终端 CLI（ccusage）已经做到了极致，但**本地 Web 看板这块基本空白**——phuryn/claude-usage 是 Python + 单页 HTML，体验粗糙；ccusage-web 是社区 hack，知名度低。npm 生态 + 现代 React 看板是明确产品空位。
- **怎么发布**：npm 包 `ccdsb`，包含 Next.js standalone build + CLI 入口；用户 `npx ccdsb` 一键起服务、自动开浏览器。
- **差异化**：
  1. 浏览器交互式看板（vs ccusage 终端表）
  2. **缓存节省可视化**（vs ccusage 隐式）—— 直接告诉用户"今天 cache 帮你省了 $X"
  3. **5h block 时间轴 + 实时倒计时**（vs ccusage 文本表）
  4. **项目 (cwd) 维度聚合**（vs Cursor 没有）
  5. 完全本地、零 telemetry、符合公司合规

---

## 1. 数据源调研结论

### 1.1 数据所在位置

```
~/.claude/
├── projects/
│   ├── -Users-{username}-{path-segments}/         # 项目目录，目录名 = 项目 cwd 用 - 转义
│   │   ├── {sessionId}.jsonl                       # 主会话记录（核心数据源）
│   │   └── {sessionId}/
│   │       ├── subagents/
│   │       │   ├── agent-{id}.jsonl                # 子任务记录
│   │       │   └── agent-{id}.meta.json
│   │       ├── tool-results/
│   │       └── memory/
│   └── ...
├── sessions/{pid}.json        # 进程级元数据，不含 token 用量
├── history.jsonl              # 用户输入历史，不含 token 用量
└── settings.json              # 用户设置（hooks 等）
```

**注意 ccusage 已知的另一路径**：Claude Code ≥ 1.0.30 会把数据写到 `~/.config/claude/projects/`，并支持 `CLAUDE_CONFIG_DIR` 环境变量自定义。**ccdsb 必须同时扫两个路径并合并去重**。

### 1.2 JSONL 一行一条记录，type 字段分类

| type | 占比 | 是否含 token usage | 说明 |
|---|---|---|---|
| `assistant` | ~32% | **是**（核心） | AI 响应消息，`message.usage` 是 token 计费的唯一可靠来源 |
| `user` | ~24% | 否 | 用户输入或工具结果回填 |
| `last-prompt` | ~6% | 否 | 上次提示符缓存 |
| `custom-title` | ~6% | 否 | 自定义会话标题 |
| `attachment` | ~3% | 否 | 工具增删变化 |
| `queue-operation` | ~2% | 否 | 入队/出队事件 |
| `system` | ~1% | 否 | 系统事件（hook、compact 等） |
| `ai-title` | <1% | 否 | AI 自动生成的会话标题 |

**结论**：只需要全量扫 `type === "assistant"` 且 `message.usage` 存在的行，就足以构建所有指标。其余 type 用于场景分析（比如最近一次提示、会话标题展示）。

### 1.3 Assistant 消息核心结构（脱敏样本）

```json
{
  "type": "assistant",
  "uuid": "e5a9c399-34a8-4835-a64c-4df07a2fa2f4",
  "parentUuid": "58fed80d-c192-4d54-a827-a07272b2908c",
  "timestamp": "2026-05-01T08:49:12.106Z",
  "sessionId": "eeaca048-9950-46a5-afbc-7a127d862748",
  "requestId": "req_011CabZUPGLNtJJRthTzwXjN",
  "cwd": "/Users/zuopeng.cheng/personal/workspace/stock/stock-sdk",
  "gitBranch": "master",
  "version": "2.1.121",
  "entrypoint": "claude-desktop",
  "userType": "external",
  "message": {
    "id": "msg_01MyQivKPZGfq2XoRdrcnzoq",
    "model": "claude-opus-4-6",
    "type": "message",
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "tool_use", "id": "toolu_xxx", "name": "Bash", "input": {...} },
      { "type": "text", "text": "..." }
    ],
    "stop_reason": "tool_use",
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 8574,
      "cache_read_input_tokens": 18771,
      "output_tokens": 410,
      "cache_creation": {
        "ephemeral_1h_input_tokens": 8574,
        "ephemeral_5m_input_tokens": 0
      },
      "service_tier": "standard",
      "speed": "standard",
      "server_tool_use": {
        "web_search_requests": 0,
        "web_fetch_requests": 0
      }
    }
  }
}
```

#### 关键字段速查

| 字段 | 用途 | 备注 |
|---|---|---|
| `message.id` + `requestId` | **去重 key**（拼接 hash） | session resume / branch 时同条消息会写多份，必须去重 |
| `message.model` | 模型名（计费分摊） | 形如 `claude-opus-4-6`、`claude-sonnet-4-5`；偶有 `<synthetic>` 要过滤 |
| `message.usage.input_tokens` | 计费输入 token | |
| `message.usage.output_tokens` | 计费输出 token | |
| `message.usage.cache_creation_input_tokens` | 创建缓存的输入 token | 计费 1.25× 或 2× base input |
| `message.usage.cache_read_input_tokens` | 命中缓存的 token | 计费 0.1× base input（**主要省钱来源**） |
| `cache_creation.ephemeral_1h_input_tokens` | 1h cache 拆分 | 用于精确计算（1h 是 2× input） |
| `cache_creation.ephemeral_5m_input_tokens` | 5m cache 拆分 | 用于精确计算（5m 是 1.25× input） |
| `timestamp` | ISO8601，用于按时间聚合 | UTC |
| `cwd` | 项目维度聚合的 key | |
| `sessionId` | 会话维度聚合的 key | |
| `gitBranch` | git 分支（次要维度） | 可做"按分支看花费"的彩蛋 |

### 1.4 数据规模预估

- 单用户：~10-50 个项目目录，~100-500 个 jsonl 文件
- 单文件最大可达 7MB，~1500 行
- 全量扫描估算：< 200ms（流式 readline）；冷启动可接受
- **优化策略**：按 mtime 增量扫描 + 内存缓存；首次扫描后只增量解析新追加内容

### 1.5 已确认 vs 推测

| 确认 | 推测 / 待验证 |
|---|---|
| usage 四类 token 字段名 | `<synthetic>` 模型是否计费（建议忽略） |
| 去重靠 `message.id + requestId` | 是否所有版本都写 `requestId`（旧版本可能缺失，需 fallback） |
| 模型名格式 `claude-{family}-{version}` | 部分日志含 `-20251101` 日期后缀（需 fuzzy match） |
| 时间戳 ISO8601 UTC | 跨时区聚合需统一转成本地时区显示 |

---

## 2. 竞品与差异化定位

### 2.1 竞品矩阵

| 项目 | 形态 | 数据源 | 优点 | 致命短板 | 对我们 |
|---|---|---|---|---|---|
| **ccusage** (13.7k★) | 终端 CLI | JSONL | 业界基准、去重/价格表/blocks 算法成熟 | 终端表格无可视化、无趋势图、无钻取 | 抄它的数据层（schema、去重、价格） |
| **Claude-Code-Usage-Monitor** (7.9k★) | 终端 TUI | JSONL | P90 智能限额识别、burn rate | Python 生态 | 借鉴 burn rate 概念 |
| **phuryn/claude-usage** (1.4k★) | Python + 单页 HTML | JSONL+SQLite | 最像我们 | UI 简陋、单文件 HTML 难扩展 | 借鉴增量扫描 + SQLite 缓存思路 |
| **ccusage-web** | Web 外挂 | ccusage 输出 | 社区已经验证过有需求 | 声量小 | 验证我们的市场需求 |
| **codeburn** (4.9k★) | TUI + macOS 菜单栏 | 多源（含 Cursor/Codex/Gemini） | 多源支持、菜单栏 native | 无 web | 学多源支持的扩展性思路 |
| **claude-code-otel / Agent-Monitor** | OTel/Hooks 注入 | telemetry/hook 事件 | 实时性强 | 用户配置成本高、侵入 settings | 不走这条路 |
| **Cursor Dashboard** | 服务端 web | server-side | 设计语言可参考 | 数据维度不同、社区吐槽多 | 借结构、避坑 |

### 2.2 ccdsb 的差异化定位

```
              ↑ 可视化 / 易分享
              │
              │     ★ ccdsb (我们)
              │   · phuryn/claude-usage
              │
              │
   ───────────┼─────────────→ 数据深度 / 多维聚合
              │
   · cursor 自己          · ccusage
   · 各种菜单栏            · Claude-Code-Usage-Monitor
              │
              ↓ 终端 / 即时
```

**核心 selling points**（必须做出来）：

1. **零配置**：`npx ccdsb` → 自动开浏览器 → 看到数据
2. **完全本地**：JSONL 不出本机，无 telemetry，符合公司合规
3. **缓存节省可视化**："今天 cache 帮你省了 $X"作为头部 KPI（Claude Code 重度用户最关心的指标，ccusage 没单独突出）
4. **5h block 时间轴 + 倒计时**：替代 statusline 的浏览器版
5. **项目 (cwd) 维度聚合**：Cursor 没有、ccusage 只有 `--instances` flag，我们做成主导航
6. **多窗口合并视图**：现实里大家会同时开 3-5 个 ccode 进程，看板天然合并展示

**不要做的事**（避坑）：

- ❌ 团队/SaaS（个人本地市场还远没卷透）
- ❌ Hook 注入（侵入用户配置）
- ❌ OTLP telemetry（用户配置成本高）
- ❌ 预测/ML（已有竞品做得不错）

---

## 3. 产品设计

### 3.1 信息架构（顶部一级 Tab）

```
┌─────────────────────────────────────────────────────────────────┐
│  ccdsb  │  Overview  Usage  Sessions  Projects  Models  Settings │ ← 顶部导航
└─────────────────────────────────────────────────────────────────┘
```

| Tab | 主要内容 | 灵感来源 |
|---|---|---|
| **Overview** | 6 张 KPI 卡 + 主趋势图 + 当前 5h block 实时进度 | Cursor Dashboard |
| **Usage** | 详细多维度 token / cost trend，可切粒度 / 指标 / 模型 | Cursor Usage tab |
| **Sessions** | 按会话列出每次对话的 token/cost/时间线 | ccdsb 独有 |
| **Projects** | 按 cwd 聚合，每个项目卡片 + 钻取 | ccdsb 独有 |
| **Models** | 各模型对比（占比环 / 趋势 / 单价） | Cursor Analytics |
| **Settings** | 数据源路径、价格表来源、刷新策略、时区 | — |

### 3.2 Overview 页详细设计

```
┌────────────────────────────────────────────────────────────────┐
│  Overview                                  Today / 7d / 30d ▾  │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────┬────────────┬────────────┬────────────┐          │
│  │ Tokens     │ Cost       │ Active     │ This Month │          │
│  │ Today      │ Today      │ Block      │            │          │
│  │ 1.2M       │ $4.32      │ 2h 14m     │ $87.50     │          │
│  │ ↑ 23% vs y │ ↑ 12% vs y │ 47% used   │ 32% of avg │          │
│  └────────────┴────────────┴────────────┴────────────┘          │
│  ┌─────────────────────┬─────────────────────┐                  │
│  │ Cache Hit Rate      │ Top Model           │                  │
│  │ 78%                 │ Sonnet 4.7          │                  │
│  │ saved $12.40 today  │ 64% of cost         │                  │
│  └─────────────────────┴─────────────────────┘                  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Token Usage Trend (last 30 days)              ▲ tokens ▾ │ │
│  │  ┌───────────────────────────────────────────────────────┐│ │
│  │  │ ▓▓ input  ▓▓ output  ▓▓ cache_read  ▓▓ cache_create   ││ │
│  │  │   ▓▓                                                  ││ │
│  │  │  ▓▓▓▓▓        ▓▓▓                ▓▓                   ││ │
│  │  │ ▓▓▓▓▓▓▓  ▓▓▓ ▓▓▓▓▓ ▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓▓     ││ │
│  │  └───────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────┬──────────────────────────────────┐ │
│  │ Current 5h Block        │  Cost by Model (this period)     │ │
│  │ ╭────────────────────╮  │                                  │ │
│  │ │  ●●●●●○○○○○        │  │  Opus 4.7    ▓▓▓▓▓▓▓▓▓ $52.31   │ │
│  │ │  47% (~$2.10/$4.5) │  │  Sonnet 4.6  ▓▓▓▓▓ $26.40       │ │
│  │ │  Resets in 2h 14m  │  │  Haiku 4.5   ▓ $4.20            │ │
│  │ ╰────────────────────╯  │                                  │ │
│  └─────────────────────────┴──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### KPI 卡设计要点

每张卡包含三层信息：
1. 顶部：小号 label（12-13px、灰色）
2. 中间：大号数值（28-36px、semibold）
3. 底部：对比 / 进度条 / 子说明（小号）

**6 张 KPI 卡**：

| 卡 | 主指标 | 副指标 | 计算逻辑 |
|---|---|---|---|
| Tokens Today | 今日 total tokens | vs 昨日 % | `Σ(input+output+cache_creation+cache_read)` |
| Cost Today | 今日 USD | vs 昨日 % | 各 token 类型 × 各模型单价 |
| Active Block | 当前 5h block 剩余时间 | block 已用 % | block start = 该 block 内首条消息时间 |
| This Month | 本月 USD | vs 月均 % | 当月累计 / 历史月均 |
| Cache Hit Rate | cache_read / total_input | 节省 USD | `cache_read × (input_price - cache_read_price)` |
| Top Model | 占比最高的模型 | 占总成本 % | argmax(cost by model) |

### 3.3 Usage 页详细设计

参考 Cursor Usage tab，但加深数据维度。

```
┌────────────────────────────────────────────────────────────────┐
│  Usage                                                         │
├────────────────────────────────────────────────────────────────┤
│  Filter: [Time: 30d ▾] [Model: All ▾] [Project: All ▾]         │
│  Metric: ◉ Tokens  ○ Cost  ○ Requests                          │
│  Granularity: ○ Hour  ◉ Day  ○ Week  ○ Month                   │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │   Stacked Bar Chart (4 segments per day)                   │ │
│  │   X: Date · Y: Tokens · Tooltip: 4 类 token 详情 + Cost    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Request Detail Table                          [Export ⬇] │ │
│  │  ┌──────────┬───────┬─────────┬──────┬──────┬──────┬─────┐ │ │
│  │  │ Time     │ Model │ Project │  In  │ Out  │ CRead│ Cost│ │ │
│  │  │ 09:42:11 │ Opus  │ ccdsb   │  3   │ 410  │ 18.7K│ .03 │ │ │
│  │  │ ...      │ ...   │ ...     │ ...  │ ...  │ ...  │ ... │ │ │
│  │  └──────────┴───────┴─────────┴──────┴──────┴──────┴─────┘ │ │
│  │  分页 / 搜索 / 列排序                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**表格列**（默认显示）：

| 列 | 来源 | 备注 |
|---|---|---|
| Time | timestamp | 本地时区，相对时间 hover 显示绝对时间 |
| Model | message.model | 短名（Opus 4.7） |
| Project | cwd 取最后一段 | hover 显示完整路径 |
| Session | sessionId 短 hash | 点击跳 Sessions 页 |
| Input | input_tokens | |
| Output | output_tokens | |
| Cache Read | cache_read_input_tokens | 突出显示（绿色） |
| Cache Create | cache_creation_input_tokens | |
| **Cost** | 计算值 | **务必显示具体金额，不能用 "Included"**（吸取 Cursor 教训） |
| Tools | 从 content[].type === "tool_use" 提取 | hover 显示具体工具列表 |

**Filter 维度**：时间预设（Today / 5h block / 7d / 30d / All / Custom）+ 模型 multi-select + 项目 multi-select。

### 3.4 Sessions 页

按 sessionId 分组，每个 session 一张卡：
- 卡顶：会话标题（取 custom-title 或 ai-title，没有则用首条 user message 截断）+ 时间范围 + 总 token + 总 cost
- 卡内：迷你时间线（每条 assistant message 一根细柱，token 量映射高度）
- 点击卡：进入 Session 详情页（按消息时间序列展示，可看每条 input/output/cache 的具体数字 + content 摘要）

### 3.5 Projects 页

按 cwd 聚合：
- 每个项目一张卡：项目名（取 cwd 最后一段）+ 总 session 数 + 总 cost + 最近活跃时间
- 卡内迷你 sparkline：最近 30 天 token 趋势
- 点击进项目详情：该项目下所有 session 列表 + 该项目专属趋势图

### 3.6 Models 页

```
┌────────────────────────────────────────────────────────────────┐
│  Models                                                        │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────┬────────────┬────────────┐                       │
│  │ Opus 4.7   │ Sonnet 4.6 │ Haiku 4.5  │  ← 模型卡，可对比     │
│  │ $52.31     │ $26.40     │ $4.20      │                       │
│  │ 12.5M tok  │ 8.2M tok   │ 1.1M tok   │                       │
│  │ 64% cost   │ 32%        │ 5%         │  ← 占比环             │
│  │ ●●●●●●○○○○ │ ●●●○○○○○○○ │ ●○○○○○○○○○ │                       │
│  └────────────┴────────────┴────────────┘                       │
│                                                                │
│  按模型对比的双轴趋势图（折线，每个模型一条）                  │
└────────────────────────────────────────────────────────────────┘
```

### 3.7 Settings 页

| 分组 | 项 |
|---|---|
| 数据源 | 显示当前扫描的目录列表（`~/.claude/projects/` + `~/.config/claude/projects/`）；按钮"重新扫描" |
| 价格表 | 展示当前价格表来源（内置 / LiteLLM）；可手动 fetch 最新；支持自定义模型价格 |
| 刷新策略 | 自动刷新间隔（off / 30s / 1min / 5min） |
| 时区 | 当前时区，支持手动覆盖 |
| 显示 | 主题（auto / dark / light）、货币（USD 默认，可换 CNY 用汇率换算） |
| 关于 | 版本号、GitHub 链接、隐私声明（强调"数据不出本机"） |

---

## 4. 视觉设计规范

### 4.1 设计语言

参考 **Cursor + Vercel + Linear** 的极简留白风格，但比 Cursor 信息密度高一档（开发者用户更想看细节）。

### 4.2 色板

```css
/* 暗模式 (默认) */
--bg-base:        #0A0A0A;
--bg-surface:     #141414;
--bg-surface-hi:  #1C1C1C;
--border:         #262626;
--border-hi:      #404040;
--text-primary:   #FAFAFA;
--text-secondary: #A3A3A3;
--text-tertiary:  #525252;

/* 品牌色（Anthropic 橙，与 Cursor 黑白拉开差异） */
--brand:          #C96442;
--brand-hover:    #D87959;

/* 状态色 */
--success:        #10B981;
--warning:        #F59E0B;
--danger:         #EF4444;

/* 图表 4 色（对应 token 类型） */
--chart-input:          #3B82F6;  /* 蓝 - 输入 */
--chart-output:         #C96442;  /* 橙 - 输出（品牌色） */
--chart-cache-read:     #10B981;  /* 绿 - 命中缓存（正反馈） */
--chart-cache-create:   #8B5CF6;  /* 紫 - 创建缓存（投资） */

/* 浅模式 */
--bg-base-light:  #FFFFFF;
--bg-surface-light: #FAFAFA;
--border-light:   #E5E5E5;
/* ...对应反转 */
```

### 4.3 字体

- 西文 + 数字：**Inter** 或 **Geist Sans**（推荐 Geist，与 Vercel 生态一致）
- 等宽（token 数、UUID、cwd 路径）：**JetBrains Mono** 或 **Geist Mono**
- 中文（Settings 等少量出现）：系统默认 sans

### 4.4 字号阶梯

| 层级 | 字号 | 字重 | 用例 |
|---|---|---|---|
| KPI 大数字 | 32-36px | 600 | "1.2M", "$87.50" |
| 区块标题 | 18-20px | 600 | "Token Usage Trend" |
| 正文 | 14-16px | 400 | 表格内容 |
| 标签 / 副信息 | 12-13px | 500 | "Tokens Today" |
| 微注释 | 11-12px | 400 | tooltip 内容 |

### 4.5 间距 / 圆角 / 阴影

- 8 倍数体系：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- 卡片 padding：24px
- 卡片间距：16px
- 页面外边距：32px (≥ 1024px) / 16px (< 1024px)
- 卡片圆角：12px；按钮 / Tag：8px；图表 bar：2-4px
- 阴影：几乎不用，靠边框区分层次（Cursor 风）
  - 仅在 hover 时加 `0 1px 3px rgba(0,0,0,0.1)`

### 4.6 交互细节

- **图表 hover**：tooltip 用细 stroke，显示当天/当 bucket 的 4 类 token + 总 cost
- **KPI hover**：显示完整精度数值（如 12,453,201 → 卡上显示 12.4M）
- **表格行 hover**：背景轻微变亮 + 鼠标变 pointer
- **图表点击钻取**：点击某天 → Usage 表格自动 filter 到那天（v2 再做）
- **空状态**：友好提示 + 一行说明（"No usage yet — start a Claude Code session to see data here"）
- **加载态**：skeleton 而非 spinner

---

## 5. 技术架构

### 5.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        npm 包: ccdsb                            │
├─────────────────────────────────────────────────────────────────┤
│  bin/cli.js  ← shebang 入口                                     │
│    │                                                            │
│    ├── 解析 CLI args (port / open / no-open / dir)              │
│    ├── 选端口 (get-port, 偏好 3737)                              │
│    ├── fork(web/.next/standalone/server.js)                     │
│    ├── 等服务起来 (HEAD / 监听 stdout)                            │
│    └── open(http://127.0.0.1:PORT) (除非 --no-open)              │
│                                                                 │
│  web/ (Next.js standalone build)                                │
│    │                                                            │
│    ├── App Router 页面                                           │
│    │   ├── / (Overview)                                         │
│    │   ├── /usage                                               │
│    │   ├── /sessions/[id]                                       │
│    │   ├── /projects/[id]                                       │
│    │   ├── /models                                              │
│    │   └── /settings                                            │
│    │                                                            │
│    ├── API routes (server-only)                                 │
│    │   ├── /api/scan       — 触发全量扫描                        │
│    │   ├── /api/usage      — 聚合查询（带 filter）                │
│    │   ├── /api/sessions   — 会话列表                            │
│    │   ├── /api/projects   — 项目列表                            │
│    │   ├── /api/blocks     — 5h block 列表                       │
│    │   └── /api/pricing    — 当前价格表                          │
│    │                                                            │
│    └── lib/                                                     │
│        ├── data-loader/    — 扫描 ~/.claude/                    │
│        ├── parser/         — JSONL → Record[]                   │
│        ├── dedup/          — message.id + requestId 去重         │
│        ├── pricing/        — 模型价格表 + cost 计算              │
│        ├── aggregator/     — 多维聚合                            │
│        └── blocks/         — 5h block 算法                       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键技术选型

| 用途 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15 App Router** | RSC + API routes，前后端一体 |
| 输出模式 | `output: 'standalone'` | 必须！否则包大小爆炸 |
| 包管理 | pnpm | 与 ccusage 一致；workspaces 友好 |
| UI 组件 | **shadcn/ui + Tailwind CSS** | 暗模式友好，dashboard 风可控 |
| 图表 | **Tremor**（基于 Recharts）+ Recharts | Tremor 直接给 dashboard 模板，省时间 |
| CLI 框架 | **commander** | 轻量、稳定 |
| 端口选择 | **get-port** (sindresorhus) | ESM、纯净 |
| 开浏览器 | **open** (sindresorhus) | 跨平台 |
| JSONL 解析 | 自实现 readline + JSON.parse | 别引大包 |
| Schema 校验 | **zod** | 防御未来 JSONL schema 变更 |
| 缓存 | 内存 LRU + 文件 mtime 检测 | 不引 SQLite，依赖太重 |
| 日期 | **date-fns** | 比 dayjs 更 tree-shakable |
| 时区 | **@date-fns/tz** 或浏览器 Intl API | |

### 5.3 数据层设计

#### 5.3.1 扫描入口

```typescript
// lib/data-loader/scan.ts
async function scanAll(opts: { force?: boolean } = {}): Promise<Record[]> {
  const dirs = [
    expandHome('~/.claude/projects'),
    expandHome('~/.config/claude/projects'),
    process.env.CLAUDE_CONFIG_DIR && join(process.env.CLAUDE_CONFIG_DIR, 'projects'),
  ].filter(Boolean);

  const files = await Promise.all(dirs.map(d => globJsonl(d)));
  const records = await Promise.all(files.flat().map(parseJsonlFile));
  return dedupAndSort(records.flat());
}
```

#### 5.3.2 增量扫描 + 缓存

```typescript
// 内存缓存：fileKey → { mtime, records[] }
// 启动时全量扫描；之后 API 调用前 stat 所有文件，mtime 变了才重新解析该文件
const cache = new Map<string, { mtime: number; records: Record[] }>();
```

#### 5.3.3 去重

```typescript
function dedupKey(r: Record): string {
  // ccusage 标准做法
  return `${r.message?.id ?? r.uuid}::${r.requestId ?? ''}`;
}
function dedup(records: Record[]): Record[] {
  const seen = new Set<string>();
  return records.filter(r => {
    const k = dedupKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
```

#### 5.3.4 Cost 计算

```typescript
// lib/pricing/calculate.ts
type Pricing = {
  input: number;          // USD per 1M tokens
  output: number;
  cacheCreation5m: number; // = input × 1.25
  cacheCreation1h: number; // = input × 2
  cacheRead: number;       // = input × 0.1
};

function costOf(usage: Usage, model: string): number {
  const p = resolvePricing(model);  // fuzzy match: claude-opus-4-5-20251101 → claude-opus-4-5
  if (!p) return 0;  // 未知模型，cost = 0 但仍计 token
  return (
    (usage.input_tokens / 1e6) * p.input +
    (usage.output_tokens / 1e6) * p.output +
    (usage.cache_creation?.ephemeral_5m_input_tokens ?? 0) / 1e6 * p.cacheCreation5m +
    (usage.cache_creation?.ephemeral_1h_input_tokens ?? 0) / 1e6 * p.cacheCreation1h +
    (usage.cache_read_input_tokens / 1e6) * p.cacheRead
  );
}

// 缓存节省（vs 不用 cache 走 input）
function savedByCache(usage: Usage, model: string): number {
  const p = resolvePricing(model);
  if (!p) return 0;
  return (usage.cache_read_input_tokens / 1e6) * (p.input - p.cacheRead);
}
```

#### 5.3.5 5h Block 算法

```typescript
// lib/blocks/compute.ts
// 一个 block 由"该 block 内首条 assistant 消息"触发，持续 5h；
// 一旦超过 5h，下一条消息开启新 block
function computeBlocks(records: Record[]): Block[] {
  const sorted = records
    .filter(r => r.type === 'assistant' && r.message?.usage)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const blocks: Block[] = [];
  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime();
    const last = blocks[blocks.length - 1];
    if (!last || t - new Date(last.startTime).getTime() >= 5 * 3600 * 1000) {
      blocks.push({ startTime: r.timestamp, records: [r] });
    } else {
      last.records.push(r);
    }
  }
  return blocks.map(annotate);  // 加上 endTime / tokens / cost / models / isActive
}
```

### 5.4 价格表策略

#### 5.4.1 内置价格表（构建时快照）

```typescript
// lib/pricing/builtin.ts
export const BUILTIN_PRICING: Record<string, Pricing> = {
  // 在售
  'claude-opus-4-7':   { input: 5,    output: 25,  cacheCreation5m: 6.25, cacheCreation1h: 10,  cacheRead: 0.50 },
  'claude-opus-4-6':   { input: 5,    output: 25,  cacheCreation5m: 6.25, cacheCreation1h: 10,  cacheRead: 0.50 },
  'claude-opus-4-5':   { input: 5,    output: 25,  cacheCreation5m: 6.25, cacheCreation1h: 10,  cacheRead: 0.50 },
  'claude-sonnet-4-6': { input: 3,    output: 15,  cacheCreation5m: 3.75, cacheCreation1h: 6,   cacheRead: 0.30 },
  'claude-sonnet-4-5': { input: 3,    output: 15,  cacheCreation5m: 3.75, cacheCreation1h: 6,   cacheRead: 0.30 },
  'claude-haiku-4-5':  { input: 1,    output: 5,   cacheCreation5m: 1.25, cacheCreation1h: 2,   cacheRead: 0.10 },
  'claude-haiku-3-5':  { input: 0.80, output: 4,   cacheCreation5m: 1,    cacheCreation1h: 1.6, cacheRead: 0.08 },
  // 旧模型（JSONL 里仍可能出现）
  'claude-opus-4-1':   { input: 15,   output: 75,  cacheCreation5m: 18.75, cacheCreation1h: 30, cacheRead: 1.50 },
  'claude-opus-4':     { input: 15,   output: 75,  cacheCreation5m: 18.75, cacheCreation1h: 30, cacheRead: 1.50 },
  'claude-sonnet-4':   { input: 3,    output: 15,  cacheCreation5m: 3.75, cacheCreation1h: 6,   cacheRead: 0.30 },
  'claude-sonnet-3-7': { input: 3,    output: 15,  cacheCreation5m: 3.75, cacheCreation1h: 6,   cacheRead: 0.30 },
  'claude-haiku-3':    { input: 0.25, output: 1.25, cacheCreation5m: 0.30, cacheCreation1h: 0.5, cacheRead: 0.03 },
};
```

#### 5.4.2 远程价格表（兜底 / 自动更新）

```typescript
// lib/pricing/remote.ts
const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

async function fetchRemotePricing(): Promise<Record<string, Pricing>> {
  const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(5000) });
  const json = await res.json();
  return mapLiteLLMSchema(json);  // 转成我们的格式，并 ×1e6 (LiteLLM 是 per-token)
}
```

启动时策略：内置 → 异步 fetch 远程覆盖（缓存到 `~/.cache/ccdsb/pricing.json`，TTL 24h）→ 失败用内置。

#### 5.4.3 模型 fuzzy match

```typescript
function resolvePricing(model: string): Pricing | null {
  // 1. 直接命中
  if (BUILTIN_PRICING[model]) return BUILTIN_PRICING[model];
  // 2. 去掉日期后缀（claude-opus-4-5-20251101 → claude-opus-4-5）
  const stripped = model.replace(/-\d{8}$/, '');
  if (BUILTIN_PRICING[stripped]) return BUILTIN_PRICING[stripped];
  // 3. 去掉 vertex/bedrock 前缀
  const noPrefix = stripped.replace(/^(vertex_ai|bedrock|anthropic)\//, '');
  if (BUILTIN_PRICING[noPrefix]) return BUILTIN_PRICING[noPrefix];
  // 4. 兜底 fallback：按 family 取最近一档
  if (model.includes('opus')) return BUILTIN_PRICING['claude-opus-4-7'];
  if (model.includes('sonnet')) return BUILTIN_PRICING['claude-sonnet-4-6'];
  if (model.includes('haiku')) return BUILTIN_PRICING['claude-haiku-4-5'];
  return null;
}
```

### 5.5 CLI 启动流程

```typescript
// bin/cli.js
#!/usr/bin/env node
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import open from 'open';
import { Command } from 'commander';

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command()
  .name('ccdsb')
  .description('Claude Code Dashboard — local web UI for usage stats')
  .version(VERSION)
  .option('-p, --port <port>', 'preferred port', '3737')
  .option('--no-open', 'do not auto-open browser')
  .option('--host <host>', 'bind host', '127.0.0.1')
  .option('--dir <path>', 'override Claude config dir', '')
  .parse();

const opts = program.opts();
const port = await getPort({ port: [Number(opts.port), Number(opts.port) + 1, 0] });
const serverEntry = join(__dirname, '..', 'web', '.next', 'standalone', 'server.js');

const child = fork(serverEntry, [], {
  cwd: dirname(serverEntry),
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: opts.host,
    NODE_ENV: 'production',
    CCDSB_CONFIG_DIR: opts.dir || '',
  },
  stdio: 'inherit',
});

const url = `http://${opts.host}:${port}`;
await waitForUrl(url, 10_000);
console.log(`\n  ➜  ccdsb ready at ${url}\n`);

if (opts.open !== false) {
  await open(url);
}

const shutdown = () => { child.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.status < 500) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('ccdsb server did not start in time');
}
```

### 5.6 Next.js standalone 打包

#### 5.6.1 next.config.js

```javascript
module.exports = {
  output: 'standalone',
  // 去掉 telemetry
  experimental: { instrumentationHook: false },
  // 减小 bundle
  images: { unoptimized: true },
};
```

#### 5.6.2 构建脚本（package.json）

```json
{
  "scripts": {
    "build:web": "cd web && next build && pnpm copy:static",
    "copy:static": "cp -r web/public web/.next/standalone/ 2>/dev/null; cp -r web/.next/static web/.next/standalone/.next/static",
    "build:cli": "tsdown bin/cli.ts --format esm --out-dir bin",
    "build": "pnpm build:web && pnpm build:cli",
    "prepublishOnly": "pnpm build"
  },
  "files": [
    "bin/cli.js",
    "web/.next/standalone",
    "README.md",
    "LICENSE"
  ],
  "bin": {
    "ccdsb": "bin/cli.js"
  }
}
```

预估包体：~40-60MB（Next.js standalone ~30MB + UI/图表库 ~15MB）。

---

## 6. 仓库与代码组织

### 6.1 目录结构

```
ccdsb/
├── package.json                  # workspace 根
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── PLAN.md                       # 本文件
│
├── packages/
│   └── ccdsb/                    # ★ 唯一发布的 npm 包
│       ├── package.json          # bin: ccdsb → bin/cli.js
│       ├── bin/
│       │   └── cli.ts            # 编译产物 cli.js
│       └── web/                  # Next.js 应用
│           ├── package.json
│           ├── next.config.js
│           ├── tsconfig.json
│           ├── tailwind.config.ts
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx              # /  Overview
│           │   ├── usage/page.tsx
│           │   ├── sessions/page.tsx
│           │   ├── sessions/[id]/page.tsx
│           │   ├── projects/page.tsx
│           │   ├── projects/[id]/page.tsx
│           │   ├── models/page.tsx
│           │   ├── settings/page.tsx
│           │   └── api/
│           │       ├── scan/route.ts
│           │       ├── usage/route.ts
│           │       ├── sessions/route.ts
│           │       ├── projects/route.ts
│           │       ├── blocks/route.ts
│           │       └── pricing/route.ts
│           ├── components/
│           │   ├── ui/                   # shadcn/ui 复制进来的组件
│           │   ├── kpi-card.tsx
│           │   ├── token-stack-chart.tsx
│           │   ├── block-progress.tsx
│           │   ├── model-bar.tsx
│           │   ├── usage-table.tsx
│           │   ├── session-card.tsx
│           │   └── nav.tsx
│           ├── lib/
│           │   ├── data-loader/
│           │   │   ├── scan.ts
│           │   │   └── parse-jsonl.ts
│           │   ├── pricing/
│           │   │   ├── builtin.ts
│           │   │   ├── remote.ts
│           │   │   ├── resolve.ts
│           │   │   └── calculate.ts
│           │   ├── aggregator/
│           │   │   ├── by-day.ts
│           │   │   ├── by-model.ts
│           │   │   ├── by-project.ts
│           │   │   └── by-session.ts
│           │   ├── blocks/
│           │   │   └── compute.ts
│           │   ├── dedup.ts
│           │   ├── cache.ts              # 内存缓存 + mtime 检测
│           │   ├── types.ts              # zod schema + 类型
│           │   └── utils.ts
│           └── public/
│               ├── favicon.ico
│               └── logo.svg
│
└── docs/
    └── screenshots/              # 文档截图
```

### 6.2 单包 vs 多包

**选单包**（packages/ccdsb 一个）：

- 用户只装一个 `ccdsb`，所有逻辑都在里面
- web/lib 既被 Next.js 用，也可被未来的 MCP/CLI 子命令复用
- workspace 是为了将来扩展（比如加 MCP server、加 docs site）

### 6.3 发布配置

```json
// packages/ccdsb/package.json
{
  "name": "ccdsb",
  "version": "0.1.0",
  "description": "Claude Code Dashboard — local web UI for token usage and cost",
  "keywords": ["claude", "claude-code", "anthropic", "usage", "dashboard", "cli"],
  "type": "module",
  "bin": {
    "ccdsb": "bin/cli.js"
  },
  "files": [
    "bin/cli.js",
    "web/.next/standalone",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

---

## 7. 实施路线图

### Phase 0 — 立项准备（0.5 天）

- [ ] 注册 npm name `ccdsb`（先 reserve 占位）
- [ ] 初始化 git 仓库 + pnpm workspace
- [ ] 决定开源协议（建议 MIT）
- [ ] 起一个 stub Next.js 项目，跑通 standalone build + CLI fork + open 浏览器（hello world 即可）

### Phase 1 — MVP（约 3-5 天）

**目标**：能跑 `npx ccdsb` 看到 Overview + Usage 两页基本数据。

- [ ] **数据层**：扫描 `~/.claude/projects/` 双路径 + JSONL 解析 + 去重
- [ ] **价格表**：内置 13 个模型 + cost 计算
- [ ] **API**：`/api/usage` 支持 `?from=&to=&groupBy=day|model|project`
- [ ] **Overview 页**：4 张 KPI（Tokens Today / Cost Today / Cache Hit Rate / This Month）+ 主趋势图（堆叠柱状）
- [ ] **Usage 页**：filter（时间 + 模型）+ 主图（堆叠柱状）+ 表格（分页）
- [ ] **Settings 页**：仅显示数据源 + 价格表来源 + 时区
- [ ] CLI：`ccdsb` 默认起 + `--port` + `--no-open`

### Phase 2 — 完整功能（约 1 周）

- [ ] **Sessions 页**：会话列表 + 单会话详情时间线
- [ ] **Projects 页**：项目卡片 + 单项目详情
- [ ] **Models 页**：模型对比 + 占比环 + 趋势对比
- [ ] **5h Block**：算法实现 + Overview 页加 "Active Block" KPI + 倒计时 + 时间轴
- [ ] **Cache 节省可视化**：Overview 加 "Cache saved $X" 卡片 + Settings 可关闭
- [ ] **远程价格表**：fetch LiteLLM + 24h 缓存 + offline 兜底
- [ ] **增量扫描**：mtime 检测 + 内存缓存
- [ ] **暗模式**：完整支持 + 主题切换
- [ ] **导出**：表格 CSV 导出

### Phase 3 — 打磨（持续）

- [ ] 自动刷新（30s / 1min / 5min 可选）
- [ ] 表格搜索 + 列排序
- [ ] 图表点击钻取
- [ ] 时区切换
- [ ] 货币换算（USD → CNY）
- [ ] PNG 截图导出
- [ ] 移动端响应式（次要，看板主要桌面用）
- [ ] e2e 测试（Playwright）
- [ ] 性能优化（百 MB JSONL 也能秒开）

### Phase 4 — 增长（可选）

- [ ] MCP server 子命令：`ccdsb mcp` 把数据通过 MCP 暴露给其他 agent
- [ ] 状态栏插件：可选的 Claude Code statusline 钩子（用户主动开启）
- [ ] 多 user 合并视图（团队共享某个 NFS / 网盘）
- [ ] 异常检测（"今天的 cost 比平时高 5×，主要在 Project X / Model Y"）

---

## 8. 风险与决策记录

### 8.1 数据源风险

| 风险 | 缓解 |
|---|---|
| Claude Code 升级改 JSONL schema | zod 校验 + 字段 fallback，对未知字段宽松 |
| 旧版 JSONL 缺 `requestId` | 去重退化为 `message.id` only |
| `<synthetic>` 等非真实模型 | 默认过滤，可在 Settings 里开启展示 |
| 大文件（数百 MB JSONL） | 流式 readline，不全量 JSON.parse；首次解析后缓存 |
| 双路径数据重复 | dedup 用 `message.id + requestId` 全局去重 |

### 8.2 包体与启动风险

| 风险 | 缓解 |
|---|---|
| Next.js standalone 漏拷 static / public | 构建脚本显式 cp，并加 CI 检查 |
| 端口被占 | get-port 偏好 + fallback random |
| 浏览器在远程 SSH 场景没法开 | `--no-open` flag，并在终端打印 URL |
| 跨平台路径（Windows） | 用 `node:path` + `os.homedir()`，不硬编码 `/` |
| Node 版本过低 | `engines.node >= 20`，并在 cli.js 加版本检查 |

### 8.3 价格表风险

| 风险 | 缓解 |
|---|---|
| LiteLLM 价格表更新滞后或停更 | 内置快照 + 手动覆盖入口 |
| 模型新发布、内置表没有 | fuzzy match 兜底 + 显式提示用户"使用了 fallback 价格" |
| 用户在中国，访问 GitHub 慢 | 远程 fetch 超时 5s + 自动 fallback |

### 8.4 设计风险（吸取 Cursor 教训）

| Cursor 的坑 | ccdsb 怎么避 |
|---|---|
| Cost 列只显 "Included"，看不到具体金额 | **永远显示具体 USD**，配合 hover 显示 6 位小数 |
| 隐藏"剩余天数"被吐槽 | Active Block 倒计时永远在 Overview 顶部 |
| 暗模式分页器对比度差 | 设计 review 时用 axe 等工具校验 contrast ratio ≥ 4.5:1 |
| 图表藏在 feature flag 后 | 不做灰度，所有用户开箱即用 |
| Cycle 含义混乱（fast req vs token pool） | 只用 token + cost 两个清晰维度 |

---

## 9. 命名 / 品牌

- **包名**：`ccdsb`（短、易记、未占用——发布前 npm search 确认）
- **全名解读**：Claude Code Dashboard
- **建议 tagline**：*Local web dashboard for Claude Code usage. Zero config.*
- **logo / favicon**：以 Anthropic 橙 `#C96442` 为主色的简洁字标 `ccdsb` / 图标用方块进度环

---

## 10. 关键参考链接

**核心数据源 / 竞品**
- ccusage（行业基准）: https://github.com/ryoppippi/ccusage
- ccusage docs: https://ccusage.com
- Claude-Code-Usage-Monitor: https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor
- phuryn/claude-usage（最相似）: https://github.com/phuryn/claude-usage
- codeburn（多源 TUI）: https://github.com/AgentSeal/codeburn

**价格表权威源**
- Anthropic 官方: https://platform.claude.com/docs/en/about-claude/pricing
- LiteLLM 价格 JSON: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json

**Next.js + CLI 打包**
- Next.js standalone output: https://nextjs.org/docs/app/api-reference/next-config-js/output
- `open` npm: https://github.com/sindresorhus/open
- `get-port` npm: https://github.com/sindresorhus/get-port
- Prisma Studio 模式（业界参照）: https://github.com/prisma/studio

**UI / 设计参考**
- Tremor 组件库: https://tremor.so
- shadcn/ui: https://ui.shadcn.com
- Cursor Dashboard: https://cursor.com/dashboard
- Cursor Analytics docs: https://cursor.com/docs/account/teams/analytics

---

## 11. 立刻可以动手的 Day-1 清单

按这个顺序，一天内就能让 hello-world 跑起来：

1. `pnpm init` + 创建 workspace 结构
2. `cd packages/ccdsb && pnpm create next-app web --ts --app --tailwind --src-dir=false`
3. 改 `web/next.config.js` 加 `output: 'standalone'`
4. 写 `bin/cli.ts`（fork + get-port + open）—— 直接抄 5.5 节的代码
5. 写 build 脚本 + `prepublishOnly` —— 抄 5.6.2
6. 跑通 `pnpm build && node bin/cli.js`，浏览器自动打开 hello next.js 页
7. 写 `lib/data-loader/scan.ts` 和 `lib/data-loader/parse-jsonl.ts`，先在 `app/page.tsx` 里 server-side 渲染一个总 token 数验证数据通路
8. 一切跑通后，再按 Phase 1 todo 逐步加 Overview / Usage 页面

---

**End of Plan.**
