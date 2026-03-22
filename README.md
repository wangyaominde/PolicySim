# PolicySim — Multi-Agent Policy Simulation

> Input any policy, product, or event. AI generates high-fidelity personas with conflicting interests and simulates their multi-round strategic games.

[中文](#policysim--多智能体政策仿真系统)

## What is this?

PolicySim is an LLM-driven multi-agent simulation platform. You describe a scenario — a policy, a product launch, a market shift — and the system creates AI-powered agents representing real, specific individuals (not generic labels). These agents engage in multi-round games: they take public stances, scheme privately, form alliances, discover rule loopholes, and deploy sub-agents for specialized tasks.

**Example use cases:**
- A policy researcher inputs "Global ban on combustion engines by 2030" → gets a 52-year-old factory owner with 300 employees facing bankruptcy, a 28-year-old EV startup founder eyeing subsidies, a union leader with 20 years on the floor...
- A product manager inputs "Smart blood glucose wristband for elderly, ¥899, requires phone app" → gets a 68-year-old retired teacher who can't use smartphones and lives alone with diabetes, a 42-year-old daughter who worries remotely, a community clinic doctor managing 300 chronic patients by hand...
- An educator demonstrates game theory with students watching these specific personas negotiate, ally, and betray

## Key Features

**High-Granularity AI Personas**
Not "elderly user" — but "68-year-old retired teacher / can't use smartphones / lives alone / has diabetes / daughter in another city." Each persona comes with age, occupation, family situation, pain points, information channels, hidden motivations, and real social connections. Batch-generate 2-8 personas from a scenario description, or create them one by one.

**Multi-Round Strategic Games**
Agents don't just react once — they play multiple rounds. Each round, they see what others did and adjust. Alliances form and break. Stances shift. Rule exploits get discovered. Each agent's reasoning is driven by their specific life circumstances, not generic archetypes.

**SubAgent System**
Agents deploy real people from their life as sub-agents. The retired teacher asks her daughter to research the product online. The factory owner calls his lawyer friend. The community doctor consults the district health bureau contact. These sub-agents execute independently and report back, influencing the next round.

**Three Visualization Modes**
- **Relationship Network** — Force-directed graph showing alliances and conflicts, with sub-agents orbiting as satellites
- **Stance Matrix** — Agent × Agent heatmap showing relationship strength and polarity
- **Interest Flow** — Sankey diagram showing how policy impacts flow between stakeholder categories and individual agents

**Multi-Provider AI Support**
Works with any Anthropic-compatible API. Built-in presets for Anthropic (Claude) and MiniMax, with custom provider option. Configure API key, base URL, and model from the settings panel — no code changes needed.

## Pages

| Page | What it does |
|------|-------------|
| Dashboard | Input policy/scenario, select or AI-generate personas, configure rounds, launch |
| Simulation | Three-column workspace: persona hierarchy / game timeline / visualization panel |
| Report | Stance distribution, key turning points, sub-agent performance, discovered rule exploits |
| Agent Library | Browse, edit, and AI-create persona archetypes |

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand + Immer |
| Visualization | D3.js (force graph, heatmap, Sankey) |
| Multi-threading | Web Workers |
| AI | Anthropic-compatible API (Claude, MiniMax, custom) |

## Quick Start

```bash
git clone https://github.com/wangyaominde/PolicySim.git
cd PolicySim
npm install
npm run dev
```

Open `http://localhost:5173`. Click the settings icon to configure your AI provider (API key, base URL, model). Without a key, the system runs in demo mode with simulated data.

Optionally, create `.env.local` for local defaults:

```env
VITE_API_KEY=your-api-key
VITE_API_BASE_URL=https://api.minimaxi.com/anthropic
VITE_MODEL=MiniMax-M2.1
```

## License

MIT

---

# PolicySim — 多智能体政策仿真系统

> 输入任意政策、产品或事件，AI 自动生成高粒度真实人物画像，模拟多轮策略博弈。

[English](#policysim--multi-agent-policy-simulation)

## 这是什么？

PolicySim 是一个 LLM 驱动的多智能体仿真平台。你描述一个场景——一项政策、一个产品、一次市场变动——系统会创建代表真实具体个体（不是泛泛的群体标签）的 AI 智能体。这些智能体会进行多轮博弈：公开表态、暗中算计、拉帮结派、发现规则漏洞，甚至派出身边的人执行专项任务。

**使用场景举例：**
- 政策研究者输入"2030年全面禁售燃油车" → 得到52岁工厂老板/300人面临失业、28岁新能源创业者/盯着补贴、干了20年的工会主席...
- 产品经理输入"面向老年人的智能血糖手环，售价899元，需要连手机App" → 得到68岁退休教师/不会用智能机/独居/糖尿病、42岁在外地工作的女儿/远程担心父亲、社区卫生站医生/手动管理300个慢病患者...
- 教育者用来演示博弈论，学生看着这些有血有肉的角色如何谈判、结盟、背叛

## 核心功能

**高粒度 AI 人物画像**
不是"老年用户"——而是"68岁退休教师/不会用智能机/独居/糖尿病/女儿在深圳"。每个角色有年龄、职业、家庭处境、生活痛点、信息获取渠道、隐藏动机和真实社会关系。支持一键批量生成 2-8 个角色，也可以逐个创建。

**多轮策略博弈**
智能体不只反应一次——它们进行多轮博弈。每一轮看到其他人的行动后调整策略。联盟形成又瓦解，立场转移，规则漏洞被发现。每个角色的思考都基于其具体生活处境，不是空洞的类型标签。

**SubAgent 子智能体 — 来自生活的真实人脉**
退休教师让女儿帮忙在网上查产品评价。工厂老板打电话给律师朋友。社区医生咨询认识的区卫健委的人。这些子智能体独立执行任务并汇报结果，影响下一轮博弈走向。

**三种可视化模式**
- **关系网络** — 力导向图展示联盟与对抗，子智能体像卫星环绕
- **站队矩阵** — Agent × Agent 热力图，显示关系强度和方向
- **利益流向** — 桑基图展示政策影响如何在各类别和个体之间流动

**多 AI 厂商支持**
兼容任何 Anthropic 兼容 API。内置 Anthropic (Claude) 和 MiniMax 预设，支持自定义厂商。在设置面板配置 API Key、Base URL 和模型——无需改代码。

## 页面说明

| 页面 | 功能 |
|------|------|
| 首页 | 输入政策/场景，选择或 AI 生成角色，配置参数，启动仿真 |
| 仿真工作台 | 三栏布局：角色层级树 / 博弈时间线 / 可视化面板 |
| 仿真报告 | 站队分布、关键转折点、子智能体贡献度、规则漏洞汇总 |
| 角色管理 | 浏览、编辑、AI 创建角色原型 |

## 技术栈

| 层 | 技术 |
|-----|------|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand + Immer |
| 可视化 | D3.js（力导向图、热力图、桑基图） |
| 多线程 | Web Workers |
| AI | Anthropic 兼容 API（Claude、MiniMax、自定义） |

## 快速开始

```bash
git clone https://github.com/wangyaominde/PolicySim.git
cd PolicySim
npm install
npm run dev
```

打开 `http://localhost:5173`，点击设置图标配置 AI 厂商（API Key、Base URL、模型）。不配置也可以用模拟数据体验完整流程。

也可以创建 `.env.local` 设置本地默认值：

```env
VITE_API_KEY=你的API密钥
VITE_API_BASE_URL=https://api.minimaxi.com/anthropic
VITE_MODEL=MiniMax-M2.1
```

## License

MIT
