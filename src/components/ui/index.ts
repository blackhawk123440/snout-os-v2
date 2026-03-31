/**
 * UI Kit Components Barrel Export
 * UI Constitution V1
 * 
 * Central export for all UI kit components.
 */

// Layout Primitives
export { PageShell, type PageShellProps } from './PageShell';
export { TopBar, type TopBarProps, type BreadcrumbItem } from './TopBar';
export { SideNav, type SideNavProps, type SideNavItem } from './SideNav';
export { Section, type SectionProps } from './Section';
export { Grid, GridCol, type GridProps, type GridColProps } from './Grid';
export { Flex, type FlexProps } from './Flex';

// Surface Components
export { FrostedCard, type FrostedCardProps } from './FrostedCard';
export { Panel, type PanelProps } from './Panel';
export { StatCard, type StatCardProps } from './StatCard';

// Controls
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Input, type InputProps, type InputSize } from './Input';
export { Select, type SelectProps, type SelectOption, type SelectSize } from './Select';
export { Textarea, type TextareaProps, type TextareaSize } from './Textarea';
export { Switch, type SwitchProps } from './Switch';
export { Tabs, TabPanel, type TabsProps, type Tab, type TabPanelProps } from './Tabs';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { Tooltip, type TooltipProps } from './Tooltip';
export {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  type DropdownMenuProps,
  type DropdownMenuGroupProps,
  type DropdownMenuItemProps,
  type DropdownMenuSeparatorProps,
} from './DropdownMenu';

// Overlays
export { Modal, type ModalProps } from './Modal';
export { Drawer, type DrawerProps } from './Drawer';
export { BottomSheet, type BottomSheetProps } from './BottomSheet';
export { ToastProvider, useToast, type Toast, type ToastVariant } from './Toast';

// Data Components
export { DataRow, type DataRowProps } from './DataRow';
export { DataTable, type DataTableProps, type DataTableColumn } from './DataTable';
export { CardList, type CardListProps } from './CardList';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { TableSkeleton, CardSkeleton, PageSkeleton } from './loading-state';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { StatusChip, type StatusChipProps, type StatusChipVariant } from './status-chip';
export { ErrorState, type ErrorStateProps } from './ErrorState';

// Legacy Components (for backward compatibility)
export { Card, type CardProps } from './Card';
export { MobileFilterBar, type MobileFilterBarProps, type FilterOption } from './MobileFilterBar';
export { Table, type TableProps, type TableColumn } from './Table';
export { DataTableShell, colPriorityMd, colPriorityLg, type DataTableShellProps } from './data-table-shell';
export { PageHeader, type PageHeaderProps } from './PageHeader';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { FormRow, type FormRowProps } from './FormRow';
export { Alert, type AlertProps } from './Alert';

// Utils and Types
export * from './utils';
export * from './types';