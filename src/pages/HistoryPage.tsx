import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useHistoryStore, useAdvisoryStore, useSimulationStore } from '../stores';
import type { HistoryRun } from '../stores';

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function firstLine(text: string, max = 80): string {
  const line = (text || '').replace(/^#+\s*/, '').split('\n').find((l) => l.trim()) || text || '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const runs = useHistoryStore((s) => s.runs);
  const removeRun = useHistoryStore((s) => s.removeRun);
  const clear = useHistoryStore((s) => s.clear);
  const loadAdvisory = useAdvisoryStore((s) => s.loadRun);
  const loadPolicy = useSimulationStore((s) => s.loadRun);

  const open = (run: HistoryRun) => {
    if (run.kind === 'advisory') {
      loadAdvisory(run);
      navigate(`/advisory/${run.id}`);
    } else {
      loadPolicy(run);
      navigate(`/sim/${run.id}`);
    }
  };

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <div className="text-5xl mb-4">🗂️</div>
        <h1 className="text-2xl font-headline font-bold text-on-surface mb-2">还没有历史记录</h1>
        <p className="text-on-surface-variant max-w-md mb-6">
          完成一次「政策博弈」或「文件决策评审」后，会自动保存到这里，随时可以回看与重开。
        </p>
        <button
          onClick={() => navigate('/')}
          className="glow-primary px-6 py-2.5 rounded-lg font-bold text-on-primary"
          style={{ background: 'var(--grad-voltage)' }}
        >
          新建一个
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 py-2">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-on-surface-variant mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Session Archive
          </span>
          <h1 className="font-headline font-bold text-[clamp(1.75rem,4vw,2.75rem)] leading-none text-voltage">
            历史记录
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm">{runs.length} 条记录 · 保存在本地浏览器</p>
        </div>
        <button
          onClick={() => {
            if (confirm('确定清空全部历史记录？此操作不可恢复。')) clear();
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-red-300 transition-colors"
        >
          清空全部
        </button>
      </div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        {runs.map((run) => {
          const isAdvisory = run.kind === 'advisory';
          const accent = isAdvisory ? 'text-primary bg-primary/12' : 'text-secondary bg-secondary/12';
          const meta = isAdvisory
            ? `${run.roleIds.length} 角色 · ${run.documentMeta.length} 文件`
            : `${run.rounds.length}/${run.totalRounds} 轮 · ${run.selectedAgentIds.length} Agent`;
          const result = isAdvisory
            ? run.synthesis?.decision || '（无结论）'
            : firstLine(run.policy);

          return (
            <div
              key={run.id}
              onClick={() => open(run)}
              className="group relative flex items-start gap-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors p-4 cursor-pointer ring-1 ring-white/5 hover:ring-primary/20"
            >
              {/* Kind badge */}
              <div className={`shrink-0 grid place-items-center w-11 h-11 rounded-lg text-xl ${accent}`}>
                {isAdvisory ? '🧭' : '🏛️'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${accent}`}>
                    {isAdvisory ? '文件决策' : '政策博弈'}
                  </span>
                  <span className="text-[11px] font-mono text-on-surface-variant">{formatDate(run.createdAt)}</span>
                </div>
                <h3 className="text-sm font-semibold text-on-surface truncate">{firstLine(run.title, 90)}</h3>
                <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">{result}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-mono text-on-surface-variant">{meta}</span>
                  {isAdvisory && run.synthesis && (
                    <span className="text-[10px] font-mono text-primary">
                      共识 {Math.round(run.synthesis.consensusLevel * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1 self-center">
                <span className="text-[11px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                  打开 →
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRun(run.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-highest hover:text-red-400 transition-colors"
                  aria-label="删除记录"
                >
                  <span className="text-base leading-none">&times;</span>
                </button>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
