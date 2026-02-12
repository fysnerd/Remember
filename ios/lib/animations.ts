/**
 * Animation timing constants and easing presets.
 *
 * All durations in milliseconds. Easing curves use Reanimated Easing API.
 */

import { Easing } from 'react-native-reanimated';

export const timing = {
  fast: 150,    // Micro-interactions: button feedback, tab indicator
  normal: 250,  // Standard transitions: card appearance, list items
  slow: 350,    // Full screen transitions, modals
} as const;

export const easing = {
  default: Easing.bezier(0.25, 0.1, 0.25, 1.0),     // CSS ease
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1.0),        // Decelerate (entering)
  easeIn: Easing.bezier(0.4, 0.0, 1.0, 1.0),         // Accelerate (exiting)
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1.0),      // Standard curve
} as const;

/** Max items to stagger in a list before using fixed delay */
export const STAGGER_CAP = 8;
/** Delay between staggered items in ms */
export const STAGGER_DELAY = 60;
