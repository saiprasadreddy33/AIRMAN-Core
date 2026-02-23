import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Users, Layers, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { useEffect } from 'react';
import { ENROLLMENTS } from '@/lib/data';
import { apiUrl } from '@/lib/api';

export default function CoursesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', category: '', description: '' });
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const PAGE_SIZE = 6;

  useEffect(() => {
    if (!user?.token) return;

    fetch(apiUrl('/courses?limit=50'), {
      headers: { Authorization: `Bearer ${user.token}` }
    })
    .then(res => res.json())
    .then(data => {
      setCourses(data.data || []);
      setIsLoading(false);
    })
    .catch(err => {
      console.error('Failed to fetch courses:', err);
      setIsLoading(false);
    });
  }, [user]);

  if (!user) return null;

  let visibleCourses = courses;

  const filtered = visibleCourses.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    (c.category || 'General').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getEnrollment = (courseId: string) =>
    ENROLLMENTS.find(e => e.courseId === courseId && e.studentId === user.id);

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim() || !newCourse.description.trim()) return;
    if (!user?.token) return;

    try {
      const res = await fetch(apiUrl('/courses'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          title: newCourse.title,
          description: newCourse.description,
        }),
      });

      if (!res.ok) {
        alert('Failed to create course');
        return;
      }

      const created = await res.json();
      setCourses(prev => [created, ...prev]);
      setShowNewCourse(false);
      setNewCourse({ title: '', category: '', description: '' });
    } catch (err) {
      console.error('Error creating course:', err);
      alert('Error creating course');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Courses"
        subtitle="Maverick Learning Platform"
        action={
          (user.role === 'admin' || user.role === 'instructor') ? (
            <button
              onClick={() => setShowNewCourse(true)}
              className="flex items-center gap-2 gradient-sky text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Course
            </button>
          ) : undefined
        }
      />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full md:max-w-md bg-muted border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Loading your courses via API Protocol...</p>
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No courses found on Backend DB.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {paginated.map((course, i) => {
            const enrollment = getEnrollment(course.id);
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link href={`/courses/${course.id}`} className="block stat-card rounded-xl p-5 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg gradient-sky flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium">{course.category || 'General'}</span>
                  </div>

                  <h3 className="font-display font-semibold text-sm mb-1 leading-tight">{course.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{course.description}</p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {course.moduleCount || 0} modules
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {course.enrolledCount || 0} enrolled
                    </span>
                  </div>

                  {enrollment && (
                    <>
                      <div className="w-full bg-muted rounded-full h-1 mb-1">
                        <div
                          className="progress-bar h-1 rounded-full"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-primary font-medium">{enrollment.progress}% complete</div>
                    </>
                  )}

                  {!enrollment && user.role === 'student' && (
                    <div className="text-xs text-muted-foreground italic">Not enrolled</div>
                  )}

                  <div className="text-xs text-muted-foreground mt-2">By {course.instructorName || 'Academy Staff'}</div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-muted border border-border rounded-lg disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm bg-muted border border-border rounded-lg disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <AnimatePresence>
        {showNewCourse && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Create New Course</h2>
                <button onClick={() => setShowNewCourse(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Course Title</label>
                  <input
                    type="text"
                    value={newCourse.title}
                    onChange={e => setNewCourse(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Advanced Navigation"
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Category</label>
                  <input
                    type="text"
                    value={newCourse.category}
                    onChange={e => setNewCourse(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Navigation, Meteorology"
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
                  <textarea
                    value={newCourse.description}
                    onChange={e => setNewCourse(f => ({ ...f, description: e.target.value }))}
                    placeholder="What will students learn in this course?"
                    rows={3}
                    className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowNewCourse(false)}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCourse}
                    disabled={!newCourse.title.trim() || !newCourse.description.trim()}
                    className="flex-1 px-4 py-2.5 gradient-sky text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    Create Course
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
