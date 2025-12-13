'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface DemoModeState {
  isDemoMode: boolean
  message: string | null
}

const DemoModeContext = createContext<DemoModeState | undefined>(undefined)

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

export function useDemoMode(): DemoModeState {
  const context = useContext(DemoModeContext)
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider')
  }
  return context
}
