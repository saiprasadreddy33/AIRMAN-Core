import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, X, Eye, EyeOff } from 'lucide-react';
import { UserRole } from '../types';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'pending';
}

const INITIAL_USERS: DemoUser[] = [
  { id: '1', name: 'Cadet James Wilson', email: 'student@alpha-aviation.com', role: 'student', status: 'active' },
  { id: '2', name: 'Lt. Sarah Chen', email: 'instructor@alpha-aviation.com', role: 'instructor', status: 'active' },
  { id: '3', name: 'Cadet Anna Park', email: 'anna@alpha-aviation.com', role: 'student', status: 'pending' },
  { id: '4', name: 'Cadet Tom Bauer', email: 'tom@alpha-aviation.com', role: 'student', status: 'active' },
];

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'badge-destructive',
  instructor: 'badge-warning',
  student: 'badge-info',
};

const ROLES: UserRole[] = ['student', 'instructor', 'admin'];

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<DemoUser[]>(INITIAL_USERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'student' as UserRole, password: '' });
  const [formError, setFormError] = useState('');

  if (!user) return null;

  const handleApprove = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
  };

  const handleRemove = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleAdd = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('All fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    const newUser: DemoUser = {
      id: `user-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      status: 'active',
    };
    setUsers(prev => [newUser, ...prev]);
    setShowAddModal(false);
    setForm({ name: '', email: '', role: 'student', password: '' });
    setFormError('');
  };

  const handleClose = () => {
    setShowAddModal(false);
    setForm({ name: '', email: '', role: 'student', password: '' });
    setFormError('');
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="User Management"
        subtitle="Manage students, instructors, and admins"
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        }
      />

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{users.length} users in {user.tenantName}</span>
        </div>

        <div className="divide-y divide-border">
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.04 }}
              className="px-4 md:px-5 py-4 flex items-center gap-3 md:gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full gradient-sky flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[u.role]}`}>
                  {u.role}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline ${
                  u.status === 'active' ? 'badge-success' : 'badge-warning'
                }`}>
                  {u.status}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {u.status === 'pending' && (
                  <button
                    onClick={() => handleApprove(u.id)}
                    className="px-3 py-1 text-xs gradient-sky text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => handleRemove(u.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remove user"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Add New User</h2>
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Cadet Sam Rivers"
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="cadet@alpha-aviation.com"
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Temporary Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-destructive">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Create User
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
