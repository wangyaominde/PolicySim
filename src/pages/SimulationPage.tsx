import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NetworkGraph } from '../components/visualizations';
import type {
  Agent,
  AgentResponse,
  Stance,
  Action,
  SubAgentInstance,
  VisualizationView,
} from '../types';
import { useAgentStore, useSimulationStore, useUIStore } from '../stores';

/* ------------------------------------------------------------------ */
/*  Mock data helpers                                                  */
/* ------------------------------------------------------------------ */

const STANCES: Stance[] = ['support', 'oppose', 'neutral', 'conditional'];

const MOCK_STATEMENTS: Record<string, string[]> = {
  capitalist_01: [
    '从产业投资回报率来看，这项政策将严重压缩企业利润空间。我们需要更渐进的过渡方案，同时保障市场的基本运行逻辑。任何脱离经济现实的政策注定失败。',
    '资本市场已经对此政策做出了负面反应。企业界一致认为需要更长的过渡期和更多的政府补贴来缓解转型成本。',
  ],
  worker_01: [
    '工人阶级将承受这项政策最大的冲击。数百万岗位面临消失，而政府至今没有提出具体的再就业培训计划。我们要求在政策落地前先建立完善的社会保障网络。',
    '工会经过充分讨论，认为该政策在缺乏配套措施的情况下推行将带来严重的社会不稳定因素。',
  ],
  politician_01: [
    '政府需要在各方利益之间找到平衡点。我们正在考虑分阶段实施方案，同时建立专项基金来应对转型期的社会成本。政策的稳定性是第一要务。',
    '经过跨部门协商，我们倾向于采取折中方案，在坚持政策方向的同时给予足够的缓冲期。',
  ],
  media_01: [
    '我们的调查发现，政策制定过程中存在严重的信息不对称。部分利益集团正在暗中游说修改政策条款，公众有权知道完整的决策过程。',
    '舆论监测显示公众对该政策的态度呈两极分化趋势。我们将持续跟踪报道各方博弈的最新进展。',
  ],
  environmental_01: [
    '气候危机不等人。科学数据清楚表明，如果不立即采取行动，我们将错过关键的减排窗口期。经济利益不能凌驾于生态安全之上。',
    '我们的科学团队已经完成了政策影响评估，结论是当前力度仍然不够。需要更激进的时间表和更严格的执行标准。',
  ],
  scientist_01: [
    '从技术可行性角度分析，该政策设定的目标在理论上是可以实现的，但需要在关键技术节点上加大研发投入。我们建议建立政产学研协同创新机制。',
    '基于我们的模型预测，政策实施的最佳路径应当是技术驱动型的渐进式推进，而非行政命令式的激进转型。',
  ],
  public_01: [
    '老百姓最关心的是生活成本会不会上升。政策描述的远景很美好，但我们更需要知道明天的菜价和房贷会不会受到影响。',
    '身边很多人都在讨论这个政策，大家普遍感到不安。希望政府能多听听普通人的声音，不要只关注大企业和专家的意见。',
  ],
  finance_01: [
    '我们的量化模型显示，该政策将在短期内创造显著的套利机会。聪明的资本已经开始布局相关板块，建议关注政策受益标的。',
    '金融市场的定价机制已经开始反映政策预期。波动率上升意味着更多的交易机会，但也需要警惕系统性风险。',
  ],
};

const MOCK_THOUGHTS: string[] = [
  '需要仔细评估各方立场的真实意图，表面的合作可能隐藏着更深层的博弈策略。',
  '当前局势对我方不利，需要寻找新的盟友来增强谈判筹码。',
  '如果政策继续朝这个方向发展，我们需要准备B计划。',
  '对手的策略比预想的更激进，需要调整我方应对方案。',
  '这一轮的关键在于争取中间派的支持，不能让他们倒向对立阵营。',
];

const MOCK_EXPLOITATIONS: string[] = [
  '发现政策条款中的模糊表述可以作多种解释，计划利用这一灰色地带为己方争取更大空间。',
  '监管框架中存在执行层面的漏洞，可以通过合规但边界性的操作来规避部分限制。',
  '利用政策征求意见期的程序性要求，延缓不利条款的实施进度。',
  '通过关联政策领域的交叉引用，找到绕过核心限制的替代路径。',
];

const ACTION_TYPES: Action['type'][] = ['lobby', 'threaten', 'ally', 'invest', 'boycott', 'observe', 'spawn_sub'];

const ACTION_LABELS: Record<Action['type'], string> = {
  lobby: '游说',
  threaten: '施压',
  ally: '结盟',
  invest: '投资',
  boycott: '抵制',
  observe: '观望',
  spawn_sub: '派遣子代理',
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockResponse(agent: Agent, round: number): AgentResponse {
  const statements = MOCK_STATEMENTS[agent.id] ?? [
    `作为${agent.name}，我们对该政策持审慎态度，将根据形势发展调整应对策略。`,
  ];
  const numActions = Math.floor(Math.random() * 3) + 1;
  const actions: Action[] = Array.from({ length: numActions }, () => ({
    type: pickRandom(ACTION_TYPES),
    target: pickRandom(agent.allies.length > 0 ? [...agent.allies, ...agent.rivals] : ['general']),
    description: '策略性行动部署',
  }));

  return {
    agentId: agent.id,
    round,
    stance: pickRandom(STANCES),
    impactScore: Math.round((Math.random() * 20 - 10) * 10) / 10,
    publicStatement: pickRandom(statements),
    privateThought: pickRandom(MOCK_THOUGHTS),
    actions,
    allianceIntent: agent.allies.slice(0, 1).map((id) => ({
      agentId: id,
      reason: '基于共同利益的策略性合作',
    })),
    oppositionIntent: agent.rivals.slice(0, 1).map((id) => ({
      agentId: id,
      reason: '利益冲突导致的对立',
    })),
    ruleExploitation: Math.random() > 0.5 ? pickRandom(MOCK_EXPLOITATIONS) : '',
    spawnSubAgents: agent.subAgentSlots.length > 0 && Math.random() > 0.4
      ? [{ slotId: agent.subAgentSlots[0].slotId, task: `第${round}轮策略执行`, priority: 'high' as const }]
      : [],
    streamingText: '',
    isStreaming: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Shared small components                                            */
/* ------------------------------------------------------------------ */

const STANCE_COLORS: Record<Stance, string> = {
  support: 'bg-green-500/20 text-green-400 border-green-500/30',
  oppose: 'bg-red-500/20 text-red-400 border-red-500/30',
  neutral: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  conditional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};
const STANCE_LABELS: Record<Stance, string> = {
  support: '支持', oppose: '反对', neutral: '中立', conditional: '有条件',
};

function StanceChip({ stance }: { stance: Stance }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full border ${STANCE_COLORS[stance]}`}>
      {STANCE_LABELS[stance]}
    </span>
  );
}

function ImpactBar({ score }: { score: number }) {
  const pct = ((score + 10) / 20) * 100;
  const color = score > 0 ? 'bg-green-500' : score < 0 ? 'bg-red-500' : 'bg-zinc-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <span className="text-[10px] text-on-surface-variant font-mono w-8 text-right">{score > 0 ? '+' : ''}{score}</span>
      <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase().includes('active') || status.toLowerCase().includes('influence');
  return (
    <span className={`text-[9px] uppercase tracking-widest font-medium px-1.5 py-0.5 rounded ${
      isActive ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
    }`}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Left column: Policy summary */
function PolicySummary({
  policy,
  status,
  currentRound,
  totalRounds,
}: {
  policy: string;
  status: string;
  currentRound: number;
  totalRounds: number;
}) {
  const progress = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0;
  const statusColor: Record<string, string> = {
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-primary/20 text-primary',
    error: 'bg-red-500/20 text-red-400',
    idle: 'bg-zinc-500/20 text-zinc-400',
    configuring: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className="mb-6">
      <h3 className="font-headline text-sm text-on-surface font-semibold mb-1 truncate">{policy || 'Untitled Policy'}</h3>
      <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{policy}</p>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${statusColor[status] ?? statusColor.idle}`}>
          {status}
        </span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">
            ROUND {currentRound}/{totalRounds}
          </span>
          <span className="text-[10px] text-on-surface-variant font-mono">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}

/** Left column: Agent hierarchy tree */
function AgentHierarchy({
  agents,
  subAgentInstances,
  responses,
}: {
  agents: Agent[];
  subAgentInstances: SubAgentInstance[];
  responses: AgentResponse[];
}) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-3">Agent Hierarchy</h4>
      <ul className="space-y-1">
        {agents.map((agent) => {
          const subs = subAgentInstances.filter((s) => s.parentId === agent.id);
          const hasSubs = agent.subAgentSlots.length > 0;
          const isExpanded = expandedAgents.has(agent.id);

          return (
            <li key={agent.id}>
              <button
                onClick={() => hasSubs && toggle(agent.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-container transition-colors text-left"
              >
                {hasSubs && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-on-surface-variant text-[10px]"
                  >
                    &#9654;
                  </motion.span>
                )}
                <span className="text-base">{agent.avatar}</span>
                <span className="text-xs text-on-surface font-medium truncate flex-1">{agent.name}</span>
                <StanceChip stance={responses.find(r => r.agentId === agent.id)?.stance ?? 'neutral'} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {agent.subAgentSlots.map((slot) => {
                      const instance = subs.find((s) => s.slotId === slot.slotId);
                      const statusText = instance
                        ? instance.status === 'active' ? 'ACTIVE INFLUENCE' : 'REVIEWING DRAFTS'
                        : 'STANDBY';
                      return (
                        <li key={slot.slotId} className="flex items-center gap-2 pl-10 pr-2 py-1 relative">
                          {/* connecting line */}
                          <span className="absolute left-6 top-0 bottom-0 w-px bg-surface-container-highest" />
                          <span className="absolute left-6 top-1/2 w-3 h-px bg-surface-container-highest" />
                          <span className="text-sm">{slot.avatar}</span>
                          <span className="text-[11px] text-on-surface-variant truncate flex-1">{slot.name}</span>
                          <StatusBadge status={statusText} />
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Skeleton loading card for agents that haven't started yet */
function SkeletonCard({ agent }: { agent: Agent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="bg-surface-container rounded-lg p-5 mb-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{agent.avatar}</span>
        <span className="font-headline text-sm text-on-surface font-semibold">{agent.name}</span>
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full border bg-zinc-500/10 border-zinc-500/20">
          <span className="w-8 h-2.5 bg-zinc-700/40 rounded animate-pulse" />
        </span>
      </div>
      <div className="border-l-2 border-zinc-600 pl-4 space-y-2">
        <div className="h-3 bg-zinc-700/30 rounded w-full animate-pulse" />
        <div className="h-3 bg-zinc-700/30 rounded w-5/6 animate-pulse" />
        <div className="h-3 bg-zinc-700/30 rounded w-4/6 animate-pulse" />
      </div>
      <div className="flex gap-1.5 mt-3">
        <span className="w-12 h-5 bg-zinc-700/20 rounded-full animate-pulse" />
        <span className="w-10 h-5 bg-zinc-700/20 rounded-full animate-pulse" />
      </div>
    </motion.div>
  );
}

/** Center column: Single agent response card */
function AgentResponseCard({
  response,
  agent,
  agents,
  subAgentInstances,
  isExpanded,
  onToggle,
  streamingText,
}: {
  response: AgentResponse;
  agent: Agent | undefined;
  agents: Agent[];
  subAgentInstances: SubAgentInstance[];
  isExpanded: boolean;
  onToggle: () => void;
  streamingText?: string;
}) {
  if (!agent) return null;

  const subs = subAgentInstances.filter((s) => s.parentId === agent.id);
  const isCurrentlyStreaming = response.isStreaming || (streamingText !== undefined && streamingText !== response.publicStatement);
  const displayText = isCurrentlyStreaming && streamingText !== undefined ? streamingText : response.publicStatement;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="bg-surface-container rounded-lg p-5 mb-4"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{agent.avatar}</span>
        <span className="font-headline text-sm text-on-surface font-semibold">{agent.name}</span>
        <StanceChip stance={response.stance} />
        <div className="ml-auto">
          <ImpactBar score={response.impactScore} />
        </div>
      </div>

      {/* Public Statement */}
      <div className="border-l-2 border-green-500 pl-4 mb-4">
        <p className="text-sm text-on-surface leading-relaxed font-body">
          {displayText}
          {isCurrentlyStreaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-text-bottom"
            />
          )}
        </p>
      </div>

      {/* SubAgent section */}
      {subs.length > 0 && (
        <div className="mb-4 space-y-2">
          {subs.map((sub) => (
            <div key={sub.slotId} className="ml-6 bg-surface-container-low rounded-md p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">{sub.avatar}</span>
                <span className="text-xs text-on-surface font-medium">{sub.name}</span>
                <StatusBadge status={sub.status === 'active' ? 'ACTIVE INFLUENCE' : sub.status.toUpperCase()} />
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1 ml-6">{sub.task}</p>
            </div>
          ))}
        </div>
      )}

      {/* Expandable sections */}
      <button
        onClick={onToggle}
        className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors font-medium mb-2"
      >
        {isExpanded ? '- Hide Details' : '+ Show Details'}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-3 mt-2"
          >
            {/* Private thought */}
            {response.privateThought && (
              <div className="bg-surface-container-lowest rounded-md p-3">
                <h5 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-1">Private Thought</h5>
                <p className="text-xs text-on-surface-variant italic leading-relaxed">{response.privateThought}</p>
              </div>
            )}

            {/* Rule exploitation */}
            {response.ruleExploitation && (
              <div className="border-l-2 border-tertiary bg-tertiary/5 rounded-r-md p-3">
                <h5 className="text-[10px] uppercase tracking-widest text-tertiary font-medium mb-1">Rule Exploitation</h5>
                <p className="text-xs text-on-surface-variant leading-relaxed">{response.ruleExploitation}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {response.actions.map((action, i) => (
          <span
            key={i}
            className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium rounded-full bg-surface-container-highest text-on-surface-variant"
          >
            {ACTION_LABELS[action.type] ?? action.type}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/** Right column: Visualization panel */
function VisualizationPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const tabs: { key: VisualizationView; label: string }[] = [
    { key: 'graph', label: 'GRAPH' },
    { key: 'matrix', label: 'MATRIX' },
    { key: 'flow', label: 'FLOW' },
  ];

  const insights = [
    '媒体舆论波动正在触发多方"游说"防御机制',
    '资本方与工会的对立加剧，中间派立场松动',
    '环保组织的科学论据正在影响政治家的决策权重',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* View tabs */}
      <div className="flex border-b border-white/5 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`flex-1 pb-2 text-[11px] uppercase tracking-widest font-medium transition-colors ${
              activeView === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visualization */}
      <div className="flex-1 min-h-[240px] mb-4">
        {activeView === 'graph' ? (
          <NetworkGraph />
        ) : (
          <div className="bg-surface-container rounded-lg h-full flex items-center justify-center">
            <span className="text-sm text-on-surface-variant">
              {activeView === 'matrix' ? 'Stance Matrix' : 'Interest Flow'} — Coming soon
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-green-500 inline-block" />
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Strategic Alliance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-red-500 inline-block" />
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Active Conflict</span>
        </div>
      </div>

      {/* Real-time correlation */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium mb-2">Real-time Correlation</h4>
        <div className="space-y-2">
          {insights.map((text, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15, duration: 0.3 }}
              className="bg-surface-container rounded-md p-2.5"
            >
              <p className="text-[11px] text-on-surface-variant leading-relaxed">{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function SimulationPage() {
  const navigate = useNavigate();

  // Cleanup worker on unmount
  const workerCleanupRef = useRef<Worker | null>(null);
  useEffect(() => {
    return () => {
      workerCleanupRef.current?.terminate();
    };
  }, []);

  // Stores
  const config = useSimulationStore((s) => s.config);
  const status = useSimulationStore((s) => s.status);
  const currentRound = useSimulationStore((s) => s.currentRound);
  const rounds = useSimulationStore((s) => s.rounds);
  const subAgentInstances = useSimulationStore((s) => s.subAgentInstances);
  const streamingResponses = useSimulationStore((s) => s.streamingResponses);
  const startSimulation = useSimulationStore((s) => s.startSimulation);
  const setStatus = useSimulationStore((s) => s.setStatus);
  const appendStreamChunk = useSimulationStore((s) => s.appendStreamChunk);
  const addResponse = useSimulationStore((s) => s.addResponse);
  const completeRound = useSimulationStore((s) => s.completeRound);
  const initRound = useSimulationStore((s) => s.initRound);
  const addSubAgentInstance = useSimulationStore((s) => s.addSubAgentInstance);

  const allAgents = useAgentStore((s) => s.agents);
  const customAgents = useAgentStore((s) => s.customAgents);

  const apiKey = useUIStore((s) => s.apiKey);
  const apiBaseUrl = useUIStore((s) => s.apiBaseUrl);
  const model = useUIStore((s) => s.model);
  const selectedIds = useAgentStore((s) => s.selectedIds);

  const expandedCards = useUIStore((s) => s.expandedCards);
  const toggleCardExpansion = useUIStore((s) => s.toggleCardExpansion);

  // Local state
  const [viewingRound, setViewingRound] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const abortRef = useRef(false);
  const autoPlayTriggered = useRef(false);

  const agents = [...allAgents, ...customAgents];
  const selectedAgents = agents.filter((a) => selectedIds.includes(a.id));
  const totalRounds = config?.totalRounds ?? 4;

  // Auto-play ref — always holds the latest playSim
  const autoPlayRef = useRef<() => void>();

  // On mount: set up config if missing, then auto-play after brief delay
  useEffect(() => {
    if (!config) {
      startSimulation({
        id: 'mock-sim-' + Date.now(),
        policy: '2030年全面禁售燃油车 — 政府宣布自2030年起全面禁止销售传统燃油汽车',
        policyTypes: ['environment', 'economic', 'tech'],
        totalRounds: 4,
        selectedAgentIds: selectedIds,
        workerConcurrency: 'medium',
        createdAt: Date.now(),
      });
    }
    setPreparing(true);

    const timer = setTimeout(() => {
      setPreparing(false);
      autoPlayTriggered.current = true;
      // Use a small delay so autoPlayRef.current is bound to latest playSim
      setTimeout(() => autoPlayRef.current?.(), 100);
    }, 800);

    return () => clearTimeout(timer);
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  // Get responses for the round being viewed
  const viewingRoundData = rounds.find((r) => r.roundNumber === viewingRound);
  const responses = viewingRoundData?.responses ?? [];

  // --- Real API simulation via Web Worker ---
  const workerRef = useRef<Worker | null>(null);

  const runRealRound = useCallback((round: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/api.worker.ts', import.meta.url),
          { type: 'module' }
        );
      }
      const worker = workerRef.current;

      const policy = config?.policy ?? '';
      // Build round context from previous round
      let roundContext = '';
      if (round > 1) {
        const prevRound = rounds.find((r) => r.roundNumber === round - 1);
        if (prevRound) {
          roundContext = prevRound.responses
            .map((r) => {
              const a = agents.find((ag) => ag.id === r.agentId);
              return `${a?.name ?? r.agentId}（${r.stance}）：${r.publicStatement.slice(0, 100)}`;
            })
            .join('\n');
        }
      }

      // Pre-create the round so addResponse can push incrementally
      initRound(round);
      setViewingRound(round);

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'AGENT_STREAM_CHUNK') {
          appendStreamChunk(msg.agentId, msg.chunk);
        } else if (msg.type === 'AGENT_COMPLETE') {
          const resp = msg.response as AgentResponse;
          addResponse({ ...resp, isStreaming: false, streamingText: resp.publicStatement });

          // Spawn sub-agent instances for display
          if (resp.spawnSubAgents?.length > 0) {
            const agent = agents.find((a) => a.id === resp.agentId);
            if (agent) {
              for (const spawn of resp.spawnSubAgents) {
                const slot = agent.subAgentSlots.find((s) => s.slotId === spawn.slotId);
                if (slot) {
                  addSubAgentInstance({
                    ...slot,
                    parentId: agent.id,
                    task: spawn.task,
                    status: 'active',
                    result: null,
                    spawnedAtRound: round,
                  });
                }
              }
            }
          }
        } else if (msg.type === 'ROUND_COMPLETE') {
          // Round was pre-created; responses were added incrementally
          resolve();
        } else if (msg.type === 'ERROR') {
          // Individual agent errors are handled — worker sends fallback AGENT_COMPLETE
          // Only reject if it's a global error (no agentId)
          if (!msg.agentId) {
            reject(new Error(msg.error));
          } else {
            console.warn(`[Sim] Agent error: ${msg.error}`);
          }
        }
      };

      worker.postMessage({
        type: 'START_ROUND',
        agents: selectedAgents,
        policy,
        roundContext,
        round,
        apiKey,
        apiBaseUrl,
        model,
        maxConcurrency: 5,
      });
    });
  }, [config, rounds, agents, selectedAgents, apiKey, apiBaseUrl, model, appendStreamChunk, addResponse, initRound, addSubAgentInstance]);

  // --- Mock simulation fallback (parallel batches of 2-3 agents) ---
  const runMockRound = useCallback(async (round: number) => {
    if (abortRef.current) return;

    const mockResponses: AgentResponse[] = selectedAgents.map((agent) =>
      generateMockResponse(agent, round)
    );

    // Pre-create the round entry so addResponse can push completed agents incrementally
    initRound(round);
    setViewingRound(round);

    // Stream a single agent's response character by character
    const streamAgent = async (resp: AgentResponse) => {
      if (abortRef.current) return;

      // Spawn sub-agents first
      if (resp.spawnSubAgents.length > 0) {
        const agent = agents.find((a) => a.id === resp.agentId);
        if (agent) {
          for (const spawn of resp.spawnSubAgents) {
            const slot = agent.subAgentSlots.find((s) => s.slotId === spawn.slotId);
            if (slot) {
              addSubAgentInstance({
                ...slot,
                parentId: agent.id,
                task: spawn.task,
                status: 'active',
                result: null,
                spawnedAtRound: round,
              });
            }
          }
        }
      }

      // Initialize streaming for this agent
      appendStreamChunk(resp.agentId, '');

      const text = resp.publicStatement;
      for (let i = 0; i < text.length; i++) {
        if (abortRef.current) return;
        appendStreamChunk(resp.agentId, text[i]);
        await new Promise((r) => setTimeout(r, 15));
      }

      addResponse({ ...resp, isStreaming: false, streamingText: text });
    };

    // Run agents in parallel batches of 2-3
    const BATCH_SIZE = 3;
    for (let i = 0; i < mockResponses.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = mockResponses.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(streamAgent));
      // Brief pause between batches
      if (i + BATCH_SIZE < mockResponses.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Finalize the round: clear streaming state
    completeRound({
      roundNumber: round,
      responses: [], // empty — responses were already added incrementally
      subAgentResults: {},
      alliances: [],
      timestamp: Date.now(),
    });
  }, [selectedAgents, agents, appendStreamChunk, addResponse, initRound, completeRound, addSubAgentInstance]);

  // Pick real or mock based on API key availability
  const runSimulationRound = useCallback(async (round: number) => {
    if (apiKey) {
      await runRealRound(round);
    } else {
      await runMockRound(round);
    }
  }, [apiKey, runRealRound, runMockRound]);

  // Auto-play simulation
  const playSim = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    abortRef.current = false;
    setStatus('running');

    const startFrom = rounds.length + 1;
    for (let r = startFrom; r <= totalRounds; r++) {
      if (abortRef.current) break;
      await runSimulationRound(r);
      // Pause between rounds
      await new Promise((res) => setTimeout(res, 600));
    }

    if (!abortRef.current) {
      setStatus('completed');
    }
    setIsPlaying(false);
  }, [isPlaying, rounds.length, totalRounds, runSimulationRound, setStatus]);

  // Keep autoPlayRef in sync with latest playSim
  useEffect(() => {
    autoPlayRef.current = playSim;
  }, [playSim]);

  const skipToNext = useCallback(async () => {
    if (isPlaying) return;
    const nextRound = rounds.length + 1;
    if (nextRound > totalRounds) return;
    setIsPlaying(true);
    abortRef.current = false;
    setStatus('running');
    await runSimulationRound(nextRound);
    setStatus(nextRound >= totalRounds ? 'completed' : 'paused');
    setIsPlaying(false);
  }, [isPlaying, rounds.length, totalRounds, runSimulationRound, setStatus]);

  const pauseSim = useCallback(() => {
    abortRef.current = true;
    setIsPlaying(false);
    setStatus('paused');
  }, [setStatus]);

  return (
    <div className="grid grid-cols-[280px_1fr_320px] h-screen pt-16">
      {/* ======================== LEFT COLUMN ======================== */}
      <aside className="bg-surface-container-low p-4 overflow-y-auto border-r border-white/5">
        <PolicySummary
          policy={config?.policy ?? ''}
          status={status}
          currentRound={Math.min(viewingRound, totalRounds)}
          totalRounds={totalRounds}
        />
        <div className="border-t border-white/5 pt-4">
          <AgentHierarchy agents={selectedAgents} subAgentInstances={subAgentInstances} responses={responses} />
        </div>
      </aside>

      {/* ======================== CENTER COLUMN ======================== */}
      <main className="p-6 overflow-y-auto">
        {/* Timeline Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-lg text-on-surface font-semibold">
            Timeline: Round {viewingRound}
          </h2>
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={pauseSim}
                className="px-3 py-1.5 rounded-md bg-surface-container text-on-surface-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <rect x="5" y="4" width="3" height="12" rx="1" />
                    <rect x="12" y="4" width="3" height="12" rx="1" />
                  </svg>
                  Pause
                </span>
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={playSim}
                  disabled={status === 'completed'}
                  className="px-3 py-1.5 rounded-md bg-primary text-on-surface text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                    </svg>
                    Play
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={skipToNext}
                  disabled={status === 'completed'}
                  className="px-3 py-1.5 rounded-md bg-surface-container text-on-surface-variant text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-high transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4.3 2.841A1.5 1.5 0 0 0 2 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l7.344-5.89a1.5 1.5 0 0 0 0-2.538L4.3 2.84Z" />
                      <path d="M14 4a1 1 0 0 1 2 0v12a1 1 0 1 1-2 0V4Z" />
                    </svg>
                    Next Round
                  </span>
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Agent Response Cards — show completed, streaming, and skeleton cards */}
        <AnimatePresence mode="popLayout">
          {(() => {
            // IDs of agents that already have completed responses for this round
            const completedIds = new Set(responses.map((r) => r.agentId));
            // IDs of agents currently streaming (not yet completed)
            // Check for key existence (even empty string means streaming has started)
            const streamingIds = selectedAgents
              .filter((a) => !completedIds.has(a.id) && a.id in streamingResponses)
              .map((a) => a.id);
            // IDs of agents not yet started (skeleton)
            const pendingAgents = selectedAgents.filter(
              (a) => !completedIds.has(a.id) && !streamingIds.includes(a.id)
            );
            const isRunning = isPlaying || status === 'running';

            return (
              <>
                {/* Completed response cards */}
                {responses.map((resp, idx) => {
                  const agent = agents.find((a) => a.id === resp.agentId);
                  const cardId = `${resp.agentId}-${resp.round}`;
                  return (
                    <motion.div key={cardId} transition={{ delay: idx * 0.08 }}>
                      <AgentResponseCard
                        response={resp}
                        agent={agent}
                        agents={agents}
                        subAgentInstances={subAgentInstances}
                        isExpanded={expandedCards.includes(cardId)}
                        onToggle={() => toggleCardExpansion(cardId)}
                        streamingText={streamingResponses[resp.agentId]}
                      />
                    </motion.div>
                  );
                })}

                {/* Currently streaming cards (not yet in responses) */}
                {streamingIds.map((id) => {
                  const agent = agents.find((a) => a.id === id);
                  if (!agent) return null;
                  return (
                    <motion.div
                      key={`streaming-${id}`}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35 }}
                      className="bg-surface-container rounded-lg p-5 mb-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{agent.avatar}</span>
                        <span className="font-headline text-sm text-on-surface font-semibold">{agent.name}</span>
                      </div>
                      <div className="border-l-2 border-green-500 pl-4">
                        <p className="text-sm text-on-surface leading-relaxed font-body">
                          {streamingResponses[id]}
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6 }}
                            className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-text-bottom"
                          />
                        </p>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Skeleton cards for agents that haven't started yet (only during running) */}
                {isRunning && pendingAgents.map((agent) => (
                  <SkeletonCard key={`skeleton-${agent.id}`} agent={agent} />
                ))}
              </>
            );
          })()}
        </AnimatePresence>

        {/* Preparing state — only show when nothing else is visible */}
        {preparing && responses.length === 0 && Object.keys(streamingResponses).length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-sm mb-2"
            >
              Preparing simulation...
            </motion.div>
            <div className="flex gap-1 mt-3">
              {selectedAgents.slice(0, 5).map((a) => (
                <motion.span
                  key={a.id}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: Math.random() * 0.5 }}
                  className="text-xl"
                >
                  {a.avatar}
                </motion.span>
              ))}
            </div>
            <p className="text-xs mt-3">Setting up {selectedAgents.length} agent environments</p>
          </div>
        )}

        {/* Empty state — only when not preparing and truly idle */}
        {!preparing && !isPlaying && status !== 'running' && responses.length === 0 && Object.keys(streamingResponses).length === 0 && rounds.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
            <p className="text-sm mb-2">Press Play to start the simulation</p>
            <p className="text-xs">Agents will debate the policy round by round</p>
          </div>
        )}

        {/* Round navigation */}
        {rounds.length > 0 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
            <button
              onClick={() => setViewingRound((v) => Math.max(1, v - 1))}
              disabled={viewingRound <= 1}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              &larr; Previous Round
            </button>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-mono">
              {viewingRound} / {rounds.length}
            </span>
            <button
              onClick={() => setViewingRound((v) => Math.min(rounds.length, v + 1))}
              disabled={viewingRound >= rounds.length}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next Round &rarr;
            </button>
          </div>
        )}
      </main>

      {/* ======================== RIGHT COLUMN ======================== */}
      <aside className="bg-surface-container-low p-4 overflow-y-auto border-l border-white/5">
        <VisualizationPanel />
      </aside>
    </div>
  );
}
