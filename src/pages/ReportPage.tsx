import { motion } from 'framer-motion';
import { useSimulationStore } from '../stores';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// Mock data
const mockTurningPoints = [
  {
    round: 3,
    timestamp: '00:12:34',
    title: 'NGO-Scientist Alliance Formed',
    description:
      'Environmental organizations and scientific experts formed a strategic alliance, combining empirical data with grassroots mobilization to shift public discourse toward evidence-based policy support.',
  },
  {
    round: 5,
    timestamp: '00:24:17',
    title: 'Lobbyist Counter-Campaign',
    description:
      'Corporate lobbyists launched a coordinated counter-campaign leveraging media channels and economic impact reports to challenge the proposed regulatory framework.',
  },
  {
    round: 8,
    timestamp: '00:41:02',
    title: 'Final Legislative Vote',
    description:
      'The legislative body conducted the final vote with a narrow margin of 65-35 in favor, influenced by last-minute concessions to moderate stakeholders.',
  },
];

const mockAgentPerformance = [
  { group: 'Lobbyists', successRate: 70, influenceDelta: '+12.4', color: 'bg-green-500' },
  { group: 'Activists', successRate: 43, influenceDelta: '-3.8', color: 'bg-red-500' },
  { group: 'Scientists', successRate: 72, influenceDelta: '+8.1', color: 'bg-orange-500' },
];

const mockExploits = [
  {
    id: 'EXPLOIT-01',
    title: 'Recursive Budget Loophole',
    description:
      'Agents discovered that repeated budget reallocation requests within the same legislative session could compound allocated funds beyond intended limits, effectively doubling their resource pool.',
  },
  {
    id: 'EXPLOIT-02',
    title: 'Article 14 Temporal Lag',
    description:
      'A timing vulnerability in Article 14 allows policy amendments to take effect before the review period expires, enabling agents to lock in favorable terms before opposition can respond.',
  },
  {
    id: 'EXPLOIT-03',
    title: 'Semantic Ambiguity Bridge',
    description:
      'Ambiguous language in the policy framework\'s definition of "stakeholder impact" was exploited to reclassify indirect effects as direct benefits, inflating impact scores.',
  },
];

export default function ReportPage() {
  const { rounds, config } = useSimulationStore();
  const hasData = rounds.length > 0;

  // Use real data if available, otherwise mock
  const stakeholderScore = hasData
    ? (
        rounds.reduce(
          (sum, r) => sum + r.responses.reduce((s, resp) => s + Math.max(0, resp.impactScore), 0),
          0,
        ) / Math.max(1, rounds.length)
      ).toFixed(1)
    : '94.2';

  const policyName = config?.policy ?? 'Carbon Emission Reduction Act - Amendment 7B';

  return (
    <motion.div
      className="max-w-6xl mx-auto px-6 py-10 space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={sectionVariants} className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-1">
            PolicySim Report
          </p>
          <h1 className="text-3xl font-headline text-on-surface font-bold">
            Simulation Final Analysis
          </h1>
        </div>
        <div className="flex gap-3">
          {['EXPORT TO MARKDOWN', 'PDF', 'REPLAY SIMULATION'].map((label) => (
            <button
              key={label}
              className="px-4 py-2 text-xs font-mono tracking-wider rounded-md bg-surface-container-high text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Policy Summary Conclusion */}
      <motion.section variants={sectionVariants} className="bg-surface-container rounded-lg p-6">
        <h2 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-5">
          Policy Summary Conclusion
        </h2>
        <div className="grid grid-cols-2 gap-8">
          {/* Left: conclusion text */}
          <div className="space-y-4">
            <blockquote className="border-l-2 border-primary pl-4 text-on-surface font-body leading-relaxed">
              &ldquo;The simulation reveals that the{' '}
              <span className="text-secondary font-semibold">coalition dynamics</span> between
              environmental advocates and scientific experts were the{' '}
              <span className="text-primary font-semibold">primary catalyst</span> for policy
              adoption. Corporate opposition, while well-funded, failed to counter the{' '}
              <span className="text-secondary font-semibold">evidence-based narrative</span> that
              dominated public discourse in later rounds.&rdquo;
            </blockquote>
            <div className="flex gap-6 pt-2">
              <div className="bg-surface-container-low rounded-md px-4 py-3">
                <p className="text-[10px] font-mono text-on-surface-variant tracking-widest uppercase">
                  Stakeholder Score
                </p>
                <p className="text-2xl font-headline text-primary font-bold">{stakeholderScore}%</p>
              </div>
              <div className="bg-surface-container-low rounded-md px-4 py-3">
                <p className="text-[10px] font-mono text-on-surface-variant tracking-widest uppercase">
                  Entropy Level
                </p>
                <p className="text-2xl font-headline text-tertiary font-bold">Low</p>
              </div>
            </div>
          </div>

          {/* Right: donut chart placeholder */}
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 rounded-full border-[14px] border-primary opacity-80" />
              <div
                className="absolute inset-0 rounded-full border-[14px] border-surface-variant"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 50% 50%)',
                  opacity: 0.3,
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-headline font-bold text-primary">65%</span>
                <span className="text-xs font-mono text-on-surface-variant tracking-wider uppercase">
                  Support
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Key Turning Points */}
      <motion.section variants={sectionVariants} className="bg-surface-container rounded-lg p-6">
        <h2 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-5">
          Key Turning Points
        </h2>
        <div className="relative pl-8 space-y-6">
          {/* Timeline line */}
          <div className="absolute left-3 top-1 bottom-1 w-px bg-surface-variant" />

          {mockTurningPoints.map((point, i) => (
            <motion.div
              key={point.round}
              className="relative"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
            >
              {/* Dot */}
              <div className="absolute -left-8 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface-container" />
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-mono bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">
                  Round {point.round}
                </span>
                <span className="text-xs font-mono text-on-surface-variant">{point.timestamp}</span>
              </div>
              <h3 className="text-on-surface font-semibold mb-1">{point.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{point.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* SubAgent Performance */}
      <motion.section variants={sectionVariants} className="bg-surface-container rounded-lg p-6">
        <h2 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase mb-5">
          SubAgent Performance
        </h2>
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-mono text-on-surface-variant tracking-widest uppercase">
              <th className="pb-3 pr-4">Agent Group</th>
              <th className="pb-3 pr-4">Success Rate</th>
              <th className="pb-3">Influence Delta</th>
            </tr>
          </thead>
          <tbody>
            {mockAgentPerformance.map((agent) => (
              <tr key={agent.group} className="border-t border-surface-variant/30">
                <td className="py-3 pr-4 text-on-surface font-medium">{agent.group}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-surface-container-low rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className={`h-full rounded-full ${agent.color}`}
                        style={{ width: `${agent.successRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-on-surface-variant w-10 text-right">
                      {agent.successRate}%
                    </span>
                  </div>
                </td>
                <td className="py-3 text-sm font-mono text-on-surface">{agent.influenceDelta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.section>

      {/* Identified Rule Exploitations */}
      <motion.section variants={sectionVariants} className="bg-surface-container rounded-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-mono text-on-surface-variant tracking-widest uppercase">
            Identified Rule Exploitations
          </h2>
          <span className="text-[10px] font-mono tracking-widest uppercase bg-error/15 text-error px-3 py-1 rounded-full">
            {mockExploits.length} Vulnerabilities Found
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {mockExploits.map((exploit, i) => (
            <motion.div
              key={exploit.id}
              className="bg-surface-container-low rounded-lg p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
            >
              <span className="text-[10px] font-mono text-primary tracking-widest">{exploit.id}</span>
              <h3 className="text-on-surface font-semibold mt-1 mb-2">{exploit.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{exploit.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <motion.div
        variants={sectionVariants}
        className="text-center text-xs font-mono text-on-surface-variant py-4"
      >
        PolicySim v1.0 &mdash; {policyName}
      </motion.div>
    </motion.div>
  );
}
