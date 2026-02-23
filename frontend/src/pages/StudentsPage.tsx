import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { Users, X, TrendingUp, Clock, Calendar } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  progress: number;
  hours: number;
  lastSeen: string;
  coursesEnrolled: number;
  quizAvg: number;
}

const STUDENTS: Student[] = [
  { id: '1', name: 'Cadet James Wilson', email: 'student@alpha-aviation.com', progress: 45, hours: 42, lastSeen: '2026-02-20', coursesEnrolled: 2, quizAvg: 72 },
  { id: '2', name: 'Cadet Anna Park', email: 'anna@alpha-aviation.com', progress: 78, hours: 68, lastSeen: '2026-02-19', coursesEnrolled: 3, quizAvg: 88 },
  { id: '3', name: 'Cadet Tom Bauer', email: 'tom@alpha-aviation.com', progress: 23, hours: 18, lastSeen: '2026-02-17', coursesEnrolled: 1, quizAvg: 61 },
  { id: '4', name: 'Cadet Maya Singh', email: 'maya@alpha-aviation.com', progress: 91, hours: 95, lastSeen: '2026-02-20', coursesEnrolled: 4, quizAvg: 94 },
];

export default function StudentsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Student | null>(null);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Students" subtitle="Track cadet progress and performance" />

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{STUDENTS.length} active students</span>
        </div>
        <div className="divide-y divide-border">
          {STUDENTS.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(s)}
              className="w-full px-4 md:px-5 py-4 flex items-center gap-3 md:gap-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full gradient-sky flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 max-w-24 bg-muted rounded-full h-1.5">
                    <div className="progress-bar h-1.5 rounded-full" style={{ width: `${s.progress}%` }} />
                  </div>
                  <span className="text-xs text-primary font-medium">{s.progress}%</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-medium">{s.hours}h</div>
                <div className="text-xs text-muted-foreground">flight hours</div>
                <div className="text-[10px] text-muted-foreground mt-1 hidden sm:block">Last: {s.lastSeen}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-2xl p-6"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full gradient-sky flex items-center justify-center text-primary-foreground font-bold">
                    {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-display font-semibold">{selected.name}</div>
                    <div className="text-xs text-muted-foreground">{selected.email}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Overall Progress', value: `${selected.progress}%`, icon: TrendingUp },
                  { label: 'Flight Hours', value: `${selected.hours}h`, icon: Clock },
                  { label: 'Courses Enrolled', value: `${selected.coursesEnrolled}`, icon: Users },
                  { label: 'Quiz Average', value: `${selected.quizAvg}%`, icon: TrendingUp },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/50 border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className="font-display font-bold text-lg">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Training completion</span>
                  <span className="text-primary font-medium">{selected.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${selected.progress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="progress-bar h-2 rounded-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                Last active: {selected.lastSeen}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
