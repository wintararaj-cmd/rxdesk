'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FinancialYear {
  label: string; // e.g. "2024-25"
  start: string; // e.g. "2024-04-01"
  end: string;   // e.g. "2025-03-31"
}

interface ConfigState {
  financialYear: string;
  setFinancialYear: (fy: string) => void;
  getAvailableFYs: () => string[];
}

const getCurrentFY = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  
  // In India, FY starts in April (month index 3)
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      financialYear: getCurrentFY(),
      setFinancialYear: (financialYear) => set({ financialYear }),
      getAvailableFYs: () => {
        const currentYear = new Date().getFullYear();
        const fys = [];
        // Show last 5 years + next year
        for (let i = -4; i <= 1; i++) {
          const y = currentYear + i;
          fys.push(`${y}-${(y + 1).toString().slice(-2)}`);
        }
        return fys.reverse();
      }
    }),
    {
      name: 'rxdesk-web-config',
    }
  )
);
