// Zustand store for global application state
// npm install zustand
import { create } from 'zustand';
import { Patient, Session, CaptureImage } from '../models/types';

interface AppState {
  currentPatient: Patient | null;
  currentSession: Session | null;
  sessionCaptures: CaptureImage[];
  
  // Actions
  setCurrentPatient: (patient: Patient | null) => void;
  setCurrentSession: (session: Session | null) => void;
  addSessionCapture: (capture: CaptureImage) => void;
  updateSessionCapture: (id: string, updates: Partial<CaptureImage>) => void;
  clearSession: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPatient: null,
  currentSession: null,
  sessionCaptures: [],

  setCurrentPatient: (patient) => set({ currentPatient: patient }),
  
  setCurrentSession: (session) => set({ currentSession: session }),
  
  addSessionCapture: (capture) => 
    set((state) => ({ sessionCaptures: [...state.sessionCaptures, capture] })),
    
  updateSessionCapture: (id, updates) =>
    set((state) => ({
      sessionCaptures: state.sessionCaptures.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    })),
    
  clearSession: () => set({ currentPatient: null, currentSession: null, sessionCaptures: [] }),
}));
