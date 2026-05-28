import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const markAttendance = createAsyncThunk('attendance/mark', async (data, { rejectWithValue }) => {
    try {
        const { data: res } = await api.post('/attendance/mark', data);
        return res;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchSessionAttendance = createAsyncThunk('attendance/session', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendance?${query}`);
        return data.records;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchMyAttendance = createAsyncThunk('attendance/my', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendance/my?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchCourseReport = createAsyncThunk('attendance/report', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/attendance/report?${query}`);
        return data.report;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const attendanceSlice = createSlice({
    name: 'attendance',
    initialState: {
        sessionRecords: [],
        myRecords: [],
        mySummary: [],
        report: [],
        loading: false,
        error: null,
    },
    reducers: { clearAttendanceError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSessionAttendance.pending, (s) => { s.loading = true; })
            .addCase(fetchSessionAttendance.fulfilled, (s, a) => { s.loading = false; s.sessionRecords = a.payload; })
            .addCase(fetchSessionAttendance.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchMyAttendance.pending, (s) => { s.loading = true; })
            .addCase(fetchMyAttendance.fulfilled, (s, a) => {
                s.loading = false;
                s.myRecords = a.payload.records;
                s.mySummary = a.payload.summary;
            })
            .addCase(fetchMyAttendance.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchCourseReport.fulfilled, (s, a) => { s.report = a.payload; })
            .addCase(markAttendance.rejected, (s, a) => { s.error = a.payload; });
    },
});
export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;