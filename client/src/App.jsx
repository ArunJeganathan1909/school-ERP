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

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Restore user from token on page reload
    if (localStorage.getItem('token')) dispatch(fetchMe());
  }, [dispatch]);

  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/student/dashboard" element={
            <RoleRoute roles={['student']}>
              <StudentDashboard />
            </RoleRoute>
          } />

          <Route path="/teacher/dashboard" element={
            <RoleRoute roles={['teacher']}>
              <TeacherDashboard />
            </RoleRoute>
          } />

          <Route path="/admin/dashboard" element={
            <RoleRoute roles={['admin']}>
              <AdminDashboard />
            </RoleRoute>
          } />

          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center text-gray-500">
              Access denied — you don't have permission to view this page.
            </div>
          } />
        </Routes>
      </BrowserRouter>
  );
}