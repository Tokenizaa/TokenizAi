/**
 * @nettoscorp/ui-primitives — base UI primitives para NettosCorp Enterprise (TokenizAi).
 *
 * Construído sobre Radix UI (acesso/WCAG 2.1 AA) e Tailwind CSS 4.
 * Nenhum breaking change para o pacote @nettoscorp/tokenizai: este pacote é
 * aditivo e só é consumido quando importado explicitamente.
 *
 * Exporta: Button, Dialog, Dropdown + tipos TypeScript de cada componente.
 */

export { Button, buttonVariants } from './components/button/Button';
export type { ButtonProps } from './components/button/Button';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from './components/dialog/Dialog';
export type {
  DialogContentProps,
  DialogTitleProps,
  DialogDescriptionProps,
} from './components/dialog/Dialog';

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
} from './components/dropdown/Dropdown';
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
} from './components/dropdown/Dropdown';

export { cn } from './utils/cn';
