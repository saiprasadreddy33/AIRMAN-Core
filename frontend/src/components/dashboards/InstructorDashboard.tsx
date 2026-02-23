import { motion } from 'framer-motion';
import { BookOpen, Calendar, Users, CheckCircle } from 'lucide-react';
import { User } from '../../types';
import { StatCard } from '../StatCard';
import { PageHeader } from '../PageHeader';
import { BOOKINGS, COURSES, LESSONS } from '../../lib/data';

export default function InstructorDashboard({ user }: { user: User }) {
  const myCourses = COURSES.filter(c => c.instructorId === user.id);
  const myBookings = BOOKINGS.filter(b => b.instructorId === user.id);
  const upcomingBookings = myBookings.filter(b => b.status === 'approved' || b.status === 'assigned');

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={`Hello, ${user.name}`}
        subtitle={`${user.tenantName} · Instructor Portal`}
      />

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div variants={item}>
          <StatCard title="My Courses" value={myCourses.length} icon={BookOpen} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Upcoming Sessions" value={upcomingBookings.length} icon={Calendar} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Total Students" value="48" change="+3" positive icon={Users} />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Upcoming Sessions
          </h2>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm">No upcoming sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(b => (
                <div key={b.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium">{b.title}</div>
                    <span className="badge-success text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.studentName} · {b.date} · {b.startTime}–{b.endTime}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            My Courses
          </h2>
          <div className="space-y-3">
            {myCourses.map(course => (
              <div key={course.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                <div className="text-sm font-medium">{course.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground">{course.moduleCount} modules · {LESSONS.filter(l => LESSONS.find(() => true)).length > 0 ? course.enrolledCount : 0} students</div>
                  <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium">{course.category}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
