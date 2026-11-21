import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs';

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dims} rounded-full object-cover border border-line shrink-0`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${dims} rounded-full bg-surface-subtle border border-line flex items-center justify-center font-display font-semibold text-ink-muted shrink-0`}
    >
      {initials || 'NC'}
    </div>
  );
};
