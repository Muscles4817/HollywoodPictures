import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

/** Fixed-position toggle, mounted once in App.tsx so it's visible on every screen. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle-fixed">
      <Button onClick={toggleTheme} aria-label="Toggle dark mode">
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </Button>
    </div>
  );
}
