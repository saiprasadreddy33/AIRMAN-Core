import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

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
  }, [lessonId, user]);

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
    if (lesson.type !== 'MCQ' || !lesson.questions) return;

    try {
      setSubmitting(true);
      const answers = lesson.questions.map(q => ({
        questionId: q.id,
        answer: selectedAnswers[q.id] ?? -1,
      }));

      const result = await api.post(`/lessons/${lessonId}/attempt`, { answers });
      setQuizResult(result);
      setSubmitted(true);
      setShowResult(true);
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
      <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Course
      </Link>

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
                <div className="text-4xl font-display font-bold mb-2">
                  {quizResult.score}/{quizResult.total}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {quizResult.score === quizResult.total
                    ? 'Perfect! You got all questions correct!'
                    : `${Math.round((quizResult.score / quizResult.total) * 100)}% correct`}
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
