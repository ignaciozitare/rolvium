// ─── @rolvium/ui — public API ─────────────────────────────────────────────────
// Import tokens in your app entry:
//   import '@rolvium/ui/tokens';

// ── Atoms ──────────────────────────────────────────────────────────────────────
export { Btn }                           from './components/Btn';
export type { BtnVariant, BtnSize }     from './components/Btn';

export { Avatar, Badge, StatBox, Divider, Chip } from './components/Atoms';

export { IconPicker }                    from './components/IconPicker';
export type { IconPickerProps, IconPickerLabels } from './components/IconPicker';

// ── Tooltip ───────────────────────────────────────────────────────────────────
export { Tooltip }                       from './components/Tooltip';
export type { TooltipProps, TooltipPlacement } from './components/Tooltip';

// ── Overlay ────────────────────────────────────────────────────────────────────
export { Modal, ConfirmModal }           from './components/Modal';

// ── Dialog Provider ───────────────────────────────────────────────────────────
export { DialogProvider, useDialog }     from './components/DialogProvider';

// ── Dual Panel Picker ─────────────────────────────────────────────────────────
export { DualPanelPicker }               from './components/DualPanelPicker';
export type { DualPanelItem, DualPanelPickerProps } from './components/DualPanelPicker';

// ── Date Range Picker ─────────────────────────────────────────────────────────
export { DateRangePicker }               from './components/DateRangePicker';
export type { DateRangePickerProps }     from './components/DateRangePicker';

// ── Card ──────────────────────────────────────────────────────────────────────
export { Card }                          from './components/Card';
export type { CardVariant, CardProps }   from './components/Card';

// ── MultiSelect Dropdown ──────────────────────────────────────────────────────
export { MultiSelectDropdown }           from './components/MultiSelectDropdown';
export type { MultiSelectDropdownItem, MultiSelectDropdownProps } from './components/MultiSelectDropdown';

// ── User Avatar ───────────────────────────────────────────────────────────────
export { UserAvatar, AVATAR_PRESETS, PRESET_GRADIENT_MAP, getAvatarInitials, isPresetAvatarUrl, getPresetFromAvatarUrl } from './components/UserAvatar';
export type { UserAvatarProps, UserAvatarUser, AvatarPreset } from './components/UserAvatar';

// ── Color Picker ──────────────────────────────────────────────────────────────
export { ColorPicker, COLOR_PICKER_PALETTE } from './components/ColorPicker';
export type { ColorPickerProps }         from './components/ColorPicker';

// ── Image Picker ──────────────────────────────────────────────────────────────
export { ImagePicker }                   from './components/ImagePicker';
export type { ImagePickerProps, ImagePickerShape, ImagePickerOutput, ImagePickerLabels } from './components/ImagePicker';

// ── Data Table ────────────────────────────────────────────────────────────────
export { DataTable }                     from './components/DataTable';
export type { DataTableColumn, DataTableSort } from './components/DataTable';

// ── Design-system primitives from rolvium.pen (Field, chips, layout) ──────────
export { Field }                          from './components/Field';
export type { FieldProps }                from './components/Field';
export { SystemChip, StatusChip }         from './components/Chips';
export type { StatusTone }                from './components/Chips';
export { SectionTitle, PageHeader, EmptyState, TopBar } from './components/Layout';
export type { TopBarLink }                from './components/Layout';

// ── Sheet (schema-driven character sheet, themed via --sys-* vars) ────────────
export { Sheet, Crescent, PhaseDisc }     from './components/Sheet';
export type { SheetProps, SheetLabels, SheetRef } from './components/Sheet';
