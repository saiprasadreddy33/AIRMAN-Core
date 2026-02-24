export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  tenantId: string;
  tenantName: string;
  token?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  tenantId: string;
  moduleCount: number;
  enrolledCount: number;
  createdAt: string;
  thumbnail?: string;
  category: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  lessonCount: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  type: 'text' | 'quiz';
  order: number;
  content?: string;
  duration?: number;
}

export interface QuizQuestion {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  lessonId: string;
  studentId: string;
  answers: number[];
  score: number;
  total: number;
  completedAt: string;
  incorrectQuestions: string[];
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  progress: number;
  enrolledAt: string;
  completedLessons: string[];
}

export type BookingStatus = 'requested' | 'pending' | 'approved' | 'assigned' | 'completed' | 'cancelled';

export interface Availability {
  id: string;
  instructorId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  studentId: string;
  studentName: string;
  instructorId?: string;
  instructorName?: string;
  availabilityId?: string;
  tenantId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  requestedAt?: string;
  approvedAt?: string;
  assignedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;
  correlationId: string;
}
