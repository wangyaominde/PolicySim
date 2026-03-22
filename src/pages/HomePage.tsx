import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import type { PolicyType, SimulationConfig } from '../types';
import { useAgentStore, useSimulationStore } from '../stores';
import { PRESET_POLICY_TEMPLATES } from '../data/presetAgents';
import AIAgentCreator from '../components/agents/AIAgentCreator';

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
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

  // Stores
  const agents = useAgentStore((s) => s.agents);
  const customAgents = useAgentStore((s) => s.customAgents);
  const selectedIds = useAgentStore((s) => s.selectedIds);
  const toggleAgent = useAgentStore((s) => s.toggleAgent);
  const addCustomAgent = useAgentStore((s) => s.addCustomAgent);
  const startSimulation = useSimulationStore((s) => s.startSimulation);

  const [creatorOpen, setCreatorOpen] = useState(false);
  const allAgents = useMemo(() => [...agents, ...customAgents], [agents, customAgents]);

  // Local state
  const [policyText, setPolicyText] = useState('');
  const [policyTypes, setPolicyTypes] = useState<PolicyType[]>([]);
  const [rounds, setRounds] = useState(4);
  const [concurrency, setConcurrency] = useState<'low' | 'medium' | 'high'>('medium');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [consensusRuns, setConsensusRuns] = useState(1);

  const selectedCount = selectedIds.length;

  const estimatedTime = useMemo(() => {
    const basePerRound = 65; // seconds per round
    const concurrencyMultiplier =
      concurrency === 'high' ? 0.5 : concurrency === 'medium' ? 0.75 : 1;
    const totalSeconds = Math.round(
      rounds * basePerRound * concurrencyMultiplier * (selectedCount / 8)
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [rounds, concurrency, selectedCount]);

  const togglePolicyType = (type: PolicyType) => {
    setPolicyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const applyTemplate = (index: number) => {
    const template = PRESET_POLICY_TEMPLATES[index];
    setPolicyText(`# ${template.title}\n\n${template.description}`);
    setPolicyTypes(template.types);
    setTemplateDropdownOpen(false);
  };

  const handleLaunch = () => {
    setValidationError(null);

    if (!policyText.trim()) {
      setValidationError('Please enter a policy description before launching.');
      return;
    }
    if (selectedIds.length < 3) {
      setValidationError('Please select at least 3 agents to run the simulation.');
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

  return (
    <div className="min-h-screen bg-surface p-6 lg:p-10">
      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="font-headline text-3xl font-bold text-on-surface">
          Initialize Policy Matrix
        </h1>
        <p className="mt-2 text-on-surface-variant font-body text-base">
          Define a policy scenario, select participating agents, and configure simulation
          parameters to begin multi-agent deliberation.
        </p>
      </motion.div>

      {/* Main Content: two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Policy Definition (3 cols) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="lg:col-span-3"
        >
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
                        <div className="text-sm font-medium text-on-surface">
                          {tpl.title}
                        </div>
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
        </motion.div>

        {/* Right: Active Agents Grid (2 cols) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-xl font-semibold text-on-surface">
              Active Agents
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold tracking-wider">
              {selectedCount} AGENTS LOADED
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
              onClick={() => setCreatorOpen(true)}
              className="bg-surface-container border-2 border-dashed border-surface-variant rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center"
            >
              <span className="text-2xl mb-1">🤖</span>
              <p className="text-sm font-medium text-on-surface-variant">AI 创建 Agent</p>
              <p className="text-[10px] text-primary mt-1">描述场景自动生成</p>
            </motion.div>

            {allAgents.map((agent) => {
              const isSelected = selectedIds.includes(agent.id);
              const influenceDots = Math.round(agent.influence / 2);

              return (
                <motion.div
                  key={agent.id}
                  variants={cardVariants}
                  onClick={() => toggleAgent(agent.id)}
                  className={`bg-surface-container rounded-lg p-4 cursor-pointer transition-colors hover:bg-surface-container-high ${
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-on-surface mt-2 leading-tight">
                    {agent.name}
                  </p>

                  {/* Influence dots */}
                  <div className="flex gap-1 mt-2">
                    {Array.from({ length: influenceDots }).map((_, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-green-500 inline-block"
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Bottom: Simulation Parameters + Launch */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        className="mt-8 bg-surface-container rounded-lg p-6"
      >
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
              {consensusRuns > 1 ? `Run ${consensusRuns} times, show consistency scores` : 'Standard single run'}
            </p>
          </div>

          {/* Launch */}
          <div className="flex flex-col items-center lg:items-end gap-2">
            <button
              onClick={handleLaunch}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold text-base tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
            >
              <span>🚀</span>
              LAUNCH SIMULATION
            </button>
            <span className="text-xs font-mono text-on-surface-variant">
              EST. EXECUTION TIME: ~{estimatedTime}
            </span>
          </div>
        </div>

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
