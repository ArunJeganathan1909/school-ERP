import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchMe } from './store/slices/authSlice';

import PrivateRoute from './components/PrivateRoute';
import RoleRoute    from './components/RoleRoute';

// Auth & Landing
import Login       from './pages/auth/Login';
import Register    from './pages/auth/Register';
import LandingPage from './pages/landing/LandingPage';

// Dashboards
import StudentDashboard from './pages/student/StudentDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AdminDashboard   from './pages/admin/AdminDashboard';

// LMS
import LessonList        from './pages/lms/LessonList';
import LessonViewer      from './pages/lms/LessonViewer';
import AssignmentList    from './pages/lms/AssignmentList';
import QuizPlayer        from './pages/lms/QuizPlayer';
import LessonManager     from './pages/lms/LessonManager';
import AssignmentManager from './pages/lms/AssignmentManager';

// Attendance & Fees
import MarkAttendance from './pages/attendance/MarkAttendance';
import MyAttendance   from './pages/attendance/MyAttendance';
import ManageFees     from './pages/fees/ManageFees';
import MyFees         from './pages/fees/MyFees';

// Announcements
import Announcements from './pages/announcements/Announcements';

// Reports
import AdminReports  from './pages/reports/AdminReports';
import StudentReport from './pages/reports/StudentReport';
import TeacherReport from './pages/reports/TeacherReport';

// Admin management
import ManageUsers        from './pages/admin/ManageUsers';
import ManageAcademicYears from './pages/admin/ManageAcademicYears';
import ManageGrades       from './pages/admin/ManageGrades';
import ManageSections     from './pages/admin/ManageSections';
import ManageSubjects     from './pages/admin/ManageSubjects';
import SubjectEnrollmentManager from './pages/admin/SubjectEnrollmentManager';
import TimetableManager   from './pages/admin/TimetableManager';

// Shared
import TimetableViewer from './pages/shared/TimetableViewer';

// Student pages
import MySubjects from './pages/student/MySubjects';

// Teacher pages
import TeacherSubjects from './pages/teacher/TeacherSubjects';

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    if (localStorage.getItem('token')) dispatch(fetchMe());
  }, [dispatch]);

  return (
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboards */}
          <Route path="/student/dashboard" element={<RoleRoute roles={['student']}><StudentDashboard /></RoleRoute>} />
          <Route path="/teacher/dashboard" element={<RoleRoute roles={['teacher']}><TeacherDashboard /></RoleRoute>} />
          <Route path="/admin/dashboard"   element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />

          {/* LMS — student */}
          <Route path="/lessons"        element={<RoleRoute roles={['student','teacher','admin']}><LessonList /></RoleRoute>} />
          <Route path="/lessons/:id"    element={<RoleRoute roles={['student','teacher','admin']}><LessonViewer /></RoleRoute>} />
          <Route path="/assignments"    element={<RoleRoute roles={['student']}><AssignmentList /></RoleRoute>} />
          <Route path="/quizzes/:id"    element={<RoleRoute roles={['student']}><QuizPlayer /></RoleRoute>} />

          {/* LMS — teacher */}
          <Route path="/teacher/lessons"     element={<RoleRoute roles={['teacher','admin']}><LessonManager /></RoleRoute>} />
          <Route path="/teacher/assignments" element={<RoleRoute roles={['teacher','admin']}><AssignmentManager /></RoleRoute>} />

          {/* Attendance */}
          <Route path="/student/attendance" element={<RoleRoute roles={['student']}><MyAttendance /></RoleRoute>} />
          <Route path="/teacher/attendance" element={<RoleRoute roles={['teacher','admin']}><MarkAttendance /></RoleRoute>} />

          {/* Fees */}
          <Route path="/student/fees" element={<RoleRoute roles={['student']}><MyFees /></RoleRoute>} />
          <Route path="/admin/fees"   element={<RoleRoute roles={['admin']}><ManageFees /></RoleRoute>} />

          {/* Announcements */}
          <Route path="/announcements"     element={<PrivateRoute><Announcements /></PrivateRoute>} />
          <Route path="/announcements/:id" element={<PrivateRoute><Announcements /></PrivateRoute>} />

          {/* Reports */}
          <Route path="/admin/reports"  element={<RoleRoute roles={['admin']}><AdminReports /></RoleRoute>} />
          <Route path="/student/grades" element={<RoleRoute roles={['student']}><StudentReport /></RoleRoute>} />
          <Route path="/teacher/grades" element={<RoleRoute roles={['teacher']}><TeacherReport /></RoleRoute>} />

          {/* Timetables */}
          <Route path="/admin/timetables"  element={<RoleRoute roles={['admin']}><TimetableManager /></RoleRoute>} />
          <Route path="/student/timetable" element={<RoleRoute roles={['student']}><TimetableViewer /></RoleRoute>} />
          <Route path="/teacher/timetable" element={<RoleRoute roles={['teacher']}><TimetableViewer /></RoleRoute>} />

          {/* Admin — Academic structure */}
          <Route path="/admin/academic-years"        element={<RoleRoute roles={['admin']}><ManageAcademicYears /></RoleRoute>} />
          <Route path="/admin/grades"                element={<RoleRoute roles={['admin']}><ManageGrades /></RoleRoute>} />
          <Route path="/admin/sections"              element={<RoleRoute roles={['admin']}><ManageSections /></RoleRoute>} />
          <Route path="/admin/subjects"              element={<RoleRoute roles={['admin']}><ManageSubjects /></RoleRoute>} />
          <Route path="/admin/subject-enrollments"   element={<RoleRoute roles={['admin']}><SubjectEnrollmentManager /></RoleRoute>} />
          <Route path="/admin/users"                 element={<RoleRoute roles={['admin']}><ManageUsers /></RoleRoute>} />

          {/* Student */}
          <Route path="/student/subjects" element={<RoleRoute roles={['student']}><MySubjects /></RoleRoute>} />

          {/* Teacher */}
          <Route path="/teacher/subjects" element={<RoleRoute roles={['teacher']}><TeacherSubjects /></RoleRoute>} />

          {/* Unauthorized */}
          <Route path="/unauthorized" element={
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'var(--color-text-secondary)' }}>
              Access denied.
            </div>
          } />
        </Routes>
      </BrowserRouter>
  );
}