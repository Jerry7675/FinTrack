import type { ComponentProps } from 'react';

/** Ionicons glyph names used by category icons. */
export type IconName = ComponentProps<
  typeof import('@expo/vector-icons').Ionicons
>['name'];

export const CATEGORY_ICONS: { key: string; icon: IconName; label: string }[] =
  [
    { key: 'food', icon: 'restaurant-outline', label: 'Food' },
    { key: 'transport', icon: 'car-outline', label: 'Transport' },
    { key: 'shopping', icon: 'bag-handle-outline', label: 'Shopping' },
    { key: 'home', icon: 'home-outline', label: 'Home' },
    { key: 'health', icon: 'medkit-outline', label: 'Health' },
    { key: 'entertainment', icon: 'film-outline', label: 'Fun' },
    { key: 'bills', icon: 'flash-outline', label: 'Bills' },
    { key: 'education', icon: 'school-outline', label: 'Education' },
    { key: 'travel', icon: 'airplane-outline', label: 'Travel' },
    { key: 'salary', icon: 'cash-outline', label: 'Salary' },
    { key: 'freelance', icon: 'laptop-outline', label: 'Freelance' },
    { key: 'investment', icon: 'trending-up-outline', label: 'Invest' },
    { key: 'gift', icon: 'gift-outline', label: 'Gift' },
    { key: 'transfer', icon: 'swap-horizontal-outline', label: 'Transfer' },
    { key: 'business', icon: 'business-outline', label: 'Business' },
    { key: 'saas', icon: 'cloud-outline', label: 'SaaS' },
    { key: 'cloud', icon: 'server-outline', label: 'Cloud' },
    { key: 'hardware', icon: 'hardware-chip-outline', label: 'Hardware' },
    { key: 'internet', icon: 'wifi-outline', label: 'Internet' },
    { key: 'office', icon: 'print-outline', label: 'Office' },
    { key: 'contractor', icon: 'people-outline', label: 'Contractor' },
    { key: 'marketing', icon: 'megaphone-outline', label: 'Marketing' },
    { key: 'training', icon: 'ribbon-outline', label: 'Training' },
    { key: 'domains', icon: 'globe-outline', label: 'Domains' },
    { key: 'other', icon: 'ellipse-outline', label: 'Other' },
  ];

export function resolveCategoryIcon(iconKey: string): IconName {
  return (
    CATEGORY_ICONS.find((i) => i.key === iconKey)?.icon ?? 'ellipse-outline'
  );
}

export const DEFAULT_CATEGORIES: {
  name: string;
  kind: 'expense' | 'income';
  iconKey: string;
  color: string;
}[] = [
  { name: 'Food & Drink', kind: 'expense', iconKey: 'food', color: '#E07A3D' },
  {
    name: 'Transport',
    kind: 'expense',
    iconKey: 'transport',
    color: '#3D7AE0',
  },
  { name: 'Shopping', kind: 'expense', iconKey: 'shopping', color: '#9B5DE5' },
  { name: 'Housing', kind: 'expense', iconKey: 'home', color: '#2A9D8F' },
  { name: 'Health', kind: 'expense', iconKey: 'health', color: '#E63946' },
  {
    name: 'Entertainment',
    kind: 'expense',
    iconKey: 'entertainment',
    color: '#F4A261',
  },
  { name: 'Bills', kind: 'expense', iconKey: 'bills', color: '#457B9D' },
  {
    name: 'Education',
    kind: 'expense',
    iconKey: 'education',
    color: '#6A4C93',
  },
  { name: 'Travel', kind: 'expense', iconKey: 'travel', color: '#00B4D8' },
  {
    name: 'Software & SaaS',
    kind: 'expense',
    iconKey: 'saas',
    color: '#6366F1',
  },
  {
    name: 'Cloud & Hosting',
    kind: 'expense',
    iconKey: 'cloud',
    color: '#0EA5E9',
  },
  {
    name: 'Hardware',
    kind: 'expense',
    iconKey: 'hardware',
    color: '#64748B',
  },
  {
    name: 'Internet & Phone',
    kind: 'expense',
    iconKey: 'internet',
    color: '#14B8A6',
  },
  {
    name: 'Office Supplies',
    kind: 'expense',
    iconKey: 'office',
    color: '#A78BFA',
  },
  {
    name: 'Contractors',
    kind: 'expense',
    iconKey: 'contractor',
    color: '#F59E0B',
  },
  {
    name: 'Marketing',
    kind: 'expense',
    iconKey: 'marketing',
    color: '#EC4899',
  },
  {
    name: 'Training & Certs',
    kind: 'expense',
    iconKey: 'training',
    color: '#8B5CF6',
  },
  {
    name: 'Domains & Tools',
    kind: 'expense',
    iconKey: 'domains',
    color: '#22C55E',
  },
  { name: 'Other', kind: 'expense', iconKey: 'other', color: '#6B7280' },
  { name: 'Salary', kind: 'income', iconKey: 'salary', color: '#1A7A4C' },
  { name: 'Freelance', kind: 'income', iconKey: 'freelance', color: '#2A9D8F' },
  {
    name: 'Investment',
    kind: 'income',
    iconKey: 'investment',
    color: '#3DDB8A',
  },
  { name: 'Gift', kind: 'income', iconKey: 'gift', color: '#E07A3D' },
  { name: 'Other income', kind: 'income', iconKey: 'other', color: '#5C6B64' },
];
