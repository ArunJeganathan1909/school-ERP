import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// POST /api/attendances/mark
export const markAttendance = createAsyncThunk('attendance/mark', async (data, { rejectWithValue }) => {
    try {
        const { data: res } = await api.post('/attendances/mark', data);
        return res;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/attendances?subjectId=&date= — existing records for a session
export const fetchSessionAttendance = createAsyncThunk('attendance/session', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendances?${query}`);
        return data.records;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/attendances/enrolled-students?subjectId=&date=
// Returns the student list for a subject + any existing attendance records for that date
export const fetchEnrolledStudents = createAsyncThunk('attendance/enrolledStudents', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendances/enrolled-students?${query}`);
        return data; // { students, courseId, existingRecords }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/attendances/my
export const fetchMyAttendance = createAsyncThunk('attendance/my', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendances/my?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/attendances/report
export const fetchCourseReport = createAsyncThunk('attendance/report', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendances/report?${query}`);
        return data.report;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const attendanceSlice = createSlice({
    name: 'attendance',
    initialState: {
        sessionRecords:   [],
        enrolledStudents: [],   // student list for mark-attendance page
        myRecords:        [],
        mySummary:        [],
        report:           [],
        loading:          false,
        studentsLoading:  false, // separate loader for student list
        error:            null,
    },
    reducers: {
        clearAttendanceError(s) { s.error = null; },
    },
    extraReducers: (builder) => {
        builder
            // fetchSessionAttendance
            .addCase(fetchSessionAttendance.pending,   (s) => { s.loading = true; })
            .addCase(fetchSessionAttendance.fulfilled, (s, a) => { s.loading = false; s.sessionRecords = a.payload ?? []; })
            .addCase(fetchSessionAttendance.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchEnrolledStudents
            .addCase(fetchEnrolledStudents.pending,   (s) => { s.studentsLoading = true; s.error = null; })
            .addCase(fetchEnrolledStudents.fulfilled, (s, a) => {
                s.studentsLoading   = false;
                s.enrolledStudents  = a.payload.students ?? [];
            })
            .addCase(fetchEnrolledStudents.rejected,  (s, a) => { s.studentsLoading = false; s.error = a.payload; })

            // fetchMyAttendance
            .addCase(fetchMyAttendance.pending,   (s) => { s.loading = true; })
            .addCase(fetchMyAttendance.fulfilled, (s, a) => {
                s.loading   = false;
                s.myRecords = a.payload.records  ?? [];
                s.mySummary = a.payload.summary  ?? [];
            })
            .addCase(fetchMyAttendance.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchCourseReport
            .addCase(fetchCourseReport.fulfilled, (s, a) => { s.report = a.payload ?? []; })

            // markAttendance
            .addCase(markAttendance.rejected, (s, a) => { s.error = a.payload; });
    },
});

export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;