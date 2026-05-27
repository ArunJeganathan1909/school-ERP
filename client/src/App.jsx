import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchMe } from './store/slices/authSlice';

import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import StudentDashboard from './pages/student/StudentDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

// Phase 3
import CourseList from './pages/shared/CourseList';
import CourseDetail from './pages/shared/CourseDetail';
import ManageCourses from './pages/admin/ManageCourses';
import MyCourses from './pages/student/MyCourses';

// Phase 4 imports
import LessonViewer from './pages/lms/LessonViewer';
import AssignmentList from './pages/lms/AssignmentList';
import QuizPlayer from './pages/lms/QuizPlayer';
import LessonManager from './pages/lms/LessonManager';
import AssignmentManager from './pages/lms/AssignmentManager';

export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    if (localStorage.getItem('token')) dispatch(fetchMe());
  }, [dispatch]);

  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboards */}
          <Route path="/student/dashboard" element={<RoleRoute roles={['student']}><StudentDashboard /></RoleRoute>} />
          <Route path="/teacher/dashboard" element={<RoleRoute roles={['teacher']}><TeacherDashboard /></RoleRoute>} />
          <Route path="/admin/dashboard"   element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />

          {/* Phase 3 - Courses (shared: all roles) */}
          <Route path="/courses"     element={<PrivateRoute><div className="app-shell"><div className="main-content" style={{marginLeft:'var(--sidebar-width)'}}><CourseList /></div></div></PrivateRoute>} />
          <Route path="/courses/:id" element={<PrivateRoute><CourseDetail /></PrivateRoute>} />

          {/* Phase 4 — LMS student routes */}
          <Route path="/lessons/:id"    element={<RoleRoute roles={['student','teacher','admin']}><LessonViewer /></RoleRoute>} />
          <Route path="/assignments"    element={<RoleRoute roles={['student']}><AssignmentList /></RoleRoute>} />
          <Route path="/quizzes/:id"    element={<RoleRoute roles={['student']}><QuizPlayer /></RoleRoute>} />

          {/* Phase 4 — LMS teacher routes */}
          <Route path="/teacher/lessons"     element={<RoleRoute roles={['teacher','admin']}><LessonManager /></RoleRoute>} />
          <Route path="/teacher/assignments" element={<RoleRoute roles={['teacher','admin']}><AssignmentManager /></RoleRoute>} />

          {/* Student */}
          <Route path="/student/courses" element={<RoleRoute roles={['student']}><MyCourses /></RoleRoute>} />

          {/* Admin */}
          <Route path="/admin/courses" element={<RoleRoute roles={['admin']}><ManageCourses /></RoleRoute>} />

          <Route path="/unauthorized" element={
            <div className="min-h-screen" style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-secondary)' }}>
              Access denied.
            </div>
          } />
        </Routes>
      </BrowserRouter>
  );
}