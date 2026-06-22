import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// ── Admin ──────────────────────────────────────────────────────────────────

export const fetchAllStudentSections = createAsyncThunk('studentSections/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/student-sections?${query}`);
        return data.records;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const assignStudentToSection = createAsyncThunk('studentSections/assign', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/student-sections/assign', payload);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const transferStudent = createAsyncThunk('studentSections/transfer', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.put('/student-sections/transfer', payload);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const withdrawStudent = createAsyncThunk('studentSections/withdraw', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/student-sections/${id}/withdraw`, {});
        return data.record;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateRollNumber = createAsyncThunk('studentSections/updateRoll', async ({ id, rollNumber }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/student-sections/${id}/roll-number`, { rollNumber });
        return data.record;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const promoteStudents = createAsyncThunk('studentSections/promote', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/student-sections/promote', payload);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Student (self) ────────────────────────────────────────────────────────────

export const fetchMyCurrentSection = createAsyncThunk('studentSections/fetchMyCurrent', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/student-sections/my/current');
        return data; // { record, classmates }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchMySectionHistory = createAsyncThunk('studentSections/fetchMyHistory', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/student-sections/my');
        return data.records;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const studentSectionSlice = createSlice({
    name: 'studentSections',
    initialState: {
        list:        [],
        myCurrent:   null,
        classmates:  [],
        myHistory:   [],
        loading:     false,
        error:       null,
        lastResult:  null, // holds transfer/promote response messages
    },
    reducers: {
        clearStudentSectionError(s) { s.error = null; },
        clearLastResult(s) { s.lastResult = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllStudentSections.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAllStudentSections.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchAllStudentSections.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(assignStudentToSection.pending,   (s) => { s.error = null; })
            .addCase(assignStudentToSection.fulfilled, (s, a) => { s.lastResult = a.payload; })
            .addCase(assignStudentToSection.rejected,  (s, a) => { s.error = a.payload; })

            .addCase(transferStudent.pending,   (s) => { s.error = null; })
            .addCase(transferStudent.fulfilled, (s, a) => { s.lastResult = a.payload; })
            .addCase(transferStudent.rejected,  (s, a) => { s.error = a.payload; })

            .addCase(withdrawStudent.fulfilled, (s, a) => {
                s.list = s.list.map((r) => r._id === a.payload._id ? a.payload : r);
            })
            .addCase(withdrawStudent.rejected, (s, a) => { s.error = a.payload; })

            .addCase(updateRollNumber.fulfilled, (s, a) => {
                const i = s.list.findIndex((r) => r._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })

            .addCase(promoteStudents.pending,   (s) => { s.error = null; })
            .addCase(promoteStudents.fulfilled, (s, a) => { s.lastResult = a.payload; })
            .addCase(promoteStudents.rejected,  (s, a) => { s.error = a.payload; })

            .addCase(fetchMyCurrentSection.pending,   (s) => { s.loading = true; })
            .addCase(fetchMyCurrentSection.fulfilled, (s, a) => {
                s.loading    = false;
                s.myCurrent  = a.payload.record;
                s.classmates = a.payload.classmates || [];
            })
            .addCase(fetchMyCurrentSection.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchMySectionHistory.fulfilled, (s, a) => { s.myHistory = a.payload; });
    },
});

export const { clearStudentSectionError, clearLastResult } = studentSectionSlice.actions;
export default studentSectionSlice.reducer;