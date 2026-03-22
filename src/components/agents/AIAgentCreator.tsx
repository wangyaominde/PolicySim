import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import type { Agent } from '../../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AIAgentCreatorProps {
  open: boolean;
  onClose: () => void;
  onAgentsCreated: (agents: Agent[]) => void;
}

/* ------------------------------------------------------------------ */
/*  AI API helper                                                      */
/* ------------------------------------------------------------------ */

async function generateAgents(
  prompt: string,
  count: number,
  apiKey: string,
  apiBaseUrl: string,
  model: string,
): Promise<Agent[]> {
  const systemPrompt = `你是一个多智能体仿真系统的角色设计师。根据用户描述的场景，生成${count}个具有不同立场、利益和策略的角色。

**最重要的原则：角色必须是高粒度的真实个体，不是泛泛的群体标签。**

错误示范：❌ "老年用户"、"年轻消费者"、"企业管理者"
正确示范：✅ "68岁退休教师/不会用智能机/子女在外地/有糖尿病"、"34岁外卖骑手/负债20万/刚结婚/住城中村"、"52岁民企老板/工厂300人/面临转型/孩子在国外读书"

请以 JSON 数组格式输出，每个角色包含：
{
  "name": "角色标签（用/分隔的多维特征，如：68岁退休教师/不会用智能机/独居/糖尿病）",
  "avatar": "一个最能代表该角色的emoji",
  "role": "角色完整画像（200-300字），必须包含：
    1. 基本信息：年龄、职业、教育、收入水平
    2. 生活处境：家庭结构、居住地、日常痛点
    3. 与该场景的直接关系：为什么这个产品/政策跟TA有关
    4. 核心诉求：TA最在意什么，TA的底线是什么
    5. 信息渠道：TA怎么获取信息，谁能影响TA的判断
    6. 隐藏动机：表面需求之下的深层心理（安全感/面子/焦虑等）",
  "values": { "economy": 0-1, "stability": 0-1, "environment": 0-1, "innovation": 0-1, "equality": 0-1 },
  "resources": ["该角色实际掌握的影响力资源，要具体，如：家族微信群200人、抖音粉丝5万、认识区卫健委的人"],
  "influence": 1-10的整数（普通个体1-3，社区意见领袖4-6，行业从业者7-8，决策者9-10）,
  "strategy": "aggressive|conservative|opportunistic|pragmatic",
  "subAgentSlots": [
    { "name": "该角色会求助/依赖的人", "avatar": "emoji", "specialty": "这个人能帮TA做什么", "autonomy": 0-1, "costPerRound": 1 }
  ]
}

要求：
- 每个角色必须是一个具体的、有血有肉的人，有年龄、有故事、有矛盾
- 角色之间要有真实的利益冲突和可能的合作空间
- 覆盖不同的社会阶层、年龄段、信息获取能力、利益诉求
- SubAgent 必须是该角色现实中会求助的人（如：儿子、同事、律师朋友、社区群主）
- name 字段用/分隔的多维标签，方便快速识别（如：28岁程序员/996/租房/近视800度）
- 只输出 JSON 数组，不要加其他文字`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (apiBaseUrl.includes('anthropic.com')) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const response = await fetch(`${apiBaseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: `场景描述：${prompt}` }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text || '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse AI response');

  const parsed = JSON.parse(jsonMatch[0]);

  return parsed.map((item: any, index: number) => ({
    id: `custom_${Date.now()}_${index}`,
    name: item.name,
    avatar: item.avatar,
    role: item.role,
    values: {
      economy: item.values?.economy ?? 0.5,
      stability: item.values?.stability ?? 0.5,
      environment: item.values?.environment ?? 0.5,
      innovation: item.values?.innovation ?? 0.5,
      equality: item.values?.equality ?? 0.5,
    },
    resources: item.resources || [],
    influence: item.influence || 5,
    strategy: item.strategy || 'pragmatic',
    allies: [],
    rivals: [],
    parentId: null,
    subAgentSlots: (item.subAgentSlots || []).map((slot: any, si: number) => ({
      slotId: `custom_slot_${Date.now()}_${index}_${si}`,
      name: slot.name,
      avatar: slot.avatar || '\uD83E\uDD16',
      specialty: slot.specialty || '',
      autonomy: slot.autonomy || 0.5,
      costPerRound: slot.costPerRound || 1,
    })),
    enabled: true,
  }));
}

/* ------------------------------------------------------------------ */
/*  Strategy label / color helpers                                     */
/* ------------------------------------------------------------------ */

const STRATEGY_META: Record<string, { label: string; color: string }> = {
  aggressive: { label: '激进', color: 'bg-red-500/20 text-red-400' },
  conservative: { label: '保守', color: 'bg-blue-500/20 text-blue-400' },
  opportunistic: { label: '投机', color: 'bg-amber-500/20 text-amber-400' },
  pragmatic: { label: '务实', color: 'bg-emerald-500/20 text-emerald-400' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type Mode = 'batch' | 'single';
type Phase = 'input' | 'loading' | 'result';

export default function AIAgentCreator({
  open,
  onClose,
  onAgentsCreated,
}: AIAgentCreatorProps) {
  const { apiKey, apiBaseUrl, model, setApiKeyModalOpen } = useUIStore();

  const [mode, setMode] = useState<Mode>('batch');
  const [phase, setPhase] = useState<Phase>('input');

  // form state
  const [prompt, setPrompt] = useState('');
  const [agentCount, setAgentCount] = useState(4);

  // result state
  const [generatedAgents, setGeneratedAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // error
  const [error, setError] = useState<string | null>(null);

  /* ---- reset when closing ---- */
  const handleClose = useCallback(() => {
    setPhase('input');
    setPrompt('');
    setAgentCount(4);
    setGeneratedAgents([]);
    setSelected(new Set());
    setError(null);
    onClose();
  }, [onClose]);

  /* ---- generate ---- */
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setError(null);
    setPhase('loading');

    try {
      const count = mode === 'batch' ? agentCount : 1;
      const agents = await generateAgents(prompt, count, apiKey, apiBaseUrl, model);
      setGeneratedAgents(agents);
      setSelected(new Set(agents.map((a) => a.id)));
      setPhase('result');
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setPhase('input');
    }
  }, [prompt, mode, agentCount, apiKey, apiBaseUrl, model]);

  /* ---- selection helpers ---- */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = () => {
    const toAdd = generatedAgents.filter((a) => selected.has(a.id));
    if (toAdd.length > 0) onAgentsCreated(toAdd);
    handleClose();
  };

  const handleAddAll = () => {
    onAgentsCreated(generatedAgents);
    handleClose();
  };

  /* ---- no API key ---- */
  const noApiKey = !apiKey;

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* glass panel */}
          <motion.div
            className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-surface-container/80 backdrop-blur-xl shadow-2xl"
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* ---- header ---- */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="font-headline text-xl font-semibold text-on-surface">
                AI Agent Generator
              </h2>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {/* ---- no api key fallback ---- */}
            {noApiKey ? (
              <div className="px-6 py-12 text-center">
                <p className="text-on-surface-variant font-body mb-4">
                  请先在 API Settings 中配置 API Key
                </p>
                <button
                  onClick={() => {
                    setApiKeyModalOpen(true);
                    handleClose();
                  }}
                  className="rounded-lg bg-primary px-5 py-2 font-body text-sm font-medium text-on-surface transition-colors hover:brightness-110"
                >
                  打开 API Settings
                </button>
              </div>
            ) : (
              <div className="px-6 pb-6">
                {/* ---- mode tabs ---- */}
                {phase === 'input' && (
                  <div className="mt-2 mb-5 flex gap-1 rounded-xl bg-surface-container-low p-1">
                    {(
                      [
                        ['batch', '一键生成多Agent'],
                        ['single', '单个创建'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setMode(key);
                          setPrompt('');
                          setError(null);
                        }}
                        className={`flex-1 rounded-lg py-2 text-sm font-body font-medium transition-colors ${
                          mode === key
                            ? 'bg-primary-container text-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* ---- INPUT PHASE ---- */}
                {phase === 'input' && mode === 'batch' && (
                  <div className="space-y-4">
                    <div>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        placeholder="描述你的场景、产品或政策，越具体越好..."
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      />
                      <p className="mt-1.5 text-xs text-on-surface-variant/60 font-body">
                        例：一款面向老年人的智能血糖监测手环，售价899元，需要连接手机App查看数据
                      </p>
                    </div>

                    {/* agent count slider */}
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-body text-on-surface-variant">
                        <span>生成数量</span>
                        <span className="font-headline font-semibold text-primary">
                          {agentCount}
                        </span>
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={8}
                        value={agentCount}
                        onChange={(e) => setAgentCount(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-on-surface-variant/40 font-body">
                        <span>2</span>
                        <span>8</span>
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 font-body">
                        {error}
                      </p>
                    )}

                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-500 py-3 font-body text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      生成 {agentCount} 个 Agent
                    </button>
                  </div>
                )}

                {phase === 'input' && mode === 'single' && (
                  <div className="space-y-4">
                    <div>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={2}
                        placeholder="描述一个具体的人，包括年龄、职业、生活处境..."
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      />
                      <p className="mt-1.5 text-xs text-on-surface-variant/60 font-body">
                        例：72岁独居老人，只会用微信语音，子女在外地，有高血压需要每天量血压
                      </p>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 font-body">
                        {error}
                      </p>
                    )}

                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-500 py-3 font-body text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      生成 Agent
                    </button>
                  </div>
                )}

                {/* ---- LOADING PHASE ---- */}
                {phase === 'loading' && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    {/* pulsing animation */}
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        className="absolute h-16 w-16 rounded-full bg-primary/30"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute h-12 w-12 rounded-full bg-primary/50"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                      <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg">
                        🤖
                      </div>
                    </div>
                    <p className="font-body text-sm text-on-surface-variant animate-pulse">
                      AI 正在分析场景并生成角色...
                    </p>
                  </div>
                )}

                {/* ---- RESULT PHASE ---- */}
                {phase === 'result' && (
                  <div className="space-y-3">
                    <p className="font-body text-sm text-on-surface-variant mb-3">
                      已生成 {generatedAgents.length} 个角色，点击选择后添加：
                    </p>

                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                      {generatedAgents.map((agent) => {
                        const isSelected = selected.has(agent.id);
                        const meta = STRATEGY_META[agent.strategy] || STRATEGY_META.pragmatic;

                        return (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={() => toggleSelect(agent.id)}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-white/5 bg-surface-container-low hover:bg-surface-container-high'
                            }`}
                          >
                            {/* checkbox */}
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-white/20 bg-transparent'
                              }`}
                            >
                              {isSelected && (
                                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                                  <path
                                    d="M2 6l3 3 5-6"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>

                            {/* avatar */}
                            <span className="text-2xl leading-none">{agent.avatar}</span>

                            {/* info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-headline text-sm font-semibold text-on-surface truncate">
                                  {agent.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="shrink-0 text-[10px] text-on-surface-variant">
                                  影响力 {agent.influence}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-on-surface-variant/70 font-body truncate">
                                {agent.role}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* action buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setPhase('input');
                          setGeneratedAgents([]);
                          setSelected(new Set());
                        }}
                        className="rounded-xl border border-white/10 bg-surface-container-low px-4 py-2.5 font-body text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      >
                        重新生成
                      </button>
                      <button
                        onClick={handleAddSelected}
                        disabled={selected.size === 0}
                        className="flex-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 font-body text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        添加选中 ({selected.size})
                      </button>
                      <button
                        onClick={handleAddAll}
                        className="rounded-xl bg-gradient-to-r from-primary to-purple-500 px-5 py-2.5 font-body text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110"
                      >
                        全部添加
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
