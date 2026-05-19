import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// =============================================================================
// ThemeProvider — Light / Dark mode
//
// Estrategia:
//   - El tema se almacena en localStorage para persistir entre sesiones
//   - Se aplica añadiendo/quitando la clase 'dark' en <html>
//   - Tailwind usa darkMode: 'class' para activar las variantes dark:
//   - Las variables CSS en :root y .dark sincronizan todos los componentes
// =============================================================================

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme:  Theme;
  toggle: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeCtx>({
  theme:  'light',
  toggle: () => {},
  isDark: false,
});

const STORAGE_KEY = 'pos_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Leer preferencia guardada, o usar preferencia del SO
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);