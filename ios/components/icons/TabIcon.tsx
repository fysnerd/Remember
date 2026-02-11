/**
 * Tab bar icon wrapper with focused/unfocused support
 */

import { LucideIcon } from 'lucide-react-native';

interface TabIconProps {
  icon: LucideIcon;
  color: string;
  size: number;
  focused?: boolean;
}

export function TabIcon({
  icon: IconComponent,
  color,
  size,
}: TabIconProps) {
  return <IconComponent size={size} color={color} strokeWidth={1.75} />;
}
