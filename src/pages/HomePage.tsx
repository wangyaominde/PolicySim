import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import type {
  PolicyType,
  SimulationConfig,
  SourceDocument,
  AdvisoryConfig,
} from '../types';
import { useAgentStore, useSimulationStore, useAdvisoryStore } from '../stores';
import { PRESET_POLICY_TEMPLATES } from '../data/presetAgents';
import AIAgentCreator from '../components/agents/AIAgentCreator';
import { FileDropzone } from '../components/advisory';

type Mode = 'policy' | 'decision';

const POLICY_TYPE_OPTIONS: { label: string; value: PolicyType }[] = [
  { label: 'ECONOMIC', value: 'economic' },
  { label: 'TECH', value: 'tech' },
  { label: 'SOCIAL', value: 'social' },
  { label: 'ENVIRONMENT', value: 'environment' },
];

const CONCURRENCY_OPTIONS = [
  { label: 'Low', value: 'low' as const },
  { label: 'Med', value: 'medium' as const },
  { label: 'High', value: 'high' as const },
];

const DECISION_TEMPLATES = [
  '请帮我判断：是否应该推进这个方案？给出明确建议。',
  '这份资料里最大的风险是什么？是否值得投资？',
  '从各方利益角度看，这个决策的可行性如何？',
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

export default function HomePage() {
  const navigate = useNavigate();

  // Shared stores
  const agents = useAgentStore((s) => s.agents);
  const customAgents = useAgentStore((s) => s.customAgents);
  const selectedIds = useAgentStore((s) => s.selectedIds);
  const toggleAgent = useAgentStore((s) => s.toggleAgent);
  const addCustomAgent = useAgentStore((s) => s.addCustomAgent);
  const startSimulation = useSimulationStore((s) => s.startSimulation);
  const startAdvisory = useAdvisoryStore((s) => s.startAdvisory);

  const [mode, setMode] = useState<Mode>('policy');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const allAgents = useMemo(() => [...agents, ...customAgents], [agents, customAgents]);

  // Policy-mode state
  const [policyText, setPolicyText] = useState('');
  const [policyTypes, setPolicyTypes] = useState<PolicyType[]>([]);
  const [rounds, setRounds] = useState(4);
  const [concurrency, setConcurrency] = useState<'low' | 'medium' | 'high'>('medium');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [consensusRuns, setConsensusRuns] = useState(1);

  // Decision-mode state
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [taskQuestion, setTaskQuestion] = useState('');
  const [taskOptionsText, setTaskOptionsText] = useState('');
  const [taskContext, setTaskContext] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedCount = selectedIds.length;
  const readyDocs = documents.filter((d) => d.status === 'ready');
  const parsingDocs = documents.filter((d) => d.status === 'parsing');

  const estimatedTime = useMemo(() => {
    const basePerRound = 65;
    const concurrencyMultiplier =
      concurrency === 'high' ? 0.5 : concurrency === 'medium' ? 0.75 : 1;
    const totalSeconds = Math.round(
      rounds * basePerRound * concurrencyMultiplier * (selectedCount / 8),
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [rounds, concurrency, selectedCount]);

  const togglePolicyType = (type: PolicyType) => {
    setPolicyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const applyTemplate = (index: number) => {
    const template = PRESET_POLICY_TEMPLATES[index];
    setPolicyText(`# ${template.title}\n\n${template.description}`);
    setPolicyTypes(template.types);
    setTemplateDropdownOpen(false);
  };

  const handleLaunchPolicy = () => {
    setValidationError(null);
    if (!policyText.trim()) {
      setValidationError('请先输入政策描述再启动仿真。');
      return;
    }
    if (selectedIds.length < 3) {
      setValidationError('请至少选择 3 个 Agent 来运行仿真。');
      return;
    }
    const config: SimulationConfig = {
      id: uuidv4(),
      policy: policyText,
      policyTypes,
      totalRounds: rounds,
      selectedAgentIds: [...selectedIds],
      workerConcurrency: concurrency,
      consensusRuns,
      createdAt: Date.now(),
    };
    startSimulation(config);
    navigate(`/sim/${config.id}`);
  };

  const handleLaunchDecision = () => {
    setValidationError(null);
    if (!taskQuestion.trim()) {
      setValidationError('请先填写决策任务 / 问题。');
      return;
    }
    if (selectedIds.length < 2) {
      setValidationError('请至少选择 2 个评审角色。');
      return;
    }
    if (parsingDocs.length > 0) {
      setValidationError('文件仍在解析中，请稍候再启动。');
      return;
    }
    if (readyDocs.length === 0) {
      setValidationError('请至少上传一份可成功解析的文件（或先用纯文本试试）。');
      return;
    }

    const options = taskOptionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const config: AdvisoryConfig = {
      id: uuidv4(),
      task: {
        question: taskQuestion.trim(),
        options,
        context: taskContext.trim(),
      },
      documents: readyDocs,
      roleIds: [...selectedIds],
      createdAt: Date.now(),
    };
    startAdvisory(config);
    navigate(`/advisory/${config.id}`);
  };

  const handleLaunch = mode === 'policy' ? handleLaunchPolicy : handleLaunchDecision;

  return (
    <div className="min-h-screen bg-surface p-6 lg:p-10">
      {/* Page Title + Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mesh-panel grain rounded-2xl border border-white/5 p-7 lg:p-9 mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="relative z-[1]">
          <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-on-surface-variant mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Multi-Agent Intelligence
          </span>
          <h1 className="font-headline font-bold leading-[0.95] tracking-tight text-[clamp(2.25rem,5vw,3.75rem)]">
            <span className="text-voltage">
              {mode === 'policy' ? 'Policy Arena' : 'Decision Brief'}
            </span>
          </h1>
          <p className="mt-3 text-on-surface-variant font-body text-base max-w-2xl">
            {mode === 'policy'
              ? '定义政策场景、选择参与的 Agent、配置参数，开始多智能体博弈推演。'
              : '上传文件、写下你的决策问题，让不同立场的角色分别阅读后，汇总成一份帮你拍板的统一建议。'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="relative z-[1] flex gap-1 rounded-xl bg-surface-container-lowest/70 backdrop-blur p-1 shrink-0 ring-1 ring-white/5">
          {(
            [
              ['policy', '🏛️ 政策博弈'],
              ['decision', '🧭 文件决策'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setMode(key);
                setValidationError(null);
              }}
              className="relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {mode === key && (
                <motion.span
                  layoutId="home-mode-pill"
                  className="absolute inset-0 rounded-lg glow-primary"
                  style={{ background: 'var(--grad-voltage)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-[1] ${mode === key ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main Content: two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Policy OR Decision setup (3 cols) */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-3"
        >
          {mode === 'policy' ? (
            <div className="bg-surface-container rounded-lg p-6">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <h2 className="font-headline text-xl font-semibold text-on-surface">
                    Policy Definition
                  </h2>
                </div>

                {/* Quick Templates Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-container-highest transition-colors cursor-pointer"
                  >
                    <span>⚡</span>
                    Quick Templates
                    <span className="text-xs">{templateDropdownOpen ? '▲' : '▼'}</span>
                  </button>

                  {templateDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-surface-container-highest rounded-lg shadow-xl z-20 overflow-hidden"
                    >
                      {PRESET_POLICY_TEMPLATES.map((tpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => applyTemplate(idx)}
                          className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors cursor-pointer"
                        >
                          <div className="text-sm font-medium text-on-surface">{tpl.title}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
                            {tpl.description}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                placeholder="Enter policy markdown here... e.g. # 2030 Global Ban on Internal Combustion Engines"
                className="w-full min-h-[200px] bg-surface-container-low rounded-md p-4 text-on-surface font-mono text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y border-none"
              />

              {/* Bottom info row */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs font-mono text-on-surface-variant tracking-wider">
                  MARKDOWN SUPPORTED
                </span>
                <span className="text-xs font-mono text-on-surface-variant">
                  {policyText.length} chars
                </span>
              </div>

              {/* Policy Type Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {POLICY_TYPE_OPTIONS.map((opt) => {
                  const active = policyTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => togglePolicyType(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-surface-container rounded-lg p-6 space-y-5">
              {/* Files */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📂</span>
                  <h2 className="font-headline text-xl font-semibold text-on-surface">
                    资料文件
                  </h2>
                  {readyDocs.length > 0 && (
                    <span className="text-xs text-primary font-medium">
                      {readyDocs.length} 份就绪
                    </span>
                  )}
                </div>
                <FileDropzone documents={documents} setDocuments={setDocuments} />
              </div>

              {/* Decision task */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-headline text-sm font-semibold text-on-surface">
                    决策任务 / 问题
                  </label>
                  <div className="flex gap-1">
                    {DECISION_TEMPLATES.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => setTaskQuestion(t)}
                        title={t}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      >
                        示例{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={taskQuestion}
                  onChange={(e) => setTaskQuestion(e.target.value)}
                  placeholder="例：我们要不要收购这家公司？请基于这份尽调报告给出建议。"
                  className="w-full min-h-[80px] bg-surface-container-low rounded-md p-3 text-on-surface font-body text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y border-none"
                />
              </div>

              {/* Options + context (collapsible-ish, always shown but optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                    候选方案（可选，每行一个）
                  </label>
                  <textarea
                    value={taskOptionsText}
                    onChange={(e) => setTaskOptionsText(e.target.value)}
                    placeholder={'方案A：立即推进\n方案B：暂缓观望\n方案C：小范围试点'}
                    className="w-full min-h-[72px] bg-surface-container-low rounded-md p-3 text-on-surface font-body text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y border-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                    补充背景（可选）
                  </label>
                  <textarea
                    value={taskContext}
                    onChange={(e) => setTaskContext(e.target.value)}
                    placeholder="例：预算上限 500 万，需在 Q3 前决策。"
                    className="w-full min-h-[72px] bg-surface-container-low rounded-md p-3 text-on-surface font-body text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y border-none"
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Right: Active Agents / Reviewers (2 cols) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-xl font-semibold text-on-surface">
              {mode === 'policy' ? 'Active Agents' : '评审角色'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold tracking-wider">
              {selectedCount} {mode === 'policy' ? 'AGENTS LOADED' : '角色'}
            </span>
          </div>

          <motion.div
            className="grid grid-cols-2 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* AI Create Agent button */}
            <motion.div
              variants={cardVariants}
              role="button"
              tabIndex={0}
              onClick={() => setCreatorOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCreatorOpen(true);
                }
              }}
              className="bg-surface-container border-2 border-dashed border-surface-variant rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="text-2xl mb-1">🤖</span>
              <p className="text-sm font-medium text-on-surface-variant">AI 创建角色</p>
              <p className="text-[10px] text-primary mt-1">描述场景自动生成</p>
            </motion.div>

            {allAgents.map((agent) => {
              const isSelected = selectedIds.includes(agent.id);
              const influenceDots = Math.round(agent.influence / 2);

              return (
                <motion.div
                  key={agent.id}
                  variants={cardVariants}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={agent.name}
                  tabIndex={0}
                  onClick={() => toggleAgent(agent.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleAgent(agent.id);
                    }
                  }}
                  className={`bg-surface-container rounded-lg p-4 cursor-pointer transition-colors hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    isSelected ? 'ring-2 ring-primary/40' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{agent.avatar}</span>
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-on-surface-variant/40 bg-transparent'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-2.5 h-2.5 text-on-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-on-surface mt-2 leading-tight">
                    {agent.name}
                  </p>

                  <div className="flex gap-1 mt-2">
                    {Array.from({ length: influenceDots }).map((_, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Bottom: parameters + launch */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
        className="mt-8 bg-surface-container rounded-lg p-6"
      >
        {mode === 'policy' ? (
          <>
            <h2 className="font-headline text-xl font-semibold text-on-surface mb-5">
              Simulation Parameters
            </h2>

            <div className="flex flex-col lg:flex-row lg:items-end gap-6">
              {/* Simulation Rounds */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-on-surface-variant">
                    Simulation Rounds
                  </label>
                  <span className="text-xs font-bold text-primary tracking-wider">
                    {rounds} ROUNDS
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                  <span>1</span>
                  <span>8</span>
                </div>
              </div>

              {/* Web Worker Concurrency */}
              <div className="flex-1">
                <label className="text-sm font-medium text-on-surface-variant mb-2 block">
                  Web Worker Concurrency
                </label>
                <div className="flex gap-1 bg-surface-container-highest rounded-lg p-1">
                  {CONCURRENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setConcurrency(opt.value)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                        concurrency === opt.value
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consensus Mode */}
              <div className="flex-1">
                <label className="text-sm font-medium text-on-surface-variant mb-2 block">
                  Consensus Mode
                </label>
                <div className="flex gap-1 bg-surface-container-highest rounded-lg p-1">
                  {[
                    { label: 'Single', value: 1 },
                    { label: '×3', value: 3 },
                    { label: '×5', value: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setConsensusRuns(opt.value)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                        consensusRuns === opt.value
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {consensusRuns > 1
                    ? `Run ${consensusRuns} times, show consistency scores`
                    : 'Standard single run'}
                </p>
              </div>

              {/* Launch */}
              <div className="flex flex-col items-center lg:items-end gap-2">
                <button
                  onClick={handleLaunch}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary via-secondary to-tertiary text-on-primary font-bold text-base tracking-wide glow-primary hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>🚀</span>
                  LAUNCH SIMULATION
                </button>
                <span className="text-xs font-mono text-on-surface-variant">
                  EST. EXECUTION TIME: ~{estimatedTime}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-headline font-bold text-on-surface">
                  {readyDocs.length}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  份文件就绪
                </p>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div>
                <p className="text-2xl font-headline font-bold text-on-surface">{selectedCount}</p>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  个评审角色
                </p>
              </div>
              {parsingDocs.length > 0 && (
                <span className="text-xs text-primary animate-pulse">
                  {parsingDocs.length} 份文件解析中…
                </span>
              )}
            </div>

            <button
              onClick={handleLaunch}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary via-secondary to-tertiary text-on-primary font-bold text-base tracking-wide glow-primary hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 justify-center"
            >
              <span>🧭</span>
              启动决策评审
            </button>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-red-400 font-medium"
          >
            {validationError}
          </motion.p>
        )}
      </motion.div>

      {/* AI Agent Creator Modal */}
      <AIAgentCreator
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onAgentsCreated={(newAgents) => {
          newAgents.forEach((a) => addCustomAgent(a));
          setCreatorOpen(false);
        }}
      />
    </div>
  );
}
