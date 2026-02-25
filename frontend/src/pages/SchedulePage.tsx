import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, X, User, UserCheck, AlertTriangle,
  ArrowRight, Loader2, RefreshCw, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Booking, BookingStatus } from '../types';
import { api, ApiError } from '@/lib/api';

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

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
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
  requested: { label: 'Requested', className: 'bg-amber-500/15 text-amber-600 border border-amber-500/20',     icon: <AlertCircle className="w-3 h-3" /> },
  approved:  { label: 'Approved',  className: 'bg-sky-500/15 text-sky-600 border border-sky-500/20',           icon: <CheckCircle className="w-3 h-3" /> },
  assigned:  { label: 'Assigned',  className: 'bg-violet-500/15 text-violet-600 border border-violet-500/20', icon: <UserCheck   className="w-3 h-3" /> },
  completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-600 border border-red-500/20',           icon: <XCircle     className="w-3 h-3" /> },
};

const STATUS_ORDER: BookingStatus[] = ['requested', 'approved', 'assigned', 'completed'];

const FILTERS: FilterStatus[] = ['all', 'requested', 'approved', 'assigned', 'completed', 'cancelled'];

// ─── raw API types ───────────────────────────────────────────────────────────

interface RawUser { id: string; name?: string; email: string }
interface RawBooking {
  id: string; tenant_id: string;
  instructor_id: string; student_id: string;
  instructor?: RawUser; student?: RawUser;
  start_time: string; end_time: string;
  status: string;
  escalation_required?: boolean;
  requested_at?: string; approved_at?: string; assigned_at?: string;
  completed_at?: string; cancelled_at?: string;
}
interface RawAvailability {
  id: string; instructor_id: string;
  instructor?: RawUser;
  start_time: string; end_time: string;
}

function mapBooking(pb: RawBooking): Booking {
  return {
    id: pb.id,
    studentId: pb.student_id,
    studentName: pb.student?.name ?? pb.student?.email ?? 'Student',
    instructorId: pb.instructor_id,
    instructorName: pb.instructor?.name ?? pb.instructor?.email ?? 'Instructor',
    tenantId: pb.tenant_id,
    title: 'Flight Training',
    date: toLocalDateStr(pb.start_time),
    startTime: toLocalTimeStr(pb.start_time),
    endTime: toLocalTimeStr(pb.end_time),
    status: pb.status as BookingStatus,
    createdAt: pb.requested_at ?? pb.start_time,
    requestedAt: pb.requested_at,
    approvedAt: pb.approved_at,
    assignedAt: pb.assigned_at,
    completedAt: pb.completed_at,
    cancelledAt: pb.cancelled_at,
    escalationRequired: pb.escalation_required ?? false,
  };
}

// ─── conflict modal ───────────────────────────────────────────────────────────

interface ConflictInfo {
  kind: 'booking-conflict' | 'booking-no-availability' | 'availability-overlap';
  slot?: { date: string; start: string; end: string; instructor?: string };
}

function ConflictModal({ info, onClose }: { info: ConflictInfo; onClose: () => void }) {
  const titles: Record<ConflictInfo['kind'], string> = {
    'booking-conflict':        'Time Slot Already Booked',
    'booking-no-availability': 'Instructor Not Available',
    'availability-overlap':    'Schedule Conflict',
  };
  const descriptions: Record<ConflictInfo['kind'], string> = {
    'booking-conflict':        'The instructor already has an approved or assigned session during this time.',
    'booking-no-availability': 'The instructor has not made this time slot available for booking.',
    'availability-overlap':    'You already have an availability slot that overlaps with this time.',
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        className="w-full max-w-sm glass-card rounded-2xl p-6 border border-destructive/20"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="font-display font-bold text-lg text-center mb-2">{titles[info.kind]}</h2>
        <p className="text-sm text-muted-foreground text-center mb-4 leading-relaxed">{descriptions[info.kind]}</p>

        {info.slot && (
          <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-4 mb-5 space-y-1.5">
            {info.slot.instructor && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{info.slot.instructor}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span>{info.slot.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span>{info.slot.start} – {info.slot.end}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-destructive font-medium pt-1 border-t border-destructive/10 mt-1">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              This slot is unavailable
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mb-5">
          Please select a different time slot and try again.
        </p>
        <button
          onClick={onClose}
          className="w-full gradient-sky text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Choose Another Slot
        </button>
      </motion.div>
    </div>
  );
}

// ─── cancel confirm modal ─────────────────────────────────────────────────────

function CancelConfirmModal({
  booking, onConfirm, onClose, loading,
}: {
  booking: Booking; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        className="w-full max-w-sm glass-card rounded-2xl p-6"
      >
        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-warning" />
        </div>
        <h2 className="font-display font-bold text-lg text-center mb-2">Cancel Booking?</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">Are you sure you want to cancel this training session?</p>

        <div className="bg-muted/60 border border-border rounded-xl p-4 mb-5 space-y-1.5">
          <div className="flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><span>{booking.date}</span></div>
          <div className="flex items-center gap-2 text-sm"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span>{booking.startTime} – {booking.endTime}</span></div>
          <div className="flex items-center gap-2 text-sm"><UserCheck className="w-3.5 h-3.5 text-muted-foreground" /><span>{booking.instructorName}</span></div>
        </div>

        <p className="text-xs text-muted-foreground text-center mb-5">The time slot will become available for new bookings.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50">
            Keep Booking
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Cancel Session
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── status timeline ──────────────────────────────────────────────────────────

function StatusTimeline({ booking }: { booking: Booking }) {
  if (booking.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG.cancelled.className}`}>
          {STATUS_CONFIG.cancelled.icon}
          Cancelled{booking.cancelledAt ? ` · ${formatDateTime(booking.cancelledAt)}` : ''}
        </span>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(booking.status);
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {STATUS_ORDER.map((s, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const cfg = STATUS_CONFIG[s];
        return (
          <div key={s} className="flex items-center gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all ${
              isCurrent ? cfg.className :
              isDone    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15' :
                          'bg-muted/50 text-muted-foreground border border-border/40 opacity-40'
            }`}>
              {isDone ? <CheckCircle className="w-3 h-3" /> : isCurrent ? cfg.icon : null}
              {cfg.label}
            </span>
            {i < STATUS_ORDER.length - 1 && (
              <ArrowRight className={`w-3 h-3 flex-shrink-0 ${i >= currentIdx ? 'text-muted-foreground/30' : 'text-muted-foreground'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Conflict modal state
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  // Cancel confirmation state
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  // Set of "instructor-date-startTime" keys that are already approved/assigned
  const bookedSlotKeys = new Set(
    bookings
      .filter(b => b.status === 'approved' || b.status === 'assigned')
      .map(b => `${b.instructorId}-${b.date}-${b.startTime}`),
  );

  // Escalation count for admin banner
  const escalationCount = bookings.filter(b => b.escalationRequired && b.status === 'approved').length;

  // ── action handlers ────────────────────────────────────────────────────────

  const withAction = async (id: string, endpoint: string) => {
    if (actionLoading) return;
    setActionLoading(`${id}-${endpoint}`);
    try {
      await api.patch(`/bookings/${id}/${endpoint}`);
      await fetchBookings();
      const labels: Record<string, string> = {
        approve:  'Booking approved — ready for instructor assignment',
        assign:   'Instructor assigned to session 👨‍✈️',
        complete: 'Session marked as completed 🎉',
        cancel:   'Booking cancelled',
      };
      toast.success(labels[endpoint] ?? `Action: ${endpoint}`);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : `Action failed: ${endpoint}`;
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = (b: Booking) => setCancelTarget(b);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await api.patch(`/bookings/${cancelTarget.id}/cancel`);
      await fetchBookings();
      toast.success('Booking cancelled successfully');
      setCancelTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel booking';
      toast.error(msg);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedAvailability) return;
    const avail = availabilities.find(a => a.id === selectedAvailability);
    if (!avail) return;
    setIsSubmitting(true);
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
      toast.success('Booking request submitted! Awaiting approval.');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const slotDate = toLocalDateStr(avail.start_time);
        const slotStart = toLocalTimeStr(avail.start_time);
        const slotEnd = toLocalTimeStr(avail.end_time);
        const instructor = avail.instructor?.name ?? avail.instructor?.email ?? 'Instructor';
        setConflictInfo({
          kind: err.code === 'INSTRUCTOR_NOT_AVAILABLE' ? 'booking-no-availability' : 'booking-conflict',
          slot: { date: slotDate, start: slotStart, end: slotEnd, instructor },
        });
        setShowBookingForm(false);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to create booking');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!availForm.date || !availForm.startTime || !availForm.endTime) return;
    setIsSubmitting(true);
    try {
      const start = new Date(`${availForm.date}T${availForm.startTime}`).toISOString();
      const end = new Date(`${availForm.date}T${availForm.endTime}`).toISOString();
      await api.post('/availability', { start_time: start, end_time: end });
      await fetchAvailabilities();
      setShowAvailForm(false);
      setAvailForm({ date: '', startTime: '', endTime: '' });
      toast.success('Availability slot saved! Students can now book this session.');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictInfo({
          kind: 'availability-overlap',
          slot: { date: availForm.date, start: availForm.startTime, end: availForm.endTime },
        });
        setShowAvailForm(false);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to save availability');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── action buttons by role + status ───────────────────────────────────────

  const renderActions = (b: Booking) => {
    const anyLoading = actionLoading?.startsWith(b.id) ?? false;

    const PrimaryBtn = ({ label, action }: { label: string; action: string }) => (
      <button
        onClick={() => withAction(b.id, action)}
        disabled={anyLoading}
        className="px-3 py-1.5 text-xs rounded-lg font-medium gradient-sky text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
      >
        {actionLoading === `${b.id}-${action}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {label}
      </button>
    );

    const DangerBtn = ({ label }: { label: string }) => (
      <button
        onClick={() => handleCancelRequest(b)}
        disabled={anyLoading}
        className="px-3 py-1.5 text-xs rounded-lg font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
      >
        {label}
      </button>
    );

    if (user.role === 'admin') {
      if (b.status === 'requested') return <div className="flex gap-2 flex-wrap"><PrimaryBtn label="Approve" action="approve" /><DangerBtn label="Cancel" /></div>;
      if (b.status === 'approved')  return <div className="flex gap-2 flex-wrap"><PrimaryBtn label="Assign Instructor" action="assign" /><DangerBtn label="Cancel" /></div>;
      if (b.status === 'assigned')  return <div className="flex gap-2 flex-wrap"><PrimaryBtn label="Mark Complete" action="complete" /><DangerBtn label="Cancel" /></div>;
    }
    if (user.role === 'instructor') {
      if (b.status === 'requested') return <div className="flex gap-2 flex-wrap"><PrimaryBtn label="Approve" action="approve" /><DangerBtn label="Decline" /></div>;
      if (b.status === 'assigned')  return <div className="flex gap-2 flex-wrap"><PrimaryBtn label="Mark Complete" action="complete" /><DangerBtn label="Cancel" /></div>;
    }
    if (user.role === 'student') {
      if (b.status === 'requested') return <DangerBtn label="Cancel Request" />;
      if (b.status === 'approved')  return <DangerBtn label="Cancel" />;
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchBookings(); fetchAvailabilities(); }}
              className="p-2 rounded-lg bg-muted border border-border hover:bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {user.role === 'student' && (
              <button onClick={() => setShowBookingForm(true)} className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />Book Session
              </button>
            )}
            {user.role === 'instructor' && (
              <button onClick={() => setShowAvailForm(true)} className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />Set Availability
              </button>
            )}
          </div>
        }
      />

      {/* Escalation banner — admin only */}
      {user.role === 'admin' && escalationCount > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <Shield className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {escalationCount} booking{escalationCount > 1 ? 's' : ''} require{escalationCount === 1 ? 's' : ''} attention
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              These approved sessions haven&apos;t been assigned to an instructor yet and have exceeded the 2-hour SLA.
            </p>
          </div>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(f => {
          const count = f === 'all' ? bookings.length : bookings.filter(b => b.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all capitalize whitespace-nowrap ${
                activeFilter === f ? 'gradient-sky text-primary-foreground' : 'bg-muted border border-border'
              }`}
            >
              {f}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeFilter === f ? 'bg-white/20' : 'bg-muted-foreground/20'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
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
            const dayBookings = bookings.filter(b => b.date === dateStr);
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
                        className={`text-[9px] leading-tight p-1 rounded ${cfg.className} truncate relative`}
                        title={`${b.status} · ${b.startTime}–${b.endTime} · ${b.instructorName}`}
                      >
                        {b.escalationRequired && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" title="Escalated" />}
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
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />Loading bookings…
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No bookings found.</div>
        ) : (
          <div className="space-y-3">
            {visibleBookings.map(b => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG['requested'];
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-muted/50 border border-border rounded-xl"
                >
                  {/* Top row: status badge + escalation + time */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                      {b.escalationRequired && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-600 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />Escalated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />{b.date} · {b.startTime}–{b.endTime}
                    </div>
                  </div>

                  {/* People row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                    {user.role !== 'student' && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />Student: {b.studentName}
                      </span>
                    )}
                    {user.role !== 'instructor' && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />Instructor: {b.instructorName}
                      </span>
                    )}
                  </div>

                  {/* Timeline */}
                  <StatusTimeline booking={b} />

                  {/* Actions */}
                  {renderActions(b) && (
                    <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
                      {renderActions(b)}
                    </div>
                  )}
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
                <button onClick={() => { setShowBookingForm(false); setSelectedAvailability(null); }} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                        const isBooked = bookedSlotKeys.has(`${slot.instructor_id}-${slotDate}-${slotStart}`);
                        const isPast = new Date(slot.start_time) < new Date();
                        return (
                          <button
                            key={slot.id}
                            onClick={() => !isBooked && !isPast && setSelectedAvailability(slot.id)}
                            disabled={isBooked || isPast}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                              isBooked || isPast
                                ? 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
                                : selectedAvailability === slot.id
                                ? 'border-primary/50 bg-primary/10'
                                : 'border-border bg-muted/30 hover:border-primary/30'
                            }`}
                          >
                            <div className="text-left">
                              <div className="font-medium">{instructorLabel}</div>
                              <div className="text-xs text-muted-foreground">{slotDate}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground text-xs">{slotStart} – {slotEnd}</span>
                              {isBooked && <p className="text-[10px] text-amber-500">Already booked</p>}
                              {isPast && !isBooked && <p className="text-[10px] text-muted-foreground">Past</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowBookingForm(false); setSelectedAvailability(null); }}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={!selectedAvailability || isSubmitting}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Booking…</> : 'Request Booking'}
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
                <button onClick={() => { setShowAvailForm(false); setAvailForm({ date: '', startTime: '', endTime: '' }); }} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                    onClick={() => { setShowAvailForm(false); setAvailForm({ date: '', startTime: '', endTime: '' }); }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAvailability}
                    disabled={!availForm.date || !availForm.startTime || !availForm.endTime || isSubmitting}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Slot'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Conflict modal — 409 errors */}
      <AnimatePresence>
        {conflictInfo && (
          <ConflictModal info={conflictInfo} onClose={() => setConflictInfo(null)} />
        )}
      </AnimatePresence>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {cancelTarget && (
          <CancelConfirmModal
            booking={cancelTarget}
            loading={cancelLoading}
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
