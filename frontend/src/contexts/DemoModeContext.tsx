'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface DemoModeState {
  isDemoMode: boolean
  message: string | null
}

interface DemoModeContextType extends DemoModeState {
  // Add any methods if needed in the future
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined)

interface DemoModeProviderProps {
  children: ReactNode
  isDemoMode: boolean
  message: string | null
}

export function DemoModeProvider({ children, isDemoMode, message }: DemoModeProviderProps) {
  return (
    <DemoModeContext.Provider value={{ isDemoMode, message }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode(): DemoModeContextType {
  const context = useContext(DemoModeContext)
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider')
  }
  return context
}
