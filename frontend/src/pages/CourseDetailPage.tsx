import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft, BookOpen, FileQuestion, ChevronDown, ChevronUp,
  CheckCircle, Lock, Trophy, Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { api } from '@/lib/api';

interface LessonSummary {
  id: string;
  title: string;
  type: 'TEXT' | 'MCQ';
  status: 'not_started' | 'in_progress' | 'completed';
  completed: boolean;
  completedAt: string | null;
}

interface ModuleProgress {
  id: string;
  title: string;
  moduleStatus: string;
  moduleCompletedAt: string | null;
  lessons: LessonSummary[];
}

interface CourseProgress {
  courseId: string;
  courseStatus: string;
  courseCompletedAt: string | null;
  progressPercent: number;
  totalLessons: number;
  completedLessons: number;
  modules: ModuleProgress[];
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) ?? '';
  const { user } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [modulesWithLessons, setModulesWithLessons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const isStudent = user?.role === 'student';

  const loadData = async () => {
    if (!user?.token || !id) return;
    setIsLoading(true);
    try {
      const [coursesPayload, modulesPayload] = await Promise.all([
        api.get(`/courses?limit=100`),
        api.get(`/courses/${id}/modules?limit=100`),
      ]);

      const found = coursesPayload.data?.find((c: any) => c.id === id);
      if (found) setCourse(found);
      if (modulesPayload.data) setModulesWithLessons(modulesPayload.data);

      // Fetch real per-lesson progress for students
      if (isStudent) {
        const progressData = await api.get(`/courses/${id}/progress`);
        setProgress(progressData);
      }
    } catch (err) {
      console.error('Failed to load course data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  if (isLoading)
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading course…
      </div>
    );

  if (!course || !user)
    return <div className="p-6 text-muted-foreground">Course not found.</div>;

  // Merge API progress into module/lesson data
  const progressModuleMap = new Map(progress?.modules.map((m) => [m.id, m]) ?? []);

  const mergedModules = modulesWithLessons.map((mod) => {
    const pMod = progressModuleMap.get(mod.id);
    const lessons: LessonSummary[] = (mod.lessons ?? []).map((l: any) => {
      const pLesson = pMod?.lessons.find((pl) => pl.id === l.id);
      return {
        id: l.id,
        title: l.title,
        type: l.type as 'TEXT' | 'MCQ',
        status: pLesson?.status ?? 'not_started',
        completed: pLesson?.completed ?? false,
        completedAt: pLesson?.completedAt ?? null,
      };
    });
    return { ...mod, moduleStatus: pMod?.moduleStatus ?? 'not_started', lessons };
  });

  const percent = progress?.progressPercent ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Course header */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl gradient-sky flex items-center justify-center flex-shrink-0">
              {progress?.courseStatus === 'completed' ? (
                <Trophy className="w-6 h-6 text-primary-foreground" />
              ) : (
                <BookOpen className="w-6 h-6 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1">
              <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium">
                {course.category || 'General'}
              </span>
              {progress?.courseStatus === 'completed' && (
                <span className="ml-2 badge-success text-xs px-2 py-0.5 rounded-full font-medium">
                  ✓ Course Complete
                </span>
              )}
              <h1 className="font-display text-xl font-semibold mt-2 mb-1">{course.title}</h1>
              <p className="text-sm text-muted-foreground">{course.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>By {course.instructorName || 'Academy Staff'}</span>
                <span>{mergedModules.length} modules</span>
                {isStudent && progress && (
                  <span>{progress.completedLessons}/{progress.totalLessons} lessons done</span>
                )}
              </div>
            </div>
          </div>

          {/* Real progress bar for students */}
          {isStudent && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="text-muted-foreground">Your progress</span>
                <span className="text-primary font-medium">{percent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="progress-bar h-2 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <h2 className="font-display font-semibold mb-3">Course Modules</h2>
        <div className="space-y-3">
          {mergedModules.map((mod, mi) => {
            const lessons: LessonSummary[] = mod.lessons ?? [];
            const isExpanded = expandedModule === mod.id;
            const modDone = mod.moduleStatus === 'completed';

            return (
              <div key={mod.id} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {modDone ? <CheckCircle className="w-4 h-4 text-success" /> : mi + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {mod.title}
                      {modDone && (
                        <span className="badge-success text-[10px] px-1.5 py-0.5 rounded font-medium">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                      {isStudent && (
                        <> · {lessons.filter((l) => l.completed).length}/{lessons.length} completed</>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-border"
                  >
                    {lessons.map((lesson, li) => {
                      // Sequential unlock: previous lesson must be completed first
                      const prevCompleted = li === 0 || lessons[li - 1]?.completed;
                      const canAccess = !isStudent || prevCompleted;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            canAccess && router.push(`/courses/${id}/lesson/${lesson.id}`)
                          }
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 last:border-0 transition-colors ${
                            canAccess
                              ? 'hover:bg-muted/30 cursor-pointer'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="w-5 flex-shrink-0">
                            {lesson.completed ? (
                              <CheckCircle className="w-4 h-4 text-success" />
                            ) : !canAccess ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : lesson.type === 'MCQ' ? (
                              <FileQuestion className="w-4 h-4 text-warning" />
                            ) : (
                              <BookOpen className="w-4 h-4 text-primary" />
                            )}
                          </div>

                          <span className="text-sm flex-1">{lesson.title}</span>

                          <div className="flex items-center gap-2">
                            {lesson.type === 'MCQ' && (
                              <span className="badge-warning text-[10px] px-1.5 py-0.5 rounded font-medium">
                                Quiz
                              </span>
                            )}
                            {lesson.status === 'in_progress' && !lesson.completed && (
                              <span className="badge-info text-[10px] px-1.5 py-0.5 rounded font-medium">
                                In Progress
                              </span>
                            )}
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
