import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import InstructorDashboard from '../components/dashboards/InstructorDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {user.role === 'admin' && <AdminDashboard user={user} />}
      {user.role === 'instructor' && <InstructorDashboard user={user} />}
      {user.role === 'student' && <StudentDashboard user={user} />}
    </motion.div>
  );
}
