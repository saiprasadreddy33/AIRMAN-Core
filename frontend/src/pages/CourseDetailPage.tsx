import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, BookOpen, FileQuestion, ChevronDown, ChevronUp, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { ENROLLMENTS } from '@/lib/data';
import { apiUrl } from '@/lib/api';

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) ?? "";
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.token || !id) return;

    Promise.all([
      fetch(apiUrl('/courses?limit=100'), { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json()),
      fetch(apiUrl(`/courses/${id}/modules`), { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json())
    ])
    .then(([coursesPayload, modulesPayload]) => {
      const found = coursesPayload.data?.find((c: any) => c.id === id);
      if (found) setCourse(found);
      if (modulesPayload.data) setModules(modulesPayload.data);
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [id, user]);

  if (isLoading) return <div className="p-6 text-muted-foreground animate-pulse">Loading Course Data over Network...</div>;
  if (!course || !user) return <div className="p-6 text-muted-foreground">Course not found on Backend.</div>;

  const enrollment = ENROLLMENTS.find(e => e.courseId === course.id && e.studentId === user.id);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl gradient-sky flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium">{course.category || 'General'}</span>
              <h1 className="font-display text-xl font-semibold mt-2 mb-1">{course.title}</h1>
              <p className="text-sm text-muted-foreground">{course.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>By {course.instructorName || 'Academy Staff'}</span>
                <span>{modules.length} modules</span>
                <span>{course.enrolledCount || 0} students</span>
              </div>
            </div>
          </div>

          {enrollment && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="text-muted-foreground">Your progress</span>
                <span className="text-primary font-medium">{enrollment.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="progress-bar h-2 rounded-full transition-all" style={{ width: `${enrollment.progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <h2 className="font-display font-semibold mb-3">Course Modules</h2>
        <div className="space-y-3">
          {modules.map((mod, mi) => {
            const lessons = mod.lessons || [];
            const isExpanded = expandedModule === mod.id;

            return (
              <div key={mod.id} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {mi + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{mod.title}</div>
                    <div className="text-xs text-muted-foreground">{lessons.length} lessons</div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-border"
                  >
                    {lessons.map((lesson, li) => {
                      const isCompleted = enrollment?.completedLessons.includes(lesson.id);
                      const canAccess = user.role !== 'student' || li === 0 || enrollment?.completedLessons.includes(lessons[li - 1]?.id);

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => canAccess && router.push(`/courses/${course.id}/lesson/${lesson.id}`)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 last:border-0 transition-colors ${
                            canAccess ? 'hover:bg-muted/30 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="w-5 flex-shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-success" />
                            ) : !canAccess ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : lesson.type === 'quiz' ? (
                              <FileQuestion className="w-4 h-4 text-warning" />
                            ) : (
                              <BookOpen className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <span className="text-sm flex-1">{lesson.title}</span>
                          <div className="flex items-center gap-2">
                            {lesson.type === 'quiz' && <span className="badge-warning text-[10px] px-1.5 py-0.5 rounded font-medium">Quiz</span>}
                            {lesson.duration && <span className="text-xs text-muted-foreground">{lesson.duration}m</span>}
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
