import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/utils/cn';

/**
 * Dropdown menu acessível construído sobre @radix-ui/react-dropdown-menu.
 *
 * Acessibilidade (WCAG 2.1 AA):
 * - role="menu" no painel; aria-haspopup/aria-expanded no gatilho (gerenciados pelo Radix).
 * - Navegação por teclado: setas, Home/End, busca por letra (typeahead) e ESC para fechar — gerenciados pelo Radix.
 * - Itens desabilitados com aria-disabled e sem foco/clique.
 * - Mobile-first: alvos de toque ≥44px (py-1.5 px-4, texto base), posicionamento popper com desbordagem segura.
 * - Submenus via Dropdown.Sub (setas direita/esquerda abrem/fecham em teclado).
 */
const Dropdown = DropdownMenu.Root;
const DropdownTrigger = DropdownMenu.Trigger;
const DropdownPortal = DropdownMenu.Portal;

interface DropdownContentProps extends Omit<DropdownMenu.ContentProps, 'align'> {
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ className, align = 'start', sideOffset = 4, children, ...props }, ref) => (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'fixed z-50 w-auto popover-overrides border border-line bg-surface p-1 text-ink shadow-xl outline-none',
          'min-w-[220px]',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  ),
);
DropdownContent.displayName = 'DropdownContent';

interface DropdownItemProps extends DropdownMenu.ItemProps {
  className?: string;
  children?: React.ReactNode;
}

const DropdownItem = React.forwardRef<HTMLDivElement, DropdownItemProps>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenu.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-s gap-2 py-1.5 px-4 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'hover:bg-accent-soft data-[state=open]:bg-accent-soft',
        className,
      )}
      {...props}
    >
      {children}
    </DropdownMenu.Item>
  ),
);
DropdownItem.displayName = 'DropdownItem';

interface DropdownCheckboxItemProps extends DropdownMenu.CheckboxItemProps {
  className?: string;
  children?: React.ReactNode;
}

const DropdownCheckboxItem = React.forwardRef<HTMLDivElement, DropdownCheckboxItemProps>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenu.CheckboxItem
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-s gap-2 py-1.5 px-4 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'hover:bg-accent-soft data-[state=open]:bg-accent-soft',
        className,
      )}
      {...props}
    >
      {children}
      <DropdownMenu.ItemIndicator className="ml-auto flex h-3.5 w-3.5 items-center justify-center" />
    </DropdownMenu.CheckboxItem>
  ),
);
DropdownCheckboxItem.displayName = 'DropdownCheckboxItem';

interface DropdownRadioItemProps extends DropdownMenu.RadioItemProps {
  className?: string;
  children?: React.ReactNode;
}

const DropdownRadioItem = React.forwardRef<HTMLDivElement, DropdownRadioItemProps>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenu.RadioItem
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-s gap-2 py-1.5 px-4 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'hover:bg-accent-soft data-[state=open]:bg-accent-soft',
        className,
      )}
      {...props}
    >
      {children}
      <DropdownMenu.ItemIndicator className="ml-auto flex h-3.5 w-3.5 items-center justify-center" />
    </DropdownMenu.RadioItem>
  ),
);
DropdownRadioItem.displayName = 'DropdownRadioItem';

interface DropdownGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
}

const DropdownGroup = React.forwardRef<HTMLDivElement, DropdownGroupProps>(({ className, children, ...props }, ref) => (
  <DropdownMenu.Group ref={ref} className={cn('grid w-full gap-1', className)} {...props}>
    {children}
  </DropdownMenu.Group>
));
DropdownGroup.displayName = 'DropdownGroup';

interface DropdownLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  children?: React.ReactNode;
}

const DropdownLabel = React.forwardRef<HTMLSpanElement, DropdownLabelProps>(({ className, children, ...props }, ref) => (
  <DropdownMenu.Label
    ref={ref}
    className={cn('flex items-center px-4 py-1.5 text-xs font-semibold text-ink-subtle', className)}
    {...props}
  >
    {children}
  </DropdownMenu.Label>
));
DropdownLabel.displayName = 'DropdownLabel';

const DropdownSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <DropdownMenu.Separator ref={ref} className={cn('-mx-1 h-px bg-border my-1', className)} {...props} />
  ),
);
DropdownSeparator.displayName = 'DropdownSeparator';

interface DropdownShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  children?: React.ReactNode;
}

const DropdownShortcut = React.forwardRef<HTMLSpanElement, DropdownShortcutProps>(({ className, children, ...props }, ref) => (
  <DropdownMenu.Shortcut
    ref={ref}
    className={cn('ml-auto text-xs text-ink-muted', className)}
    {...props}
  >
    {children}
  </DropdownMenu.Shortcut>
));
DropdownShortcut.displayName = 'DropdownShortcut';

const DropdownSub = DropdownMenu.Sub;
const DropdownSubTrigger = React.forwardRef<
  HTMLDivElement,
  DropdownMenu.SubTriggerProps & { className?: string; children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <DropdownMenu.SubTrigger
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-s gap-2 py-1.5 px-4 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'hover:bg-accent-soft data-[state=open]:bg-accent-soft',
      className,
    )}
    {...props}
  >
    {children}
    <DropdownMenu.SubIndicator className="ml-auto flex h-3.5 w-3.5 items-center justify-center" />
  </DropdownMenu.SubTrigger>
));
DropdownSubTrigger.displayName = 'DropdownSubTrigger';

const DropdownSubContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenu.SubContentProps & { className?: string }
>(({ className, ...props }, ref) => (
  <DropdownMenu.SubContent
    ref={ref}
    className={cn(
      'fixed z-50 w-auto popover-overrides border border-line bg-surface p-1 text-ink shadow-xl outline-none',
      'min-w-[220px]',
      className,
    )}
    {...props}
  />
));
DropdownSubContent.displayName = 'DropdownSubContent';

export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownCheckboxItem,
  DropdownRadioItem,
  DropdownGroup,
  DropdownLabel,
  DropdownSeparator,
  DropdownShortcut,
  DropdownSub,
  DropdownSubTrigger,
  DropdownSubContent,
  DropdownPortal,
};
export type {
  DropdownMenuProps,
  DropdownTriggerProps,
  DropdownContentProps,
  DropdownItemProps,
  DropdownCheckboxItemProps,
  DropdownRadioItemProps,
  DropdownGroupProps,
  DropdownLabelProps,
  DropdownSeparatorProps,
  DropdownShortcutProps,
  DropdownSubProps,
  DropdownSubTriggerProps,
  DropdownSubContentProps,
} from '@radix-ui/react-dropdown-menu';
