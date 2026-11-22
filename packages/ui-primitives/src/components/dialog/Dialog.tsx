import * as React from 'react';
import * as DialogPrim from '@radix-ui/react-dialog';
import { cn } from '@/utils/cn';

/**
 * Dialog (modal) acessível construído sobre @radix-ui/react-dialog.
 *
 * Acessibilidade (WCAG 2.1 AA):
 * - role="dialog" + aria-modal="true" no painel.
 * - aria-labelledby/aria-describedby atrelados ao título e descrição.
 * - Armadilha de foco, fechamento com ESC, clique no overlay e retorno de foco — gerenciados pelo Radix.
 * - Botão de fechar com aria-label localizado ("×" com label acessível).
 * - Mobile-first: largura cheia com p-4 em telas pequenas; max-w-lg + p-6 a partir de sm.
 */
const Dialog = DialogPrim.Root;
const DialogTrigger = DialogPrim.Trigger;

const DialogPortal = DialogPrim.Portal;

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogPrim.DialogOverlayProps>(
  ({ className, ...props }, ref) => (
    <DialogPrim.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm', className)} {...props} />
  ),
);
DialogOverlay.displayName = 'DialogOverlay';

interface DialogContentProps
  extends Omit<DialogPrim.DialogContentProps, 'aria-labelledby' | 'aria-describedby'> {
  className?: string;
  children?: React.ReactNode;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const titleId = React.useId();
    const descId = React.useId();

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrim.Content
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-surface p-4 shadow-2xl',
            'sm:p-6 sm:rounded-lg sm:border',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrim.Close
            className="absolute right-2 top-2 ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-ink-muted opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-none focus-visible:outline-none"
            aria-label="Fechar diálogo"
          >
            ×
          </DialogPrim.Close>
        </DialogPrim.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = 'DialogContent';

const DialogClose = DialogPrim.Close;
DialogClose.displayName = 'DialogClose';

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  children?: React.ReactNode;
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => (
    <DialogPrim.Title ref={ref} className={cn('text-lg font-semibold text-ink', className)} {...props}>
      {children}
    </DialogPrim.Title>
  ),
);
DialogTitle.displayName = 'DialogTitle';

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  children?: React.ReactNode;
}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <DialogPrim.Description ref={ref} className={cn('text-sm text-ink-muted', className)} {...props}>
      {children}
    </DialogPrim.Description>
  ),
);
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
};
export type { DialogContentProps, DialogTitleProps, DialogDescriptionProps };
