import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";
export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export type TwoFactorStep = "idle" | "scan" | "verify" | "backup" | "disable";

export interface TotpEnrollment {
  qrDataUrl: string;
  otpauthUrl: string;
  manualKey: string;
}

export interface RevealedApiKey {
  appName: string;
  apiKey: string;
  reason: "created" | "rotated";
}

interface AuthUiState {
  // Toasts
  toasts: Toast[];
  pushToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: number) => void;

  // 2FA setup wizard
  twoFactorStep: TwoFactorStep;
  enrollment: TotpEnrollment | null;
  backupCodes: string[] | null;
  setTwoFactorStep: (step: TwoFactorStep) => void;
  setEnrollment: (e: TotpEnrollment | null) => void;
  setBackupCodes: (codes: string[] | null) => void;
  resetTwoFactorWizard: () => void;

  // Admin: one-time API key reveal + modals
  revealedKey: RevealedApiKey | null;
  revealKey: (k: RevealedApiKey) => void;
  clearRevealedKey: () => void;
  openModal: string | null;
  setOpenModal: (id: string | null) => void;
}

let toastSeq = 0;

export const useAuthStore = create<AuthUiState>()((set) => ({
  toasts: [],
  pushToast: (tone, message) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  twoFactorStep: "idle",
  enrollment: null,
  backupCodes: null,
  setTwoFactorStep: (twoFactorStep) => set({ twoFactorStep }),
  setEnrollment: (enrollment) => set({ enrollment }),
  setBackupCodes: (backupCodes) => set({ backupCodes }),
  resetTwoFactorWizard: () => set({ twoFactorStep: "idle", enrollment: null, backupCodes: null }),

  revealedKey: null,
  // Never persisted anywhere — lives only in memory until the modal is closed.
  revealKey: (revealedKey) => set({ revealedKey, openModal: "api-key-reveal" }),
  clearRevealedKey: () => set({ revealedKey: null, openModal: null }),
  openModal: null,
  setOpenModal: (openModal) => set({ openModal }),
}));
