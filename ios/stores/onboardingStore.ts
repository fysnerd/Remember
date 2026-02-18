import { create } from 'zustand';
import api from '../lib/api';

interface OnboardingState {
  firstName: string;
  currentStep: number;
  interests: string[];
  objective: string;
  reviewPace: string;
  connectedSource: string | null;
  attributionSources: string[];
  isSubmitting: boolean;

  setFirstName: (name: string) => void;
  setCurrentStep: (step: number) => void;
  setInterests: (interests: string[]) => void;
  setObjective: (objective: string) => void;
  setReviewPace: (pace: string) => void;
  setConnectedSource: (source: string | null) => void;
  setAttributionSources: (sources: string[]) => void;

  saveStep: (step: number, data?: Record<string, unknown>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  firstName: '',
  currentStep: 0,
  interests: [],
  objective: '',
  reviewPace: '',
  connectedSource: null,
  attributionSources: [],
  isSubmitting: false,

  setFirstName: (name) => set({ firstName: name }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setInterests: (interests) => set({ interests }),
  setObjective: (objective) => set({ objective }),
  setReviewPace: (pace) => set({ reviewPace: pace }),
  setConnectedSource: (source) => set({ connectedSource: source }),
  setAttributionSources: (sources) => set({ attributionSources: sources }),

  saveStep: async (step, data) => {
    set({ isSubmitting: true });
    try {
      await api.post('/onboarding/step', { step, data });
      set({ currentStep: step });
    } finally {
      set({ isSubmitting: false });
    }
  },

  completeOnboarding: async () => {
    set({ isSubmitting: true });
    try {
      await api.post('/onboarding/complete');
    } finally {
      set({ isSubmitting: false });
    }
  },

  reset: () =>
    set({
      firstName: '',
      currentStep: 0,
      interests: [],
      objective: '',
      reviewPace: '',
      connectedSource: null,
      attributionSources: [],
      isSubmitting: false,
    }),
}));
