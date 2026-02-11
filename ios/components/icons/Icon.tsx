/**
 * Thin Lucide icon wrapper with app-level defaults
 */

import { LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({
  icon: IconComponent,
  size = 24,
  color = colors.text,
  strokeWidth = 1.75,
}: IconProps) {
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
