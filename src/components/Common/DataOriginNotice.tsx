import React from 'react';
import { Info } from 'lucide-react';
import type { ModuleId } from '../../types/enterprise';

interface DataOriginNoticeProps {
  sourceLabel: string;
  pendingIntegration?: string;
  onConfigureIntegration?: (moduleId: ModuleId) => void;
}

export const DataOriginNotice: React.FC<DataOriginNoticeProps> = ({
  sourceLabel,
  pendingIntegration,
  onConfigureIntegration,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-line bg-surface/80 text-xs text-ink-muted">
      <div className="flex items-center gap-2 min-w-0">
        <Info className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="truncate">
          {sourceLabel}
          {pendingIntegration ? ` · Aguardando integração: ${pendingIntegration}` : ''}
        </span>
      </div>
      {onConfigureIntegration && (
        <button
          type="button"
          onClick={() => onConfigureIntegration('admin')}
          className="text-xs font-medium text-accent hover:text-accent-ink underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Configurar integração
        </button>
      )}
    </div>
  );
};
