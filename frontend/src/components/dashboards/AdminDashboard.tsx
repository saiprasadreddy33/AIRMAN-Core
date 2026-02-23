import { motion } from 'framer-motion';
import { Users, BookOpen, Calendar, ClipboardList, TrendingUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { User } from '../../types';
import { StatCard } from '../StatCard';
import { PageHeader } from '../PageHeader';
import { BOOKINGS, COURSES, AUDIT_LOGS } from '../../lib/data';

export default function AdminDashboard({ user }: { user: User }) {
  const pendingBookings = BOOKINGS.filter(b => b.status === 'pending');
  const recentLogs = AUDIT_LOGS.slice(0, 5);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={`Welcome back, ${user.name}`}
        subtitle={`${user.tenantName} · Admin Portal`}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"
      >
        <motion.div variants={item}>
          <StatCard title="Total Students" value="156" change="+12%" positive icon={Users} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Active Courses" value={COURSES.length} change="+2" positive icon={BookOpen} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Pending Bookings" value={pendingBookings.length} icon={Calendar} iconColor="text-warning" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Compliance Score" value="94%" change="+2%" positive icon={TrendingUp} iconColor="text-success" />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-5"
        >
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            Pending Approvals
          </h2>
          {pendingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map(b => (
                <div key={b.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <div className="text-sm font-medium">{b.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{b.studentName} · {b.date} {b.startTime}–{b.endTime}</div>
                  </div>
                  <span className="badge-warning text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">Pending</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-xl p-5"
        >
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Recent Audit Log
          </h2>
          <div className="space-y-3">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium font-mono">{log.action}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {log.resource} · {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5 xl:col-span-2"
        >
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Course Overview
          </h2>
          <div className="space-y-3">
            {COURSES.filter(c => c.tenantId === user.tenantId).map(course => (
              <div key={course.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{course.title}</div>
                  <div className="text-xs text-muted-foreground">{course.instructorName} · {course.moduleCount} modules</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="text-xs text-muted-foreground">{course.enrolledCount} enrolled</div>
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
