'use client'

import { usePreferencesStore } from '@/store/preferences-store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Moon, Sun, Monitor } from 'lucide-react'

export function ThemeSwitcher() {
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            {theme === 'light' && <Sun className="h-4 w-4" />}
            {theme === 'dark' && <Moon className="h-4 w-4" />}
            {theme === 'system' && <Monitor className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setTheme('light')}
            className={theme === 'light' ? 'bg-accent' : ''}
          >
            <Sun className="mr-2 h-4 w-4" />
            {strings.lightMode}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('dark')}
            className={theme === 'dark' ? 'bg-accent' : ''}
          >
            <Moon className="mr-2 h-4 w-4" />
            {strings.darkMode}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('system')}
            className={theme === 'system' ? 'bg-accent' : ''}
          >
            <Monitor className="mr-2 h-4 w-4" />
            {strings.systemMode}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
