import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAdminDashboard = createAsyncThunk('reports/adminDashboard', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/reports/admin/dashboard');
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchCourseAnalytics = createAsyncThunk('reports/courseAnalytics', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/reports/admin/courses');
        return data.analytics;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchStudentReport = createAsyncThunk('reports/student', async (studentId, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/reports/student/${studentId}`);
        return data.report;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchTeacherReport = createAsyncThunk('reports/teacher', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/reports/teacher');
        return data.report;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const reportSlice = createSlice({
    name: 'reports',
    initialState: {
        adminStats: null,
        enrollmentTrend: [],
        courseAnalytics: [],
        studentReport: null,
        teacherReport: null,
        loading: false,
        error: null,
    },
    reducers: { clearReportError(s) { s.error = null; } },
    extraReducers: (builder) => {
        const pending = (s) => { s.loading = true; s.error = null; };
        const rejected = (s, a) => { s.loading = false; s.error = a.payload; };
        builder
            .addCase(fetchAdminDashboard.pending, pending)
            .addCase(fetchAdminDashboard.fulfilled, (s, a) => {
                s.loading = false;
                s.adminStats = a.payload.stats;
                s.enrollmentTrend = a.payload.enrollmentTrend;
            })
            .addCase(fetchAdminDashboard.rejected, rejected)
            .addCase(fetchCourseAnalytics.pending, pending)
            .addCase(fetchCourseAnalytics.fulfilled, (s, a) => { s.loading = false; s.courseAnalytics = a.payload; })
            .addCase(fetchCourseAnalytics.rejected, rejected)
            .addCase(fetchStudentReport.pending, pending)
            .addCase(fetchStudentReport.fulfilled, (s, a) => { s.loading = false; s.studentReport = a.payload; })
            .addCase(fetchStudentReport.rejected, rejected)
            .addCase(fetchTeacherReport.pending, pending)
            .addCase(fetchTeacherReport.fulfilled, (s, a) => { s.loading = false; s.teacherReport = a.payload; })
            .addCase(fetchTeacherReport.rejected, rejected);
    },
});
export const { clearReportError } = reportSlice.actions;
export default reportSlice.reducer;