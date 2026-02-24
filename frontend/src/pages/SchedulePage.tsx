import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, X, User, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Booking, BookingStatus } from '../types';
import { api } from '@/lib/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function toLocalDateStr(isoStr: string): string {
  // Parse the ISO date and return a YYYY‑MM‑DD string in local time
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeStr(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ─── status config ──────────────────────────────────────────────────────────

type FilterStatus = BookingStatus | 'all';

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode }> = {
  requested: { label: 'Requested', className: 'badge-warning',     icon: <AlertCircle className="w-3 h-3" /> },
  pending:   { label: 'Pending',   className: 'badge-warning',     icon: <AlertCircle className="w-3 h-3" /> },
  approved:  { label: 'Approved',  className: 'badge-info',        icon: <CheckCircle className="w-3 h-3" /> },
  assigned:  { label: 'Assigned',  className: 'badge-info',        icon: <UserCheck   className="w-3 h-3" /> },
  completed: { label: 'Completed', className: 'badge-success',     icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', className: 'badge-destructive', icon: <XCircle     className="w-3 h-3" /> },
};

const FILTERS: FilterStatus[] = ['all', 'requested', 'approved', 'assigned', 'completed', 'cancelled'];

// ─── raw API types ───────────────────────────────────────────────────────────

interface RawUser { id: string; name?: string; email: string }
interface RawBooking {
  id: string; tenant_id: string;
  instructor_id: string; student_id: string;
  instructor?: RawUser; student?: RawUser;
  start_time: string; end_time: string;
  status: string;
  requested_at?: string; approved_at?: string; assigned_at?: string;
}
interface RawAvailability {
  id: string; instructor_id: string;
  instructor?: RawUser;
  start_time: string; end_time: string;
}

function mapBooking(pb: RawBooking): Booking {
  const st = new Date(pb.start_time);
  const et = new Date(pb.end_time);
  return {
    id: pb.id,
    studentId: pb.student_id,
    studentName: pb.student?.name ?? pb.student?.email ?? 'Student',
    instructorId: pb.instructor_id,
    instructorName: pb.instructor?.name ?? pb.instructor?.email ?? 'Instructor',
    tenantId: pb.tenant_id,
    title: 'Flight Training',
    date: toLocalDateStr(pb.start_time),
    startTime: toLocalTimeStr(st.toISOString()),
    endTime: toLocalTimeStr(et.toISOString()),
    status: pb.status as BookingStatus,
    createdAt: pb.requested_at ?? pb.start_time,
    requestedAt: pb.requested_at,
    approvedAt: pb.approved_at,
    assignedAt: pb.assigned_at,
  };
}

// ─── component ──────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availabilities, setAvailabilities] = useState<RawAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showAvailForm, setShowAvailForm] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [availForm, setAvailForm] = useState({ date: '', startTime: '', endTime: '' });
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    try {
      const payload = await api.get<{ data: RawBooking[] }>('/bookings?limit=100');
      if (payload?.data) {
        setBookings(payload.data.map(mapBooking));
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  }, []);

  const fetchAvailabilities = useCallback(async () => {
    try {
      const payload = await api.get<{ data: RawAvailability[] }>('/availability?limit=100');
      if (payload?.data) setAvailabilities(payload.data);
    } catch (err) {
      console.error('Failed to fetch availabilities:', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    Promise.all([fetchBookings(), fetchAvailabilities()]).finally(() => setIsLoading(false));
  }, [user, fetchBookings, fetchAvailabilities]);

  if (!user) return null;

  // ── calendar ───────────────────────────────────────────────────────────────

  const weekDates = getWeekDates(currentWeek);
  const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = toLocalDateStr(new Date().toISOString());

  const visibleBookings = activeFilter === 'all'
    ? bookings
    : bookings.filter(b => b.status === activeFilter);

  // ── action handlers ────────────────────────────────────────────────────────

  const ACTION_LABELS: Record<string, string> = {
    approve: 'Booking approved ✅',
    assign: 'Instructor assigned 👨‍✈️',
    complete: 'Session marked as completed 🎉',
    cancel: 'Booking cancelled',
  };

  const withAction = async (id: string, endpoint: string) => {
    if (actionLoading) return;
    setActionLoading(id + endpoint);
    setError(null);
    try {
      await api.post(`/bookings/${id}/${endpoint}`);
      await fetchBookings();
      toast.success(ACTION_LABELS[endpoint] ?? `Action: ${endpoint}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Action failed: ${endpoint}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBook = async () => {
    if (!selectedAvailability) return;
    const avail = availabilities.find(a => a.id === selectedAvailability);
    if (!avail) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/bookings', {
        instructor_id: avail.instructor_id,
        student_id: user.id,
        start_time: avail.start_time,
        end_time: avail.end_time,
      });
      await Promise.all([fetchBookings(), fetchAvailabilities()]);
      setShowBookingForm(false);
      setSelectedAvailability(null);
      toast.success('Booking request submitted! Awaiting admin approval.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create booking';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!availForm.date || !availForm.startTime || !availForm.endTime) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const start = new Date(`${availForm.date}T${availForm.startTime}`).toISOString();
      const end = new Date(`${availForm.date}T${availForm.endTime}`).toISOString();
      await api.post('/availability', { start_time: start, end_time: end });
      await fetchAvailabilities();
      setShowAvailForm(false);
      setAvailForm({ date: '', startTime: '', endTime: '' });
      toast.success('Availability slot saved! Students can now book this session.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save availability';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── action buttons by role + status ───────────────────────────────────────

  const renderActions = (b: Booking) => {
    const loading = actionLoading?.startsWith(b.id);
    const btn = (label: string, action: string, variant: 'primary' | 'danger') => (
      <button
        key={action}
        onClick={() => withAction(b.id, action)}
        disabled={!!loading}
        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all disabled:opacity-50 ${
          variant === 'primary'
            ? 'gradient-sky text-primary-foreground'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}
      >
        {loading ? '...' : label}
      </button>
    );

    if (user.role === 'admin') {
      if (b.status === 'requested') return <div className="flex gap-2">{btn('Approve', 'approve', 'primary')}{btn('Cancel', 'cancel', 'danger')}</div>;
      if (b.status === 'approved')  return <div className="flex gap-2">{btn('Assign', 'assign', 'primary')}{btn('Cancel', 'cancel', 'danger')}</div>;
      if (b.status === 'assigned')  return <div className="flex gap-2">{btn('Complete', 'complete', 'primary')}{btn('Cancel', 'cancel', 'danger')}</div>;
    }
    if (user.role === 'instructor') {
      if (b.status === 'assigned') return <div className="flex gap-2">{btn('Complete', 'complete', 'primary')}{btn('Cancel', 'cancel', 'danger')}</div>;
    }
    if (user.role === 'student') {
      if (b.status === 'requested') return btn('Cancel', 'cancel', 'danger');
    }
    return null;
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Schedule"
        subtitle="Skynet Training Management"
        action={
          user.role === 'student' ? (
            <button onClick={() => setShowBookingForm(true)} className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />Book Session
            </button>
          ) : user.role === 'instructor' ? (
            <button onClick={() => setShowAvailForm(true)} className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />Set Availability
            </button>
          ) : null
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all capitalize whitespace-nowrap ${
              activeFilter === f ? 'gradient-sky text-primary-foreground' : 'bg-muted border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Weekly calendar */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold flex items-center gap-2 text-sm md:text-base">
            <Calendar className="w-4 h-4 text-primary" />
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}
              className="p-1.5 rounded-lg bg-muted hover:bg-secondary border border-border"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentWeek(new Date())} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-secondary border border-border">Today</button>
            <button
              onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}
              className="p-1.5 rounded-lg bg-muted hover:bg-secondary border border-border"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const dateStr = toLocalDateStr(date.toISOString());
            const dayBookings = visibleBookings.filter(b => b.date === dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className={`min-h-[90px] rounded-lg p-1.5 ${isToday ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-border/40'}`}>
                <div className={`text-center mb-1.5 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className="text-[10px] font-medium">{WEEK_DAYS[i]}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>{date.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {dayBookings.map(b => {
                    const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG['requested'];
                    return (
                      <div
                        key={b.id}
                        className={`text-[9px] leading-tight p-1 rounded ${cfg.className} truncate`}
                        title={`${b.status} · ${b.startTime}–${b.endTime} · ${b.instructorName}`}
                      >
                        {b.startTime} {b.instructorName?.split(' ')[0]}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bookings list */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4">
          {user.role === 'admin' ? 'All Bookings' : user.role === 'instructor' ? 'My Sessions' : 'My Bookings'}
        </h2>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading bookings...</div>
        ) : visibleBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No bookings found.</div>
        ) : (
          <div className="space-y-3">
            {visibleBookings.map(b => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG['requested'];
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start justify-between p-4 bg-muted/50 border border-border rounded-xl gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{b.date} · {b.startTime}–{b.endTime}
                      </span>
                      {user.role !== 'student' && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />{b.studentName}
                        </span>
                      )}
                      {user.role !== 'instructor' && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />{b.instructorName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {renderActions(b)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Book Session Modal (students) */}
      <AnimatePresence>
        {showBookingForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Book a Training Session</h2>
                <button onClick={() => { setShowBookingForm(false); setError(null); }} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="mb-3 p-2 bg-destructive/10 text-destructive text-xs rounded-lg">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Available Slots</label>
                  {availabilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No availability slots found.</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {availabilities.map(slot => {
                        const slotDate = toLocalDateStr(slot.start_time);
                        const slotStart = toLocalTimeStr(slot.start_time);
                        const slotEnd = toLocalTimeStr(slot.end_time);
                        const instructorLabel = slot.instructor?.name ?? slot.instructor?.email ?? 'Instructor';
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedAvailability(slot.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                              selectedAvailability === slot.id
                                ? 'border-primary/50 bg-primary/10'
                                : 'border-border bg-muted/30 hover:border-primary/30'
                            }`}
                          >
                            <div className="text-left">
                              <div className="font-medium">{instructorLabel}</div>
                              <div className="text-xs text-muted-foreground">{slotDate}</div>
                            </div>
                            <span className="text-muted-foreground text-xs">{slotStart} – {slotEnd}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowBookingForm(false); setError(null); setSelectedAvailability(null); }}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={!selectedAvailability || isSubmitting}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40"
                  >
                    {isSubmitting ? 'Booking...' : 'Request Booking'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Availability Modal (instructors) */}
      <AnimatePresence>
        {showAvailForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Set Availability</h2>
                <button onClick={() => { setShowAvailForm(false); setError(null); }} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="mb-3 p-2 bg-destructive/10 text-destructive text-xs rounded-lg">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Date</label>
                  <input
                    type="date"
                    value={availForm.date}
                    onChange={e => setAvailForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={availForm.startTime}
                      onChange={e => setAvailForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={availForm.endTime}
                      onChange={e => setAvailForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowAvailForm(false); setAvailForm({ date: '', startTime: '', endTime: '' }); setError(null); }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAvailability}
                    disabled={!availForm.date || !availForm.startTime || !availForm.endTime || isSubmitting}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Slot'}
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
