/**
 * Onboarding store (Zustand)
 *
 * Tracks local onboarding state and syncs with backend
 */

import { create } from 'zustand';
import api from '../lib/api';

interface OnboardingState {
  currentStep: number;
  firstName: string;
  interests: string[];
  goal: string | null;
  quizFrequency: string | null;
  attributionSource: string | null;
  isSaving: boolean;

  setFirstName: (name: string) => void;
  setInterests: (interests: string[]) => void;
  setGoal: (goal: string) => void;
  setQuizFrequency: (freq: string) => void;
  setAttributionSource: (source: string) => void;
  saveStep: (step: number, data?: Record<string, unknown>) => Promise<void>;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 0,
  firstName: '',
  interests: [],
  goal: null,
  quizFrequency: null,
  attributionSource: null,
  isSaving: false,

  setFirstName: (firstName) => set({ firstName }),
  setInterests: (interests) => set({ interests }),
  setGoal: (goal) => set({ goal }),
  setQuizFrequency: (quizFrequency) => set({ quizFrequency }),
  setAttributionSource: (attributionSource) => set({ attributionSource }),
  setCurrentStep: (step) => set({ currentStep: step }),

  saveStep: async (step: number, data?: Record<string, unknown>) => {
    set({ isSaving: true });
    try {
      await api.patch('/users/onboarding', { step, data });
      set({ currentStep: step, isSaving: false });
    } catch {
      set({ isSaving: false });
      throw new Error('Failed to save onboarding step');
    }
  },

  reset: () =>
    set({
      currentStep: 0,
      firstName: '',
      interests: [],
      goal: null,
      quizFrequency: null,
      attributionSource: null,
      isSaving: false,
    }),
}));
