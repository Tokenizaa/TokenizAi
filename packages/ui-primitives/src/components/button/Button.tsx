import * as React from 'react';
import * as Slot from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

/**
 * Button base do @nettoscorp/ui-primitives.
 *
 * Acessibilidade (WCAG 2.1 AA):
 * - Elemento nativo <button> → Enter/Space disparam ação, foco nativo.
 * - aria-disabled refletido quando desabilitado.
 * - focus-visible via classes do Tailwind (anel de foco 2px no consumidor).
 * - Alvo de toque mínimo 44px (tamanho md/lg) — mobile-first.
 * - Suporte a asChild (via Radix Slot) para links/routers sem quebrar semântica.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg border border-line font-display text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--nc-accent)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-accent-ink hover:bg-accent-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]',
        outline: 'border border-line bg-surface hover:bg-surface-subtle text-ink',
        ghost: 'bg-transparent hover:bg-surface-subtle text-ink',
        danger: 'border border-red-200/60 bg-red-50 text-red-900 hover:bg-red-100',
      },
      size: {
        sm: 'h-9 min-h-[40px] px-3 text-xs',
        md: 'h-11 min-h-[44px] px-4 text-base',
        lg: 'h-12 min-h-[44px] px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza o filho (ex.: <a>, <Link>) em vez de um <button>, mantendo props de botão. */
  asChild?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, type = 'button', children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const ownProps = asChild ? { asChild } : { disabled, type };

    return (
      <Comp
        {...ownProps}
        aria-disabled={disabled || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

Button.displayName = 'Button';

export { buttonVariants, Button };
