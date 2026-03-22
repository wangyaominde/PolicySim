import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../stores';
import type { Agent } from '../types';
import AIAgentCreator from '../components/agents/AIAgentCreator';

const cardHover = {
  rest: { y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  hover: { y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', transition: { duration: 0.2 } },
};

const panelVariants = {
  hidden: { x: 40, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } },
  exit: { x: 40, opacity: 0, transition: { duration: 0.2 } },
};

// Mock subagent units for detail panel
const mockSubUnits = [
  { icon: '🤵', name: 'Lobbying Team', specialty: 'Strategic Corporate Influence' },
  { icon: '⚖️', name: 'Legal Counsel', specialty: 'Regulatory Compliance' },
  { icon: '📢', name: 'PR Team', specialty: 'Public Sentiment Bias' },
];

// Mock influence map labels
const mockMapLabels = [
  { name: 'Lobbyists', x: '22%', y: '35%' },
  { name: 'Activists', x: '65%', y: '28%' },
  { name: 'Scientists', x: '48%', y: '62%' },
  { name: 'Politicians', x: '78%', y: '55%' },
  { name: 'Media', x: '35%', y: '72%' },
];

function getStanceLabel(value: number): string {
  if (value >= 0.7) return 'HIGH';
  if (value >= 0.4) return 'MODERATE';
  return 'LOW';
}

function getSliderColor(value: number): string {
  if (value >= 0.7) return 'bg-primary';
  if (value >= 0.4) return 'bg-orange-500';
  return 'bg-surface-variant';
}

export default function AgentsPage() {
  const { agents, customAgents, addCustomAgent } = useAgentStore();
  const allAgents = useMemo(() => [...agents, ...customAgents], [agents, customAgents]);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [filter, setFilter] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const filteredAgents = useMemo(() => {
    if (!filter.trim()) return allAgents;
    const q = filter.toLowerCase();
    return allAgents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q),
    );
  }, [allAgents, filter]);

  const valueDimensions: { key: keyof Agent['values']; label: string }[] = [
    { key: 'economy', label: 'ECONOMY' },
    { key: 'stability', label: 'STABILITY' },
    { key: 'innovation', label: 'INNOVATION' },
  ];

  return (
    <div className="h-full grid grid-cols-[1fr_400px] gap-6 p-6 overflow-hidden">
      {/* LEFT SIDE */}
      <div className="flex flex-col gap-6 overflow-y-auto pr-2">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-mono tracking-widest uppercase bg-primary/15 text-primary px-3 py-1 rounded-full">
              Management Terminal
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full">
              v1.0 Stable
            </span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-headline text-on-surface font-bold">Agent Archetypes</h1>
              <p className="text-sm text-on-surface-variant mt-1">
                Configure and manage simulation agent profiles, their value systems, and sub-agent deployments.
              </p>
            </div>
            {/* Filter input */}
            <input
              type="text"
              placeholder="Filter archetypes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 text-sm bg-surface-container-high text-on-surface rounded-lg border border-surface-variant/50 placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary w-56"
            />
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Create New Agent card — opens AI Agent Creator */}
          <motion.div
            className="bg-surface-container border-2 border-dashed border-surface-variant rounded-lg p-5 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-primary/50 transition-colors"
            whileHover={{ scale: 1.01 }}
            onClick={() => setCreatorOpen(true)}
          >
            <span className="text-4xl text-on-surface-variant mb-2">+</span>
            <span className="text-sm font-mono text-on-surface-variant tracking-wider">
              AI Create Agent
            </span>
            <span className="text-xs text-primary mt-1">描述场景，AI 自动生成</span>
          </motion.div>

          {/* Agent cards */}
          {filteredAgents.map((agent, idx) => (
            <motion.div
              key={agent.id}
              className={`bg-surface-container rounded-lg p-5 cursor-pointer min-h-[180px] transition-colors ${
                selectedAgent?.id === agent.id
                  ? 'ring-2 ring-primary'
                  : 'hover:bg-surface-container-high'
              }`}
              variants={cardHover}
              initial="rest"
              whileHover="hover"
              onClick={() => setSelectedAgent(agent)}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{agent.avatar}</span>
                {idx === 0 && (
                  <span className="text-[9px] font-mono tracking-widest uppercase bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    Active Archetype
                  </span>
                )}
              </div>
              <h3 className="text-on-surface font-semibold mb-1">{agent.name}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-3">
                {agent.role.slice(0, 80)}...
              </p>
              <div className="flex gap-2">
                <span className="text-[9px] font-mono tracking-widest bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded">
                  STANCE: {getStanceLabel(agent.values.economy)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Live Influence Map */}
        <div className="mt-2">
          <h2 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-3">
            Live Influence Map
          </h2>
          <div className="relative bg-surface-container-low rounded-lg h-56 overflow-hidden">
            {/* Grid pattern background */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Map labels */}
            {mockMapLabels.map((label) => (
              <div
                key={label.name}
                className="absolute flex flex-col items-center"
                style={{ left: label.x, top: label.y }}
              >
                <div className="w-3 h-3 rounded-full bg-primary/60 mb-1" />
                <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
                  {label.name}
                </span>
              </div>
            ))}
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono text-on-surface-variant/40 tracking-widest uppercase">
                Influence Network Topology
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Detail Panel */}
      <AnimatePresence mode="wait">
        {selectedAgent ? (
          <motion.div
            key={selectedAgent.id}
            className="bg-surface-container-low rounded-lg p-6 overflow-y-auto flex flex-col gap-5"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono text-on-surface-variant tracking-widest uppercase mb-1">
                  Archetype Detail
                </p>
                <h2 className="text-xl font-headline text-on-surface font-bold">
                  Archetype: {selectedAgent.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-on-surface-variant hover:text-on-surface text-xl leading-none transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Strategy Profile */}
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase bg-secondary-container text-secondary px-3 py-1 rounded-full">
                Strategy: {selectedAgent.strategy}
              </span>
            </div>

            {/* Values & Strategy */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase">
                  Values &amp; Strategy
                </h3>
                <button
                  onClick={() => setManualOverride(!manualOverride)}
                  className={`flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase px-3 py-1 rounded-full transition-colors ${
                    manualOverride
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      manualOverride ? 'bg-white' : 'bg-on-surface-variant/40'
                    }`}
                  />
                  Manual Override
                </button>
              </div>
              <div className="space-y-4">
                {valueDimensions.map(({ key, label }) => {
                  const value = selectedAgent.values[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-on-surface-variant tracking-widest">
                          {label}
                        </span>
                        <span className="text-xs font-mono text-on-surface">
                          {(value * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${getSliderColor(value)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${value * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SubAgent Units */}
            <div>
              <h3 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-3">
                SubAgent Units
              </h3>
              <div className="space-y-2">
                {(selectedAgent.subAgentSlots.length > 0
                  ? selectedAgent.subAgentSlots.map((slot) => ({
                      icon: slot.avatar,
                      name: slot.name,
                      specialty: slot.specialty,
                    }))
                  : mockSubUnits
                ).map((unit) => (
                  <div
                    key={unit.name}
                    className="flex items-center gap-3 bg-surface-container rounded-lg px-4 py-3 hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <span className="text-xl">{unit.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface font-medium truncate">{unit.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{unit.specialty}</p>
                    </div>
                    <span className="text-on-surface-variant text-sm">&rsaquo;</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <button className="mt-auto w-full py-3 rounded-lg bg-primary text-on-surface font-mono text-sm tracking-wider font-semibold hover:opacity-90 transition-opacity bg-gradient-to-r from-primary to-primary/80">
              Save Archetype Configuration
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="bg-surface-container-low rounded-lg p-6 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-5xl mb-4 opacity-30">🧬</span>
            <p className="text-sm text-on-surface-variant font-mono">
              Select an agent archetype to view details
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
