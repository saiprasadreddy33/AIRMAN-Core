import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Booking, BookingStatus } from '../types';
import { apiUrl } from '@/lib/api';

function normalizeBookingStatus(status: string): BookingStatus {
  if (status === 'requested') return 'pending';
  if (status === 'approved' || status === 'assigned' || status === 'completed' || status === 'cancelled') {
    return status;
  }
  return 'pending';
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', className: 'badge-warning', icon: <AlertCircle className="w-3 h-3" /> },
  approved: { label: 'Approved', className: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
  assigned: { label: 'Assigned', className: 'badge-info', icon: <CheckCircle className="w-3 h-3" /> },
  completed: { label: 'Completed', className: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', className: 'badge-destructive', icon: <XCircle className="w-3 h-3" /> },
};

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showAvailForm, setShowAvailForm] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<string | null>(null);
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [activeFilter, setActiveFilter] = useState<BookingStatus | 'all'>('all');
  const [availForm, setAvailForm] = useState({ date: '', startTime: '', endTime: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(apiUrl('/bookings?limit=50'), {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const payload = await res.json();
      if (payload && payload.data) {
        const mapped = payload.data.map((pb: any) => {
          const st = new Date(pb.start_time);
          const et = new Date(pb.end_time);
          return {
            id: pb.id,
            studentId: pb.student_id,
            studentName: 'Student User',
            instructorId: pb.instructor_id,
            instructorName: 'Instructor User',
            tenantId: pb.tenant_id,
            title: 'Flight Training',
            date: st.toISOString().split('T')[0],
            startTime: st.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
            endTime: et.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
            status: normalizeBookingStatus(pb.status),
            notes: '',
          };
        });
        setBookings(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const fetchAvailabilities = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(apiUrl('/availability?limit=100'), {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const payload = await res.json();
      if (payload && payload.data) {
        setAvailabilities(payload.data);
      }
    } catch (err) {
      console.error('Failed to fetch availabilities:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchBookings(), fetchAvailabilities()]).finally(() => setIsLoading(false));
  }, [user]);

  if (!user) return null;

  const weekDates = getWeekDates(currentWeek);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const visibleBookings = bookings.filter(b => {
    const tenantMatch = b.tenantId === user.tenantId;
    const roleFilter = user.role === 'student' ? b.studentId === user.id : user.role === 'instructor' ? b.instructorId === user.id : true;
    const statusFilter = activeFilter === 'all' || b.status === activeFilter;
    return tenantMatch && roleFilter && statusFilter;
  });

  const weekBookings = visibleBookings.filter(b => {
    const bDate = new Date(b.date);
    return bDate >= weekStart && bDate <= weekEnd;
  });

  const handleApprove = async (bookingId: string) => {
    if (!user?.token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/bookings/${bookingId}/approve`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) await fetchBookings();
      else setError('Failed to approve booking');
    } catch (err) {
      setError('Failed to approve booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!user?.token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/bookings/${bookingId}/cancel`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) await fetchBookings();
      else setError('Failed to cancel booking');
    } catch (err) {
      setError('Failed to cancel booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBook = async () => {
    if (!selectedAvailability || !bookingTitle.trim() || !user?.token) return;
    const avail = availabilities.find(a => a.id === selectedAvailability);
    if (!avail) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/bookings'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: avail.instructor_id,
          student_id: user.id,
          start_time: avail.start_time,
          end_time: avail.end_time,
        })
      });

      if (res.ok) {
        await fetchBookings();
        await fetchAvailabilities();
        setShowBookingForm(false);
        setBookingTitle('');
        setSelectedAvailability(null);
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Failed to create booking');
      }
    } catch (err) {
      setError('Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!availForm.date || !availForm.startTime || !availForm.endTime || !user?.token) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const startDateTime = new Date(`${availForm.date}T${availForm.startTime}`).toISOString();
      const endDateTime = new Date(`${availForm.date}T${availForm.endTime}`).toISOString();

      const res = await fetch(apiUrl('/availability'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: startDateTime, end_time: endDateTime })
      });

      if (res.ok) {
        await fetchAvailabilities();
        setShowAvailForm(false);
        setAvailForm({ date: '', startTime: '', endTime: '' });
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Failed to save availability');
      }
    } catch (err) {
      setError('Failed to save availability');
    } finally {
      setIsSubmitting(false);
    }
  };

  const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

      {error && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">{error}</div>}

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {(['all', 'pending', 'approved', 'assigned', 'completed', 'cancelled'] as const).map(f => (
          <button key={f} onClick={() => setActiveFilter(f)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all capitalize whitespace-nowrap ${activeFilter === f ? 'gradient-sky text-primary-foreground' : 'bg-muted border border-border'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold flex items-center gap-2 text-sm md:text-base">
            <Calendar className="w-4 h-4 text-primary" />
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={() => {const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d);}} className="p-1.5 rounded-lg bg-muted hover:bg-secondary border border-border">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentWeek(new Date())} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-secondary border border-border">Today</button>
            <button onClick={() => {const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d);}} className="p-1.5 rounded-lg bg-muted hover:bg-secondary border border-border">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const dateStr = formatDate(date);
            const dayBookings = weekBookings.filter(b => b.date === dateStr);
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div key={i} className={`min-h-[90px] rounded-lg p-1.5 ${isToday ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-border/40'}`}>
                <div className={`text-center mb-1.5 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className="text-[10px] font-medium">{WEEK_DAYS[i]}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>{date.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {dayBookings.map(b => {
                    const cfg = STATUS_CONFIG[b.status];
                    return <div key={b.id} className={`text-[9px] leading-tight p-1 rounded ${cfg.className} truncate`} title={`${b.title} · ${b.startTime}–${b.endTime}`}>{b.startTime} {b.title}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="font-display font-semibold mb-4">All Bookings</h2>
        {isLoading ? <div className="text-center py-8 text-muted-foreground text-sm">Loading bookings...</div> : visibleBookings.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No bookings found.</div> : (
          <div className="space-y-3">
            {visibleBookings.map(b => {
              const cfg = STATUS_CONFIG[b.status];
              return (
                <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start justify-between p-4 bg-muted/50 border border-border rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.icon}{cfg.label}</span>
                    </div>
                    <div className="font-medium text-sm">{b.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.date} · {b.startTime}–{b.endTime}</span>
                    </div>
                  </div>

                  {user.role === 'admin' && b.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0 ml-3">
                      <button onClick={() => handleApprove(b.id)} disabled={isSubmitting} className="px-3 py-1.5 text-xs gradient-sky text-primary-foreground rounded-lg font-medium disabled:opacity-50">Approve</button>
                      <button onClick={() => handleCancel(b.id)} disabled={isSubmitting} className="px-3 py-1.5 text-xs bg-destructive/10 text-destructive rounded-lg disabled:opacity-50">Cancel</button>
                    </div>
                  )}

                  {user.role === 'student' && b.status === 'pending' && (
                    <button onClick={() => handleCancel(b.id)} disabled={isSubmitting} className="px-3 py-1.5 text-xs bg-destructive/10 text-destructive rounded-lg disabled:opacity-50">Cancel</button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {showBookingForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass-card rounded-2xl p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Book a Training Session</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Available Slots</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availabilities.map(slot => {
                    const startTime = new Date(slot.start_time);
                    const endTime = new Date(slot.end_time);
                    const slotDate = startTime.toISOString().split('T')[0];
                    const slotStart = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                    const slotEnd = endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                    return (
                      <button key={slot.id} onClick={() => setSelectedAvailability(slot.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm ${selectedAvailability === slot.id ? 'border-primary/50 bg-primary/10' : 'border-border bg-muted/30'}`}>
                        <span>{slotDate}</span>
                        <span className="text-muted-foreground">{slotStart} – {slotEnd}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Session Title</label>
                <input type="text" value={bookingTitle} onChange={e => setBookingTitle(e.target.value)} placeholder="e.g. Pre-Solo Flight Briefing" className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowBookingForm(false); setError(null); }} className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm">Cancel</button>
                <button onClick={handleBook} disabled={!selectedAvailability || !bookingTitle.trim() || isSubmitting} className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40">{isSubmitting ? 'Booking...' : 'Request Booking'}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {showAvailForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Set Availability</h2>
                <button onClick={() => { setShowAvailForm(false); setError(null); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Date</label>
                  <input type="date" value={availForm.date} onChange={e => setAvailForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Start Time</label>
                    <input type="time" value={availForm.startTime} onChange={e => setAvailForm(f => ({ ...f, startTime: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">End Time</label>
                    <input type="time" value={availForm.endTime} onChange={e => setAvailForm(f => ({ ...f, endTime: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setShowAvailForm(false); setAvailForm({ date: '', startTime: '', endTime: '' }); setError(null); }} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveAvailability} disabled={!availForm.date || !availForm.startTime || !availForm.endTime || isSubmitting} className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40">{isSubmitting ? 'Saving...' : 'Save Slot'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

