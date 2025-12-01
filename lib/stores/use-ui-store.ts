/**
 * Zustand store for UI state management
 * Manages global UI-related state (modals, dialogs, etc.)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  // Dialog states
  isConfigDialogOpen: boolean;
  isDisplaySettingsDialogOpen: boolean;
  
  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;
  
  // Actions
  setConfigDialogOpen: (open: boolean) => void;
  setDisplaySettingsDialogOpen: (open: boolean) => void;
  setLoading: (loading: boolean, message?: string | null) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // Initial state
      isConfigDialogOpen: false,
      isDisplaySettingsDialogOpen: false,
      isLoading: false,
      loadingMessage: null,
      
      // Actions
      setConfigDialogOpen: (open) =>
        set({ isConfigDialogOpen: open }, false, 'setConfigDialogOpen'),
      
      setDisplaySettingsDialogOpen: (open) =>
        set({ isDisplaySettingsDialogOpen: open }, false, 'setDisplaySettingsDialogOpen'),
      
      setLoading: (loading, message = null) =>
        set(
          { isLoading: loading, loadingMessage: message },
          false,
          'setLoading'
        ),
    }),
    { name: 'UIStore' }
  )
);

