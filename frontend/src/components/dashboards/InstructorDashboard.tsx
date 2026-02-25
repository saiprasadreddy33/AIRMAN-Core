import { motion } from 'framer-motion';
import { BookOpen, Calendar, Users, CheckCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { User, Booking, Course } from '../../types';
import { StatCard } from '../StatCard';
import { PageHeader } from '../PageHeader';
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────────────

const toLocalDateStr = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
};
const toLocalTimeStr = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

interface RawBooking {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  tenant_id?: string;
  created_at?: string;
  instructor?: { id: string; name?: string; email: string };
  student?: { id: string; name?: string; email: string };
  escalation_required?: boolean;
}

interface RawCourse {
  id: string;
  title: string;
  category?: string;
  module_count?: number;
  enrolled_count?: number;
}

const mapBooking = (b: RawBooking): Booking => ({
  id: b.id,
  status: b.status as Booking['status'],
  date: toLocalDateStr(b.start_time),
  startTime: toLocalTimeStr(b.start_time),
  endTime: toLocalTimeStr(b.end_time),
  instructorId: b.instructor?.id ?? '',
  instructorName: b.instructor?.name ?? b.instructor?.email ?? 'Instructor',
  studentId: b.student?.id ?? '',
  studentName: b.student?.name ?? b.student?.email ?? 'Student',
  tenantId: b.tenant_id ?? '',
  title: '',
  createdAt: b.created_at ?? '',
  escalationRequired: b.escalation_required ?? false,
});

// ── component ─────────────────────────────────────────────────────────────────

export default function InstructorDashboard({ user }: { user: User }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courses, setCourses] = useState<RawCourse[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  const fetchData = useCallback(async () => {
    if (!user?.token) return;
    setIsLoading(true);
    try {
      const [studentsData, coursesData, bookingsData] = await Promise.all([
        api.get<any>('/users?limit=1000&role=student'),
        api.get<any>('/courses?limit=100'),
        api.get<any>('/bookings?limit=100'),
      ]);
      setTotalStudents((studentsData.data || []).length);
      setCourses(coursesData.data || []);
      setBookings((bookingsData.data || []).map(mapBooking));
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return null;

  const pendingRequests = bookings.filter(b => b.status === 'requested');
  const upcomingBookings = bookings.filter(b => b.status === 'approved' || b.status === 'assigned');

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/bookings/${id}/approve`);
      await fetchData();
      toast.success('Booking approved!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to approve booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionLoading(`cancel-${id}`);
    try {
      await api.patch(`/bookings/${id}/cancel`);
      await fetchData();
      toast.success('Booking declined');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to decline booking');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={`Hello, ${user.name}`}
        subtitle={`${user.tenantName} · Instructor Portal`}
      />

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div variants={item}>
          <StatCard title="My Courses" value={isLoading ? '…' : courses.length} icon={BookOpen} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Upcoming Sessions" value={isLoading ? '…' : upcomingBookings.length} icon={Calendar} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Total Students" value={isLoading ? '…' : totalStudents} change="+3" positive icon={Users} />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Pending requests that need approval */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600">
                {pendingRequests.length}
              </span>
            )}
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Loading…
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map(b => (
                <div key={b.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-medium">{b.studentName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />{b.date} · {b.startTime}–{b.endTime}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-medium flex-shrink-0">
                      requested
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(b.id)}
                      disabled={!!actionLoading}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg font-medium gradient-sky text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {actionLoading === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecline(b.id)}
                      disabled={!!actionLoading}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming sessions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Upcoming Sessions
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Loading…
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm">No upcoming sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(b => (
                <div key={b.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{b.studentName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{b.date} · {b.startTime}–{b.endTime}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      b.status === 'assigned' ? 'bg-blue-500/15 text-blue-600' : 'bg-green-500/15 text-green-600'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* My courses */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5 xl:col-span-2">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            My Courses
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Loading…
            </div>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No courses found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {courses.map(course => (
                <div key={course.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="text-sm font-medium">{course.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground">
                      {course.module_count ?? 0} modules · {course.enrolled_count ?? 0} students
                    </div>
                    {course.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{course.category}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
