import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Bell, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    bookings: true,
    content: false,
    quizzes: true,
  });

  if (!user) return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Account and platform preferences" />

      <div className="space-y-4">
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Account
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <div className="px-3.5 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground capitalize">
                {user.role}
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Organisation</label>
              <div className="px-3.5 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground">
                {user.tenantName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSave}
              className="gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-success font-medium"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved successfully
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Notifications
          </h2>
          <div className="space-y-4">
            {[
              { key: 'bookings' as const, label: 'Booking confirmations', desc: 'Get notified when a booking is approved or cancelled' },
              { key: 'content' as const, label: 'New course content', desc: 'Be alerted when new lessons are published' },
              { key: 'quizzes' as const, label: 'Quiz results', desc: 'Receive your score immediately after submission' },
            ].map(n => (
              <div key={n.key} className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground">{n.desc}</div>
                </div>
                <button
                  onClick={() => toggleNotification(n.key)}
                  className={`relative flex-shrink-0 w-9 h-5 rounded-full border transition-colors ${
                    notifications[n.key] ? 'bg-primary border-primary' : 'bg-muted border-border'
                  }`}
                  role="switch"
                  aria-checked={notifications[n.key]}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all ${
                      notifications[n.key] ? 'translate-x-4 bg-primary-foreground' : 'bg-muted-foreground'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
