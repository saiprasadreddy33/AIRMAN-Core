import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Plane, ChevronDown, ChevronUp, School, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DemoSchool, getDemoCredentials } from '@/lib/auth';
import { UserRole } from '@/types';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'badge-destructive',
  instructor: 'badge-warning',
  student: 'badge-info',
};

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemos, setShowDemos] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<DemoSchool>('school-a');

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const result = await login(email, password);
    if (result.success) {
      router.replace('/dashboard');
    } else {
      setError(result.error ?? 'Login failed');
    }
    setIsSubmitting(false);
  };

  const fillCredentials = (cEmail: string, cPassword: string) => {
    setEmail(cEmail);
    setPassword(cPassword);
    setError('');
  };

  const demos = getDemoCredentials(selectedSchool);

  const schoolMeta: Record<DemoSchool, { label: string; subtitle: string }> = {
    'school-a': { label: 'School A', subtitle: 'Flight School A · Main Academy' },
    'school-b': { label: 'School B', subtitle: 'Flight School B · Partner Academy' },
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-sky flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">AIRMAN</div>
              <div className="text-xs text-muted-foreground">Aviation Intelligence Platform</div>
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign in to your training portal</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@academy.com"
                className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full gradient-sky text-primary-foreground font-semibold py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-50 sky-glow"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDemos(!showDemos)}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 font-medium uppercase tracking-wider"
            >
              Want some creds? {showDemos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showDemos && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 overflow-hidden"
              >
                <div className="bg-muted/60 border border-border rounded-lg p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(['school-a', 'school-b'] as DemoSchool[]).map((school) => {
                      const active = selectedSchool === school;
                      return (
                        <button
                          key={school}
                          type="button"
                          onClick={() => setSelectedSchool(school)}
                          className={`rounded-md px-3 py-2.5 text-left transition-all border ${
                            active
                              ? 'gradient-sky text-primary-foreground border-transparent sky-glow'
                              : 'bg-background border-border hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <School className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold">{schoolMeta[school].label}</span>
                          </div>
                          <div className={`text-[10px] mt-1 ${active ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                            {schoolMeta[school].subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <Sparkles className="w-3 h-3" />
                  Click any card to auto-fill login credentials for {schoolMeta[selectedSchool].label}
                </div>

                {demos.map(d => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => fillCredentials(d.email, d.password)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/80 hover:bg-secondary border border-border hover:border-primary/30 rounded-lg transition-all group"
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[d.role]} capitalize font-medium`}>
                      {d.role}
                    </span>
                  </button>
                ))}

                {demos.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No demo credentials available for this school.
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
