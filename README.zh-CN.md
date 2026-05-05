<div align="center">

# ccgauge

**本地、隐私优先的 AI 编程 CLI 用量看板。** 把 **Claude Code** 与 **OpenAI Codex CLI** 的 token、花费、缓存节省统统聚合到同一个浏览器页面 —— 数据全程不离开你的电脑。

[![npm version](https://img.shields.io/npm/v/ccgauge?color=4F46E5&style=flat-square)](https://www.npmjs.com/package/ccgauge)
[![license](https://img.shields.io/npm/l/ccgauge?color=4F46E5&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/ccgauge?color=4F46E5&style=flat-square)](#)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

```bash
npx ccgauge
```

一行命令。ccgauge 自动读 Claude Code 和 Codex CLI 在本地写下的 JSONL 会话文件，按 天 / 项目 / 模型 / 会话 计算 token 用量与**美元等值花费**，在浏览器里打开统一看板，顶部一键切换数据源。**无登录、无遥测、无任何外网调用。**

![概览 — 中文 / Light](./docs/screenshots/overview-zh-light.png)

---

## 为什么用 ccgauge

如果你按 token 计费用 API，或者在用 Claude Pro / Max / Team / Codex Plus 订阅，你大概关心过这些问题：

- *"Claude Code 这个月按 API 算下来要花多少钱？"*
- *"Prompt caching 到底帮我省了多少钱？"*
- *"哪个项目 / 会话 / 模型最吃 token？"*
- *"5 小时窗口还剩多久才重置？"*

终端工具 [ccusage](https://github.com/ryoppippi/ccusage) 给出的是一墙数字。ccgauge 给你**同样的数据加上图表、按维度下钻、5h 实时进度，并且是同时覆盖 Claude Code 与 OpenAI Codex CLI 的统一看板**。

整个看板是个本地 Next.js 应用，对话内容全程不出本机。

## 亮点

### 多 CLI 数据源
- 一份看板覆盖 **Claude Code** 与 **OpenAI Codex CLI**
- 顶部一键切换，URL 用 `?source=` 持久化，cookie 记忆上次选择
- 内置 **Provider 适配层**（`lib/providers/`）—— 增加第三个 CLI（Gemini CLI / Cursor / Aider …）只需一个新文件加注册表一行

### KPI 一眼看完
- 今日 token、今日花费、本月累计、缓存命中率、主力模型、今日活跃会话
- 每张卡都显示日环比 (`vs yesterday`)
- **5 小时 block 实时进度** —— 倒计时、进度条、每分钟 token 烧速、预计总花费

### 全维度下钻
- **会话页** —— 每场对话单独成行（模型 / token / 花费 / 时长），点进去看消息级时间线
- **项目页** —— 按 `cwd` 聚合成卡片网格，含趋势条与花费占比
- **模型页** —— 各模型并排对比：成本占比、token 占比、缓存命中、官方单价
- **用量页** —— 按对话轮次分组的明细表，可展开看每次工具调用，支持 CSV 导出

### 成本透明
- **缓存节省** 单独成卡 —— 量化 Anthropic prompt caching 实际帮你节省了多少美元
- Codex 的成本标注为 **OpenAI API 单价折算估值**，方便订阅用户对比"按 API 计 vs 订阅价"
- 内置价格表：12 个 Claude 模型 + gpt-5 系列 + o 系列；未知模型自动回退到同 family 最新一档

### 精致的本地 UI
- **亮色 / 暗色 / 跟随系统** 三档主题，首屏无闪烁
- **English / 中文** 双语，cookie + localStorage 双向同步
- 完整筛选：时间区间（今天 / 7 天 / 30 天 / 90 天 / 全部）、粒度（小时 / 天 / 周 / 月）、模型 / 项目 multi-select

### 隐私优先
- 100 % 本地：只读访问已有 JSONL 文件，零外网调用
- 开源，MIT 协议
- 后台常驻模式，配套 `start / stop / restart / status / open / logs` 完整生命周期命令

## 快速开始

零安装一行运行：

```bash
npx ccgauge
```

或者全局安装：

```bash
npm  i -g ccgauge && ccgauge          # npm
pnpm i -g ccgauge && ccgauge          # pnpm
yarn global add ccgauge && ccgauge    # yarn
```

看板会在 [http://localhost:3737](http://localhost:3737) 打开。如果 3737 被占用，会自动顺延到下一个可用端口；按 `Ctrl+C` 停止。

**环境要求：** Node.js 20+（`pnpm test` 推荐 Node 22+）。已在 macOS / Linux / Windows 上验证。

## 命令行用法

`ccgauge` 是 `ccgauge start` 的简写，参数可以放在任一边。

### 前台模式（默认）

```bash
ccgauge
ccgauge --port 4000 --no-open
ccgauge start --host 0.0.0.0 --port 4000
```

### 后台服务模式

```bash
ccgauge start --background

ccgauge status
ccgauge open
ccgauge logs           # 最近 80 行
ccgauge logs --follow  # 实时跟随
ccgauge restart --port 4000
ccgauge stop
```

后台状态默认写在 `~/.ccgauge/`：
- `state.json` —— 进程 PID、URL、启动时间、日志路径
- `ccgauge.log` —— 服务输出（`ccgauge logs` 会读它）
- 设置 `CCGAUGE_STATE_DIR=/path/to/dir` 可隔离不同 profile（适合测试）

### 命令一览

| 命令 | 用途 |
| --- | --- |
| `ccgauge`, `ccgauge start` | 前台启动。`Ctrl+C` 停止。 |
| `ccgauge start --background` | 启动后台服务。 |
| `ccgauge stop [--force]` | 停止后台服务。 |
| `ccgauge restart [options]` | 停止再用新参数启动。 |
| `ccgauge status [--json]` | 查看后台状态。 |
| `ccgauge open` | 在浏览器打开正在运行的看板。 |
| `ccgauge logs [-f] [-n <lines>]` | 查看后台日志。 |

### 启动参数

| 参数 | 适用命令 | 用途 |
| --- | --- | --- |
| `-p, --port <port>` | start, restart, 根命令 | 首选端口。默认 `3737`。 |
| `-H, --host <host>` | start, restart, 根命令 | 绑定地址。默认 `127.0.0.1`。 |
| `--no-open` | start, 根命令 | 前台不自动打开浏览器。后台模式本来就不自动打开，需要时用 `ccgauge open`。 |
| `--dir <path>` | start, restart, 根命令 | 把 `<path>/projects` 加入 Claude 数据源。 |
| `-q, --quiet` | start, restart, 根命令 | 静默 Next.js 输出。 |
| `-b, --background` | start, 根命令 | 以后台服务方式启动。 |
| `--strict-port` | start, restart, 根命令 | 端口不可用时直接失败。 |
| `--log <path>` | start --background, restart | 后台日志文件。 |

## 配置

ccgauge 会自动识别标准路径：

| Provider | 默认数据源 |
| --- | --- |
| Claude Code | `~/.claude/projects`、`~/.config/claude/projects` |
| OpenAI Codex CLI | `~/.codex/sessions`、`~/.codex/archived_sessions` |

通过环境变量自定义：

| 变量 | 作用 |
| --- | --- |
| `CCGAUGE_CONFIG_DIR` | 把 `<dir>/projects` 也加入 Claude 数据源 |
| `CLAUDE_CONFIG_DIR` | 同上（兼容 Claude Code 1.0.30+） |
| `CCGAUGE_CODEX_DIR` | 额外的 Codex 会话目录 |
| `CODEX_HOME` | 把 `<dir>/sessions` 与 `<dir>/archived_sessions` 一并加入 |
| `CCGAUGE_STATE_DIR` | 覆盖后台服务的状态 / 日志目录 |

## 架构

```
~/.claude/projects/**/*.jsonl  ──┐
                                 ├─►  ProviderAdapter 注册表
~/.codex/sessions/**/*.jsonl  ───┘    │
                                      ▼
                              scanAll() ─► 去重 ─► 按 时间/模型/项目/会话/5h block 聚合
                                                ▼
                                  Next.js RSC 页面 + 客户端图表
```

1. **CLI**（`bin/cli.mjs`）归一化命令，校验 standalone 产物，用 [`get-port`](https://github.com/sindresorhus/get-port) 选端口。
2. **前台模式** 用 `fork()`，进程绑在终端上；**后台模式** 用 detached `spawn()`，状态写到 `~/.ccgauge/`。
3. **Provider 适配层**（`lib/providers/<name>/index.ts`）负责数据目录、JSONL 解析器、价格表、模型名格式化。注册表驱动 —— 加新 provider 就是一个新文件 + 注册表一行。
4. **Claude 解析器** 按行抽取 assistant 消息的 `usage`。
5. **Codex 解析器** 用一个轮状态机走事件流，对每个 `event_msg.token_count` 发射一条记录，**只用 `last_token_usage`**（避免累计字段重复计费）；`cached_input_tokens` 进 cache_read，`reasoning_output_tokens` 并入 output。
6. **价格** 走内置快照：Claude 用 Anthropic 官价（12 个模型），Codex 用 OpenAI 公开 API 单价（gpt-5 系列 + o 系列）。Codex 的成本标注为"API 单价折算估值"——订阅计划（Plus / Pro）实际计费方式不同。
7. **i18n + 主题**：cookie 驱动 SSR + `localStorage` 镜像 + `<head>` 注入同步执行的 no-flash 脚本。

## 增加新 Provider

```
lib/providers/<name>/
  index.ts             ProviderAdapter 实现
  parse-<name>.ts      JSONL → AssistantRecord[]
  pricing.ts           model → Pricing
  shorten-model.ts     模型名美化
```

然后在 `lib/providers/index.ts` 注册一行、在 `ProviderId` 联合里加一项。`scan.ts`、aggregator、价格、所有页面都不用动。

## 本地开发

仓库本身就是一个能跑的 Next.js 工程，可以一边改代码一边看实时数据。

```bash
git clone https://github.com/chengzuopeng/ccgauge.git
cd ccgauge
pnpm install
pnpm dev               # http://localhost:3737
```

常用脚本：

```bash
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint .
pnpm test              # codex parser 烟测（Node 22+）
pnpm build             # next build + 把 static 拷进 .next/standalone
pnpm start             # 用 bin/cli.mjs 跑 standalone 产物
pnpm screenshots       # 重新生成 docs/screenshots/*.png
pnpm clean             # rm -rf .next node_modules
```

发布：

```bash
pnpm pack              # 预览要发布的 tarball
pnpm publish --access public  # 会自动先跑 pnpm build（prepublishOnly）
```

## 排障

| 现象 | 建议命令 |
| --- | --- |
| 端口被自动换掉 | `ccgauge --strict-port --port 3737` |
| 后台服务状态不对 | 先 `ccgauge status`，PID 仍存活但不响应再 `ccgauge stop --force` |
| 后台启动失败 | `ccgauge logs` 查看 `~/.ccgauge/ccgauge.log` |
| 想要干净的 profile | `CCGAUGE_STATE_DIR=/tmp/ccgauge-test ccgauge start -b` |
| Codex 没有数据 | 确认 `~/.codex/sessions` 存在；可在「设置」页查看检测到的路径 |
| 不想自动打开浏览器 | `ccgauge --no-open` |

## 常见问答

**ccgauge 会上传我的对话或日志吗？**
不会。ccgauge 全程跑在本地，只读 Claude Code 和 Codex CLI 已经写在本地的 JSONL 文件，没有任何外网调用。

**和 ccusage 有什么不同？**
[ccusage](https://github.com/ryoppippi/ccusage) 是终端工具，把用量打成表格。ccgauge 是 Web 看板，提供图表、按会话下钻、5 小时窗口实时进度、按项目 / 模型分维度统计，并且**开箱覆盖 OpenAI Codex CLI**。

**对 Claude Pro / Max / Team / Codex Plus 订阅用户有用吗？**
有用。看板始终展示**美元等值**的 API 折算成本，让你看到"如果按 API 计费这些用量值多少钱"。订阅计费方式不同，ccgauge 不替代你的账单。

**支持哪些模型？**
- **Claude Code**：所有 `claude-*` 模型（Opus / Sonnet / Haiku，3.x / 4.x）
- **OpenAI Codex CLI**：gpt-5 系列（gpt-5、gpt-5-mini、gpt-5-nano、gpt-5.4、gpt-5.5、gpt-5.5-mini、gpt-5.5-nano）、gpt-4.1 / gpt-4.1-mini，以及 o 系列（o3、o4-mini）
- 未知模型自动回退到同 family 最新一档单价

**能加我自己的 provider 吗？**
能 —— 见 [增加新 Provider](#增加新-provider) 一节。Provider 适配层就是为了显式留扩展点。

**需要 Anthropic / OpenAI 凭证吗？**
不需要。ccgauge 不调用任何上游 API，只读 CLI 已经写在本地的 JSONL 文件。

## 关键词

`claude code 看板` · `claude code 用量` · `claude code 花费` · `claude code 监控` ·
`codex cli 用量` · `codex cli 看板` · `openai codex 用量` · `openai codex 监控` ·
`AI 编程 CLI token 监控` · `claude pro 计划用量` · `claude max 计划用量` · `codex plus 用量` ·
`prompt caching 节省` · `5 小时窗口监控` · `rate limit 倒计时` · `ccusage 替代品` ·
`ccusage web 版` · `token 用量分析` · `本地 AI 用量监控` · `自部署 AI 看板`

## 许可证

MIT —— 详见 [LICENSE](./LICENSE)。
