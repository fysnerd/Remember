/**
 * Platform source icon mapper (YouTube, Spotify, TikTok, Instagram)
 *
 * Uses real brand icons from @expo/vector-icons
 */

import { FontAwesome5, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

type IconSet = 'fa5' | 'fa6' | 'ionicons';

interface PlatformConfig {
  iconSet: IconSet;
  iconName: string;
  color: string;
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  youtube: {
    iconSet: 'fa5',
    iconName: 'youtube',
    color: '#FF0000',
  },
  spotify: {
    iconSet: 'fa5',
    iconName: 'spotify',
    color: '#1DB954',
  },
  tiktok: {
    iconSet: 'fa6',
    iconName: 'tiktok',
    color: '#000000',
  },
  instagram: {
    iconSet: 'fa5',
    iconName: 'instagram',
    color: '#E4405F',
  },
};

interface PlatformIconProps {
  platform: string;
  size?: number;
  color?: string;
  colored?: boolean;
}

export function PlatformIcon({
  platform,
  size = 16,
  color,
  colored = false,
}: PlatformIconProps) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) return null;

  const iconColor = color || (colored ? config.color : colors.textSecondary);

  switch (config.iconSet) {
    case 'fa5':
      return <FontAwesome5 name={config.iconName} size={size} color={iconColor} />;
    case 'fa6':
      return <FontAwesome6 name={config.iconName} size={size} color={iconColor} />;
    case 'ionicons':
      return <Ionicons name={config.iconName as any} size={size} color={iconColor} />;
    default:
      return null;
  }
}
