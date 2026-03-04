/**
 * StreakFlame - Custom flame icon from Figma (node 196:110)
 * Two-layer flame with accent fill + white inner highlight
 */

import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme';

interface StreakFlameProps {
  size?: number;
  color?: string;
}

export function StreakFlame({ size = 16, color = colors.accent }: StreakFlameProps) {
  // Original viewBox: 9.908 x 14.5 → aspect ratio ~0.683
  const width = size * (9.908 / 14.5);
  const height = size;

  return (
    <Svg width={width} height={height} viewBox="0 0 9.908 14.5" fill="none">
      <Defs>
        <LinearGradient id="highlight" x1="7.86" y1="9.1" x2="2.06" y2="11.63" gradientUnits="userSpaceOnUse">
          <Stop stopColor="white" />
          <Stop offset="1" stopColor="white" />
        </LinearGradient>
      </Defs>
      {/* Main flame body */}
      <Path
        d="M3.844 0C4.239.276 4.738.543 5.099.859c.413.36.996.984 1.306 1.44.557.815.897 1.85 1.07 2.82.075.434.093.877.053 1.317.619-.447.861-.922.883-1.688.217.4.544.937.72 1.342.648 1.507 1.04 3.285.571 4.897-.117.404-.463 1.174-.744 1.504-.375.439-.945 1.029-1.451 1.308a4.5 4.5 0 01-.874.394l-.059.026c-.977.403-2.374.361-3.35-.048-.724-.281-1.124-.54-1.682-1.056C.008 11.682-.346 9.461.372 7.526c.325-.876.994-1.65 1.53-2.406.153-.212.37-.406.515-.628.184-.254.316-.48.475-.746C3.643 2.49 3.876 1.448 3.86 0z"
        fill={color}
      />
      {/* Inner white highlight */}
      <Path
        d="M3.912 11.032c-.296-1.73.222-3.683 1.638-4.799.104 1.19.277 1.714.989 2.656.703.929 1.437 1.867 1.306 3.092-.05.702-.25 1.123-.689 1.676-.104.131-.504.476-.524.536l-.059.025c-.977.404-2.373.362-3.35-.048-.65-.476-1.001-1.227-1.14-2.016-.11-.623.12-1.589.354-2.17.127-.316.324-.67.462-.991.006.657.025 1.19.525 1.701.12.123.329.27.487.338z"
        fill="url(#highlight)"
      />
    </Svg>
  );
}
