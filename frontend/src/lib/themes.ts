// Theme definitions for Maxwell's Wallet
// Four distinct visual styles

export type ThemeName = 'ledger' | 'dark' | 'cyberpunk' | 'soft'

export interface Theme {
  name: ThemeName
  label: string
  description: string
}

export const themes: Theme[] = [
  {
    name: 'ledger',
    label: 'Ledger',
    description: 'Editorial finance with serif typography'
  },
  {
    name: 'dark',
    label: 'Dark',
    description: 'Clean dark mode for low-light use'
  },
  {
    name: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon glows and futuristic vibes'
  },
  {
    name: 'soft',
    label: 'Soft',
    description: 'Warm minimalism with rounded edges'
  }
]

export const defaultTheme: ThemeName = 'ledger'
