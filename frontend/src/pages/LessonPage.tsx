import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, BookOpen, Loader2, Wifi, WifiOff, Cloud } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useOfflineQuiz } from '@/hooks/use-offline-quiz';

interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'TEXT' | 'MCQ';
  module_id: string;
  questions?: Question[];
}

interface Question {
  id: string;
  question: string;
  options: string[];
}

interface QuizResult {
  attemptId: string;
  score: number;
  total: number;
  incorrectQuestions: Array<{ questionId: string; correctAnswer: number }>;
}

export default function LessonPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const courseId = (params?.id as string) ?? "";
  const lessonId = (params?.lessonId as string) ?? "";
  const { user } = useAuth();
  const router = useRouter();

  // Destructure stable references from the hook — avoids new object reference on every render
  const { state: offlineState, cacheQuiz, createLocalAttempt, updateLocalAttempt, syncAttempts } = useOfflineQuiz();
  const [localAttemptId, setLocalAttemptId] = useState<string | null>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/lessons/${lessonId}`);
        setLesson(data);

        // Cache quiz for offline access
        if (data.type === 'MCQ') {
          await cacheQuiz(data);
        }

        setError(null);
      } catch (err) {
        setError('Failed to load lesson');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (lessonId && user) {
      fetchLesson();
    }
  // cacheQuiz is wrapped in useCallback([]) so its reference is stable across renders
  }, [lessonId, user, cacheQuiz]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lesson || !user) {
    return (
      <div className="p-6 rounded-lg bg-destructive/10 text-destructive">
        {error || 'Lesson not found.'}
      </div>
    );
  }

  const handleSubmitQuiz = async () => {
    if (lesson?.type !== 'MCQ' || !lesson.questions) return;

    try {
      setSubmitting(true);
      const answers = lesson.questions.map(q => ({
        questionId: q.id,
        answer: selectedAnswers[q.id] ?? -1,
      }));

      // If online, submit to server immediately
      if (offlineState.isOnline) {
        const result = await api.post(`/lessons/${lessonId}/attempt`, { answers });
        setQuizResult(result);
        setSubmitted(true);
        setShowResult(true);
      } else {
        // If offline, save locally first
        if (!localAttemptId) {
          const id = await createLocalAttempt(lessonId);
          setLocalAttemptId(id);
          await updateLocalAttempt(id, answers, true);
        } else {
          await updateLocalAttempt(localAttemptId, answers, true);
        }

        // Grade locally using stored quiz data
        const storedQuiz = await import('@/lib/offline-quiz').then(m => m.getStoredQuiz(lessonId));
        if (storedQuiz) {
          // Show local result (without correctness info - that comes after sync)
          setQuizResult({
            attemptId: localAttemptId || 'local',
            score: answers.length,
            total: lesson.questions.length,
            incorrectQuestions: [],
          });
          setSubmitted(true);
          setShowResult(true);
        }
      }
    } catch (err) {
      console.error('Quiz submission failed:', err);
      setError('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = () => {
    router.push(`/courses/${courseId}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Course
        </Link>

        {/* Offline Status Indicator */}
        <div className="flex items-center gap-2">
          {offlineState.isOnline ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-success/10 text-success">
              <Wifi className="w-3 h-3" />
              Online
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-warning/10 text-warning">
              <WifiOff className="w-3 h-3" />
              Offline
            </div>
          )}

          {offlineState.pendingAttempts > 0 && (
            <button
              onClick={() => syncAttempts()}
              disabled={offlineState.syncInProgress}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {offlineState.syncInProgress ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
              Sync ({offlineState.pendingAttempts})
            </button>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card rounded-xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-1">
            {lesson.type === 'MCQ' ? (
              <span className="badge-warning text-xs px-2 py-0.5 rounded font-medium">Quiz</span>
            ) : (
              <span className="badge-info text-xs px-2 py-0.5 rounded font-medium">Reading</span>
            )}
          </div>
          <h1 className="font-display text-xl font-semibold mb-4">{lesson.title}</h1>

          {lesson.type === 'TEXT' && lesson.content && (
            <div className="prose-lesson">
              {lesson.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h2 key={i} className="font-display font-bold text-lg mt-6 mb-2 first:mt-0">{line.replace('# ', '')}</h2>;
                if (line.startsWith('## ')) return <h3 key={i} className="font-display font-semibold text-base mt-4 mb-2">{line.replace('## ', '')}</h3>;
                if (line.startsWith('### ')) return <h4 key={i} className="font-display font-semibold text-sm mt-3 mb-1">{line.replace('### ', '')}</h4>;
                if (line.startsWith('- **')) {
                  const match = line.match(/- \*\*(.*?)\*\*\s*[–-]\s*(.*)/);
                  if (match) return <div key={i} className="flex gap-2 mb-1"><span className="text-primary font-medium text-sm">{match[1]}:</span><span className="text-sm text-muted-foreground">{match[2]}</span></div>;
                }
                if (line.startsWith('- ')) return <li key={i} className="text-sm text-muted-foreground ml-4 mb-1">{line.replace('- ', '')}</li>;
                if (line.startsWith('**')) {
                  const clean = line.replace(/\*\*(.*?)\*\*/g, '$1');
                  return <p key={i} className="text-sm font-semibold mb-2">{clean}</p>;
                }
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="text-sm text-muted-foreground mb-2 leading-relaxed">{line}</p>;
              })}
            </div>
          )}

          {lesson.content && (
            <p className="text-sm text-muted-foreground leading-relaxed">{lesson.content}</p>
          )}

          {lesson.type === 'TEXT' && (
            <button
              onClick={handleComplete}
              className="mt-6 flex items-center gap-2 gradient-sky text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {lesson.type === 'MCQ' && lesson.questions && (
          <div className="space-y-4">
            {!showResult && (
              <p className="text-sm text-muted-foreground mb-4">
                Answer {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''} to complete this quiz.
              </p>
            )}

            {lesson.questions.map((q, qi) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qi * 0.08 }}
                className="glass-card rounded-xl p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary mt-0.5">
                    {qi + 1}
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                </div>

                <div className="space-y-2 ml-9">
                  {q.options.map((opt, oi) => {
                    const isSelected = selectedAnswers[q.id] === oi;
                    const isCorrect = quizResult?.incorrectQuestions?.some(x => x.questionId === q.id && x.correctAnswer !== oi) === false && quizResult?.score ? oi === quizResult.incorrectQuestions.find(x => x.questionId === q.id)?.correctAnswer || (selectedAnswers[q.id] === oi && !quizResult.incorrectQuestions.some(x => x.questionId === q.id)) : false;

                    let optClass = 'border-border bg-muted/30 hover:bg-muted/60';

                    if (showResult) {
                      const qResult = quizResult?.incorrectQuestions.find(x => x.questionId === q.id);
                      if (isSelected && !qResult) optClass = 'border-success/40 bg-success/10';
                      else if (isSelected && qResult) optClass = 'border-destructive/40 bg-destructive/10';
                      else if (qResult && oi === qResult.correctAnswer) optClass = 'border-success/40 bg-success/10';
                    } else if (isSelected) {
                      optClass = 'border-primary/40 bg-primary/10';
                    }

                    return (
                      <button
                        key={oi}
                        onClick={() => !showResult && setSelectedAnswers(prev => ({ ...prev, [q.id]: oi }))}
                        disabled={showResult}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${optClass}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          showResult && quizResult?.incorrectQuestions.some(x => x.questionId === q.id && x.correctAnswer === oi)
                            ? 'border-success'
                            : showResult && isSelected && quizResult?.incorrectQuestions.some(x => x.questionId === q.id)
                            ? 'border-destructive'
                            : isSelected
                            ? 'border-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {isSelected && !showResult && <div className="w-2 h-2 rounded-full bg-primary" />}
                          {showResult && quizResult?.incorrectQuestions.some(x => x.questionId === q.id && x.correctAnswer === oi) && <CheckCircle className="w-3 h-3 text-success" />}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}

            {!showResult && (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(selectedAnswers).length !== lesson.questions.length}
                className="mt-6 w-full flex items-center justify-center gap-2 gradient-sky text-primary-foreground px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Submit Quiz
              </button>
            )}

            {showResult && quizResult && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 mt-6 text-center"
              >
                {!offlineState.isOnline && (
                  <div className="mb-4 p-3 rounded-lg bg-warning/10 text-warning text-xs flex items-center gap-2 justify-center">
                    <WifiOff className="w-3 h-3" />
                    This attempt is saved locally. Results will sync when you're back online.
                  </div>
                )}

                <div className="text-4xl font-display font-bold mb-2">
                  {quizResult.score}/{quizResult.total}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {quizResult.score === quizResult.total
                    ? 'Perfect! You got all questions correct!'
                    : offlineState.isOnline
                    ? `${Math.round((quizResult.score / quizResult.total) * 100)}% correct`
                    : 'Answer submitted'}
                </p>
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 gradient-sky text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity mx-auto"
                >
                  <CheckCircle className="w-4 h-4" />
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
