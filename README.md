# PolicySim — Multi-Agent Policy Simulation

> Input any policy, product, or event. AI generates multiple stakeholders with conflicting interests and simulates their multi-round strategic games.

[中文](#policysim--多智能体政策仿真系统)

## What is this?

PolicySim is an LLM-driven multi-agent simulation platform. You describe a scenario — a policy, a product launch, a market shift — and the system creates AI-powered agents representing different stakeholders. These agents then engage in multi-round games: they take public stances, scheme privately, form alliances, discover rule loopholes, and deploy sub-agents for specialized tasks.

**Example use cases:**
- A policy researcher inputs "Global ban on combustion engines by 2030" to see how industry, labor, government, and environmental groups interact
- A product manager inputs "Smart wristband for elderly users" and generates customer personas, caregivers, doctors, and regulators to stress-test the product
- An educator demonstrates game theory with students watching agents negotiate in real time

## Key Features

**AI-Generated Agents**
Describe your scenario and let AI create relevant stakeholders automatically. Batch-generate 2-8 agents at once, or create them one by one. Each agent comes with a full profile: values, resources, influence level, strategy, and sub-agent capabilities.

**Multi-Round Strategic Games**
Agents don't just react once — they play multiple rounds. Each round, they see what others did and adjust their strategy. Alliances form and break. Stances shift. Rule exploits get discovered.

**SubAgent System**
Agents can spawn sub-agents for specialized tasks. A capitalist sends lobbyists to court the labor union. An NGO deploys science advisors. A politician's think tank maneuvers behind the scenes. These sub-agents execute independently and report back.

**Parallel Execution**
All agents think concurrently via Web Workers. API calls run off the main thread. You see each agent's response stream in as it's generated — not one after another.

**Relationship Network**
A force-directed graph shows alliances and conflicts between agents in real time. Track how relationships evolve across rounds.

## Pages

| Page | What it does |
|------|-------------|
| Dashboard | Input policy/scenario, select or AI-generate agents, configure rounds, launch simulation |
| Simulation | Three-column workspace: agent hierarchy, game timeline with streaming responses, relationship graph |
| Report | Stance distribution, key turning points, sub-agent performance, discovered rule exploits |
| Agent Library | View, edit, and AI-create agent archetypes |

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand + Immer |
| Visualization | D3.js force graph |
| Multi-threading | Web Workers |
| AI | Claude API compatible (Anthropic, MiniMax, etc.) |

## Quick Start

```bash
git clone https://github.com/wangyaominde/PolicySim.git
cd PolicySim
npm install
```

Create `.env.local` with your API config:

```env
VITE_API_KEY=your-api-key
VITE_API_BASE_URL=https://api.anthropic.com    # or https://api.minimaxi.com/anthropic
VITE_MODEL=claude-sonnet-4-20250514             # or MiniMax-M2.1
```

```bash
npm run dev
```

Open `http://localhost:5173`. Without an API key, the system runs in demo mode with simulated data.

## License

MIT

---

# PolicySim — 多智能体政策仿真系统

> 输入任意政策、产品或事件，AI 自动生成多个利益相关方，模拟多轮策略博弈。

[English](#policysim--multi-agent-policy-simulation)

## 这是什么？

PolicySim 是一个 LLM 驱动的多智能体仿真平台。你描述一个场景——一项政策、一个产品发布、一次市场变动——系统会创建代表不同利益方的 AI 智能体。这些智能体会进行多轮博弈：公开表态、暗中算计、拉帮结派、发现规则漏洞，甚至派出子智能体执行专项任务。

**使用场景举例：**
- 政策研究者输入"2030年全面禁售燃油车"，观察产业界、工会、政府、环保组织的互动博弈
- 产品经理输入"面向老年人的智能手环"，自动生成用户画像、护理者、医生、监管方来压测产品
- 教育者用来演示博弈论，学生实时观看智能体之间的谈判过程

## 核心功能

**AI 自动生成角色**
描述你的场景，AI 自动创建相关利益方。支持一键批量生成 2-8 个角色，也可以逐个创建。每个角色自带完整画像：价值观、资源、影响力、策略风格和子智能体能力。

**多轮策略博弈**
智能体不只反应一次——它们进行多轮博弈。每一轮，它们看到其他人的行动后调整策略。联盟形成又瓦解，立场发生转移，规则漏洞被发现。

**SubAgent 子智能体系统**
智能体可以派生子智能体执行细分任务。资本家派出游说团队拉拢工会，NGO 部署科学顾问提供数据支撑，政客的智囊团在幕后运筹。这些子智能体独立执行并汇报结果。

**并行执行**
所有智能体通过 Web Worker 多线程并发调用 AI。API 调用完全不阻塞界面。每个智能体的响应实时流式显示——不是一个一个串行等待。

**关系网络图谱**
力导向图实时展示智能体间的联盟与对抗关系，追踪关系如何随博弈轮次演变。

## 页面说明

| 页面 | 功能 |
|------|------|
| 首页 | 输入政策/场景，选择或 AI 生成角色，配置参数，启动仿真 |
| 仿真工作台 | 三栏布局：角色层级树 / 博弈时间线（流式输出） / 关系图谱 |
| 仿真报告 | 站队分布、关键转折点、子智能体贡献度、规则漏洞汇总 |
| 角色管理 | 查看、编辑、AI 创建角色原型 |

## 技术栈

| 层 | 技术 |
|-----|------|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand + Immer |
| 可视化 | D3.js 力导向图 |
| 多线程 | Web Workers |
| AI | Claude API 兼容（Anthropic、MiniMax 等） |

## 快速开始

```bash
git clone https://github.com/wangyaominde/PolicySim.git
cd PolicySim
npm install
```

创建 `.env.local` 配置 API：

```env
VITE_API_KEY=你的API密钥
VITE_API_BASE_URL=https://api.anthropic.com    # 或 https://api.minimaxi.com/anthropic
VITE_MODEL=claude-sonnet-4-20250514             # 或 MiniMax-M2.1
```

```bash
npm run dev
```

打开 `http://localhost:5173`。不配置 API Key 也可以用模拟数据体验完整流程。

## License

MIT
