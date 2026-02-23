import { motion } from 'framer-motion';
import { BookOpen, Calendar, Trophy, Clock } from 'lucide-react';
import { User } from '../../types';
import { StatCard } from '../StatCard';
import { useEffect, useState } from 'react';
import { PageHeader } from '../PageHeader';
import { apiUrl } from '@/lib/api';

function normalizeBookingStatus(status: string): string {
  return status === 'requested' ? 'pending' : status;
}

export default function StudentDashboard({ user }: { user: User }) {
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.token) return;
    Promise.all([
      fetch(apiUrl('/bookings?limit=50'), { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json()),
      fetch(apiUrl('/courses?limit=50'), { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json())
    ]).then(([bData, cData]) => {
      if (bData.data) {
        const mappedBooks = bData.data.map((pb: any) => ({
          id: pb.id,
          title: 'Scheduled Flight Session',
          status: normalizeBookingStatus(pb.status),
          date: new Date(pb.start_time).toISOString().split('T')[0],
          startTime: new Date(pb.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
          endTime: new Date(pb.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
          instructorName: 'Instructor',
          studentId: pb.student_id
        }));
        setMyBookings(mappedBooks.filter((b: any) => b.studentId === user.id));
      }
      if (cData.data) {
        setCourses(cData.data);
      }
    }).catch(console.error);
  }, [user]);

  const upcomingBookings = myBookings.filter(b => ['pending', 'approved', 'assigned'].includes(b.status));

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle={`${user.tenantName} · Student Portal`}
      />

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <motion.div variants={item}>
          <StatCard title="Enrolled Courses" value={myEnrollments.length} icon={BookOpen} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Upcoming Sessions" value={upcomingBookings.length} icon={Calendar} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Study Streak" value="7 days" change="+1" positive icon={Trophy} iconColor="text-warning" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Study Hours" value="1,250" icon={Clock} />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            My Courses
          </h2>
          <div className="space-y-4">
            {myEnrollments.length === 0 ? (
              <div className="text-sm py-4 text-muted-foreground">No active enrollments on server.</div>
            ) : myEnrollments.map(enrollment => {
              const course = courses.find(c => c.id === enrollment.courseId);
              if (!course) return null;
              return (
                <div key={enrollment.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium">{course.title}</div>
                    <span className="text-xs text-primary font-medium">{enrollment.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-1">
                    <div
                      className="progress-bar h-1.5 rounded-full transition-all"
                      style={{ width: `${enrollment.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">{enrollment.completedLessons?.length || 0} lessons completed</div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Upcoming Sessions
          </h2>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No upcoming sessions. Book a flight lesson from Schedule.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(b => (
                <div key={b.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium">{b.title}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                      b.status === 'approved' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.date} · {b.startTime}–{b.endTime}
                    {b.instructorName && ` · ${b.instructorName}`}
                  </div>
                  {b.notes && <div className="text-xs text-muted-foreground mt-1 italic">{b.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
