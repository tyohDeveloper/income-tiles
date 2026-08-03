import { useEffect, useMemo, useState } from 'react';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Theme, ThemeContext } from '@/lib/theme';
import Dashboard from '@/pages/dashboard';
import NotFound from '@/pages/not-found';

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Dark mode is the default for this tool; the OS preference can only push it lighter.
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const ctx = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={ctx}>
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
