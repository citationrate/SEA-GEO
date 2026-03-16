"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ConsultationCtx {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ConsultationContext = createContext<ConsultationCtx>({
  open: false,
  openModal: () => {},
  closeModal: () => {},
});

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <ConsultationContext.Provider value={{ open, openModal, closeModal }}>
      {children}
    </ConsultationContext.Provider>
  );
}

export function useConsultation() {
  return useContext(ConsultationContext);
}
