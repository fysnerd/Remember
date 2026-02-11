/**
 * Platform source icon mapper (YouTube, Spotify, TikTok, Instagram)
 *
 * Uses generic concept icons since Lucide has no brand icons.
 */

import { Play, Headphones, Music, Camera, LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  youtube: Play,
  spotify: Headphones,
  tiktok: Music,
  instagram: Camera,
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  spotify: '#1DB954',
  tiktok: '#00F2EA',
  instagram: '#E4405F',
};

interface PlatformIconProps {
  platform: string;
  size?: number;
  color?: string;
  colored?: boolean; // Use platform brand color instead of default
}

export function PlatformIcon({
  platform,
  size = 16,
  color,
  colored = false,
}: PlatformIconProps) {
  const IconComponent = PLATFORM_ICONS[platform];
  if (!IconComponent) return null;

  const iconColor = color || (colored ? PLATFORM_COLORS[platform] : colors.textSecondary);
  return <IconComponent size={size} color={iconColor} strokeWidth={1.75} />;
}
