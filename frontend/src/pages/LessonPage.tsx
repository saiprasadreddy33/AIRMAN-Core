import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Loader2, Wifi, WifiOff, Cloud, Trophy, Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useOfflineQuiz } from '@/hooks/use-offline-quiz';

const PASS_THRESHOLD = 0.7; // Must match backend constant

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
  passed: boolean;
  incorrectQuestions: Array<{ questionId: string; correctAnswer: number }>;
  lessonCompleted: boolean;
  moduleCompleted: boolean;
  courseCompleted: boolean;
  /** True when submitted offline — answers saved locally, real score pending sync */
  isOfflinePending?: boolean;
}

export default function LessonPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const courseId = (params?.id as string) ?? '';
  const lessonId = (params?.lessonId as string) ?? '';
  const { user } = useAuth();
  const router = useRouter();

  const { state: offlineState, cacheQuiz, createLocalAttempt, updateLocalAttempt, syncAttempts } =
    useOfflineQuiz();
  const [localAttemptId, setLocalAttemptId] = useState<string | null>(null);

  // When sync completes, update quizResult if our offline attempt was synced
  useEffect(() => {
    if (!localAttemptId || !offlineState.syncResults.length) return;
    const myResult = offlineState.syncResults.find((r) => r.clientId === localAttemptId);
    if (!myResult) return;

    if (myResult.serverResult && !myResult.error) {
      const sr = myResult.serverResult;
      const passed = sr.total > 0 && sr.score / sr.total >= PASS_THRESHOLD;
      setQuizResult({
        attemptId: sr.attemptId,
        score: sr.score,
        total: sr.total,
        passed,
        incorrectQuestions: sr.incorrectQuestions ?? [],
        lessonCompleted: sr.lessonCompleted ?? false,
        moduleCompleted: sr.moduleCompleted ?? false,
        courseCompleted: sr.courseCompleted ?? false,
        isOfflinePending: false,
      });
    }
  }, [offlineState.syncResults, localAttemptId]);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/lessons/${lessonId}`);
        setLesson(data);
        if (data.type === 'MCQ') await cacheQuiz(data);
        setError(null);
      } catch (err) {
        setError('Failed to load lesson');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (lessonId && user) fetchLesson();
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

  // ─── TEXT lesson — Mark complete via API ────────────────────────────────────
  const handleMarkTextComplete = async () => {
    try {
      setCompleting(true);
      const result = await api.post(`/lessons/${lessonId}/complete`, {});
      // Navigate back to course with refresh
      router.push(`/courses/${courseId}`);
      if (result.moduleCompleted || result.courseCompleted) {
        // Small delay to let navigation settle, then the course page re-fetches progress
      }
    } catch (err) {
      console.error('Failed to mark lesson complete:', err);
    } finally {
      setCompleting(false);
    }
  };

  // ─── MCQ quiz submit ─────────────────────────────────────────────────────────
  const handleSubmitQuiz = async () => {
    if (lesson?.type !== 'MCQ' || !lesson.questions) return;

    try {
      setSubmitting(true);
      const answers = lesson.questions.map((q) => ({
        questionId: q.id,
        answer: selectedAnswers[q.id] ?? -1,
      }));

      if (offlineState.isOnline) {
        const result = await api.post(`/lessons/${lessonId}/attempt`, { answers });
        const passed = result.score / result.total >= PASS_THRESHOLD;
        setQuizResult({
          ...result,
          passed,
          lessonCompleted: result.lessonCompleted ?? false,
          moduleCompleted: result.moduleCompleted ?? false,
          courseCompleted: result.courseCompleted ?? false,
        });
        setSubmitted(true);
        setShowResult(true);
      } else {
        // Offline — save locally; answers will be graded on sync
        const id = localAttemptId ?? (await createLocalAttempt(lessonId));
        if (!localAttemptId) setLocalAttemptId(id);
        await updateLocalAttempt(id, answers, true);

        setQuizResult({
          attemptId: id,
          score: 0,
          total: lesson.questions.length,
          passed: false,
          incorrectQuestions: [],
          lessonCompleted: false,
          moduleCompleted: false,
          courseCompleted: false,
          isOfflinePending: true,
        });
        setSubmitted(true);
        setShowResult(true);
      }
    } catch (err) {
      console.error('Quiz submission failed:', err);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => router.push(`/courses/${courseId}`);

  // ─── Render TEXT lesson content with basic Markdown ─────────────────────────
  const renderTextContent = (content: string) =>
    content.split('\n').map((line, i) => {
      if (line.startsWith('# '))
        return (
          <h2 key={i} className="font-display font-bold text-lg mt-6 mb-2 first:mt-0">
            {line.replace('# ', '')}
          </h2>
        );
      if (line.startsWith('## '))
        return (
          <h3 key={i} className="font-display font-semibold text-base mt-4 mb-2">
            {line.replace('## ', '')}
          </h3>
        );
      if (line.startsWith('### '))
        return (
          <h4 key={i} className="font-display font-semibold text-sm mt-3 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      const boldBullet = line.match(/^- \*\*(.*?)\*\*\s*[–-]\s*(.*)/);
      if (boldBullet)
        return (
          <div key={i} className="flex gap-2 mb-1">
            <span className="text-primary font-medium text-sm">{boldBullet[1]}:</span>
            <span className="text-sm text-muted-foreground">{boldBullet[2]}</span>
          </div>
        );
      if (line.startsWith('- '))
        return (
          <li key={i} className="text-sm text-muted-foreground ml-4 mb-1">
            {line.replace('- ', '')}
          </li>
        );
      if (line.startsWith('**'))
        return (
          <p key={i} className="text-sm font-semibold mb-2">
            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
          </p>
        );
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return (
        <p key={i} className="text-sm text-muted-foreground mb-2 leading-relaxed">
          {line}
        </p>
      );
    });

  // ─── Quiz option styling helper ──────────────────────────────────────────────
  const getOptionClass = (questionId: string, optionIndex: number): string => {
    if (!showResult) {
      return selectedAnswers[questionId] === optionIndex
        ? 'border-primary/40 bg-primary/10'
        : 'border-border bg-muted/30 hover:bg-muted/60';
    }

    // Offline pending — just highlight selected, no correct/wrong indication
    if (quizResult?.isOfflinePending) {
      return selectedAnswers[questionId] === optionIndex
        ? 'border-primary/40 bg-primary/10 opacity-80'
        : 'border-border bg-muted/30 opacity-50';
    }

    const wrongEntry = quizResult?.incorrectQuestions.find((x) => x.questionId === questionId);
    const userAnswer = selectedAnswers[questionId];
    const isUserAnswer = userAnswer === optionIndex;
    const isCorrectAnswer = wrongEntry?.correctAnswer === optionIndex;
    const userWasWrong = wrongEntry !== undefined;

    if (!userWasWrong && isUserAnswer) return 'border-success/40 bg-success/10'; // Correct pick
    if (userWasWrong && isUserAnswer) return 'border-destructive/40 bg-destructive/10'; // Wrong pick
    if (userWasWrong && isCorrectAnswer) return 'border-success/40 bg-success/10'; // Highlight correct answer
    return 'border-border bg-muted/30 opacity-60';
  };

  const passPercent = quizResult ? Math.round((quizResult.score / quizResult.total) * 100) : 0;
  const allAnswered =
    lesson.questions ? Object.keys(selectedAnswers).length === lesson.questions.length : false;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Course
        </Link>

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
        {/* Lesson card */}
        <div className="glass-card rounded-xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-1">
            {lesson.type === 'MCQ' ? (
              <span className="badge-warning text-xs px-2 py-0.5 rounded font-medium">Quiz</span>
            ) : (
              <span className="badge-info text-xs px-2 py-0.5 rounded font-medium">Reading</span>
            )}
          </div>
          <h1 className="font-display text-xl font-semibold mb-4">{lesson.title}</h1>

          {/* TEXT lesson content */}
          {lesson.type === 'TEXT' && lesson.content && (
            <div className="prose-lesson">{renderTextContent(lesson.content)}</div>
          )}

          {/* TEXT lesson — Mark Complete button */}
          {lesson.type === 'TEXT' && (
            <button
              onClick={handleMarkTextComplete}
              disabled={completing}
              className="mt-6 flex items-center gap-2 gradient-sky text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {completing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Mark Complete &amp; Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* MCQ quiz */}
        {lesson.type === 'MCQ' && lesson.questions && (
          <div className="space-y-4">
            {!showResult && (
              <p className="text-sm text-muted-foreground mb-4">
                Answer all {lesson.questions.length} question
                {lesson.questions.length !== 1 ? 's' : ''} — need ≥70% to pass.
              </p>
            )}

            {lesson.questions.map((q, qi) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qi * 0.06 }}
                className="glass-card rounded-xl p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  {showResult && !quizResult?.isOfflinePending && (
                    <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                      {quizResult?.incorrectQuestions.some((x) => x.questionId === q.id) ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-success" />
                      )}
                    </div>
                  )}
                  {(!showResult || quizResult?.isOfflinePending) && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary mt-0.5">
                      {qi + 1}
                    </div>
                  )}
                  <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                </div>

                <div className="space-y-2 ml-9">
                  {q.options.map((opt, oi) => {
                    // Show tick/cross icon after result
                    const wrongEntry = quizResult?.incorrectQuestions.find(
                      (x) => x.questionId === q.id,
                    );
                    const isUserAnswer = selectedAnswers[q.id] === oi;
                    const isCorrectAnswer = wrongEntry?.correctAnswer === oi;

                    return (
                      <button
                        key={oi}
                        onClick={() =>
                          !showResult && setSelectedAnswers((prev) => ({ ...prev, [q.id]: oi }))
                        }
                        disabled={showResult}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${getOptionClass(q.id, oi)}`}
                      >
                        {/* Radio circle / result icon */}
                        <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center border-muted-foreground">
                          {/* Unsubmitted or offline-pending: just show selected dot */}
                          {(!showResult || quizResult?.isOfflinePending) && isUserAnswer && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                          {/* Online result: show check/x icons */}
                          {showResult && !quizResult?.isOfflinePending && isUserAnswer && !wrongEntry && (
                            <CheckCircle className="w-3 h-3 text-success" />
                          )}
                          {showResult && !quizResult?.isOfflinePending && isUserAnswer && wrongEntry && (
                            <XCircle className="w-3 h-3 text-destructive" />
                          )}
                          {showResult && !quizResult?.isOfflinePending && !isUserAnswer && isCorrectAnswer && (
                            <CheckCircle className="w-3 h-3 text-success" />
                          )}
                        </div>
                        <span className="flex-1">{opt}</span>
                        {showResult && !quizResult?.isOfflinePending && isCorrectAnswer && !isUserAnswer && (
                          <span className="text-[10px] text-success font-medium">Correct Answer</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}

            {/* Submit button */}
            {!showResult && (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting || !allAnswered}
                className="mt-6 w-full flex items-center justify-center gap-2 gradient-sky text-primary-foreground px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {allAnswered
                  ? 'Submit Quiz'
                  : `Answer all questions (${Object.keys(selectedAnswers).length}/${lesson.questions.length})`}
              </button>
            )}

            {/* Quiz result card */}
            <AnimatePresence>
              {showResult && quizResult && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-6 mt-6"
                >
                  {/* Offline-pending banner — answers saved, awaiting sync */}
                  {quizResult.isOfflinePending && (
                    <div className="mb-4 p-3 rounded-lg bg-warning/10 text-warning text-sm flex items-center gap-2">
                      <Cloud className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>Answers saved locally.</strong> Results will appear after syncing online.
                      </span>
                    </div>
                  )}

                  {/* Score — only shown when graded */}
                  {!quizResult.isOfflinePending && (
                    <div className="text-center mb-5">
                      <div
                        className={`text-5xl font-display font-bold mb-1 ${
                          quizResult.passed ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {passPercent}%
                      </div>
                      <div className="text-base font-semibold mb-0.5">
                        {quizResult.score}/{quizResult.total} correct
                      </div>
                      <div
                        className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                          quizResult.passed
                            ? 'bg-success/15 text-success'
                            : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {quizResult.passed ? '✓ Passed' : `✗ Failed — need ${Math.round(PASS_THRESHOLD * 100)}% to pass`}
                      </div>
                    </div>
                  )}

                  {/* Pending score placeholder */}
                  {quizResult.isOfflinePending && (
                    <div className="text-center mb-5">
                      <div className="text-5xl font-display font-bold mb-1 text-muted-foreground">—</div>
                      <div className="text-base font-semibold mb-0.5">{quizResult.total} answered</div>
                      <div className="text-sm font-medium px-3 py-1 rounded-full inline-block bg-muted text-muted-foreground">
                        ⏳ Score pending sync
                      </div>
                    </div>
                  )}

                  {/* Completion propagation banners */}
                  {!quizResult.isOfflinePending &&
                    (quizResult.lessonCompleted ||
                    quizResult.moduleCompleted ||
                    quizResult.courseCompleted) && (
                    <div className="space-y-2 mb-5">
                      {quizResult.lessonCompleted && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 text-success text-sm">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          Lesson marked complete
                        </div>
                      )}
                      {quizResult.moduleCompleted && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 text-primary text-sm">
                          <Star className="w-4 h-4 flex-shrink-0" />
                          Module complete! All lessons done.
                        </div>
                      )}
                      {quizResult.courseCompleted && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 text-warning text-sm font-medium">
                          <Trophy className="w-4 h-4 flex-shrink-0" />
                          🎉 Course complete! Outstanding achievement.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quiz score breakdown */}
                  {!quizResult.isOfflinePending && (
                  <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold text-success">{quizResult.score}</div>
                      <div className="text-xs text-muted-foreground">Correct</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold text-destructive">
                        {quizResult.total - quizResult.score}
                      </div>
                      <div className="text-xs text-muted-foreground">Incorrect</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold">{quizResult.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>
                  )}

                  {/* Pending: show sync button or syncing indicator */}
                  {quizResult.isOfflinePending && (
                    <div className="mb-5">
                      {offlineState.isOnline ? (
                        <button
                          onClick={async () => {
                            const results = await syncAttempts();
                            // UI will update via the useEffect watching syncResults
                          }}
                          disabled={offlineState.syncInProgress}
                          className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {offlineState.syncInProgress ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Syncing...</>
                          ) : (
                            <><Cloud className="w-4 h-4" /> Sync Now to See Results</>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                          <WifiOff className="w-4 h-4" />
                          Connect to internet to sync and see your score
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleContinue}
                    className="w-full flex items-center justify-center gap-2 gradient-sky text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    {quizResult.isOfflinePending ? (
                      <>
                        <ChevronLeft className="w-4 h-4" />
                        Back to Course
                      </>
                    ) : quizResult.passed ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {quizResult.courseCompleted ? 'View Certificate' : 'Continue'}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <ChevronLeft className="w-4 h-4" />
                        Try Again
                      </>
                    )}
                  </button>
                  {!quizResult.isOfflinePending && !quizResult.passed && (
                    <button
                      onClick={() => {
                        setShowResult(false);
                        setSubmitted(false);
                        setSelectedAnswers({});
                        setQuizResult(null);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-muted border border-border hover:bg-secondary transition-colors"
                    >
                      Retake Quiz
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
