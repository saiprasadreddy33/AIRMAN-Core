import { motion } from 'framer-motion';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, TrendingUp, Users, BookOpen, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

export default function ReportsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    activeCourses: 0,
    pendingBookings: 0,
    completionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;

    const fetchStats = async () => {
      try {
        const [studentsRes, coursesRes, bookingsRes] = await Promise.all([
          fetch(apiUrl('/users?limit=1000&role=student'), {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(apiUrl('/courses?limit=100'), {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(apiUrl('/bookings?limit=100'), {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);

        const studentsData = await studentsRes.json();
        const coursesData = await coursesRes.json();
        const bookingsData = await bookingsRes.json();

        const students = (studentsData.data || []).length;
        const courses = (coursesData.data || []).length;
        const bookings = (bookingsData.data || []).filter((b: any) => b.status === 'requested').length;

        setStats({
          totalStudents: students,
          activeCourses: courses,
          pendingBookings: bookings,
          completionRate: Math.round(Math.random() * 30 + 70), // Placeholder
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (!user) return null;

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, change: '+12', icon: Users },
    { label: 'Active Courses', value: stats.activeCourses, change: '+2', icon: BookOpen },
    { label: 'Pending Bookings', value: stats.pendingBookings, change: '+0', icon: Calendar },
    { label: 'Avg Completion', value: `${stats.completionRate}%`, change: '+4%', icon: TrendingUp },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Reports & Analytics" subtitle="Training performance insights" />

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Loading real data from API...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="stat-card rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-success font-medium">{s.change}</span>
                </div>
                <div className="font-display text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-xl p-5"
            >
              <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Course Completion Rates
              </h2>
              <div className="space-y-4">
                {[
                  { name: 'PPL Theory', rate: 78 },
                  { name: 'Instrument Rating', rate: 62 },
                  { name: 'Aviation Meteorology', rate: 91 },
                ].map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="font-medium text-primary">{c.rate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.rate}%` }}
                        transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                        className="progress-bar h-2 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card rounded-xl p-5"
            >
              <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Monthly Session Distribution
              </h2>
              <div className="flex items-end gap-2 h-32">
                {[65, 80, 55, 90, 70, 85, 75, 95, 60, 88, 72, 100].map((val, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${val}%` }}
                    transition={{ delay: 0.4 + i * 0.03, duration: 0.4, ease: 'easeOut' }}
                    className="flex-1 gradient-sky rounded-t opacity-80 hover:opacity-100 transition-opacity"
                    title={`Month ${i + 1}: ${val} sessions`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>Jan</span><span>Jun</span><span>Dec</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
