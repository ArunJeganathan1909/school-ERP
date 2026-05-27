import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAssignments = createAsyncThunk('assignments/fetchAll', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/assignments?${query}`);
        return data.assignments;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAssignment = createAsyncThunk('assignments/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/assignments/${id}`);
        return data;   // { assignment, submission }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createAssignment = createAsyncThunk('assignments/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/assignments', d);
        return data.assignment;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const submitAssignment = createAsyncThunk('assignments/submit', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/submissions', d);
        return data.submission;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const gradeSubmission = createAsyncThunk('assignments/grade', async ({ id, marks, feedback }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/submissions/${id}/grade`, { marks, feedback });
        return data.submission;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const assignmentSlice = createSlice({
    name: 'assignments',
    initialState: { list: [], current: null, currentSubmission: null, loading: false, error: null },
    reducers: { clearAssignmentError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAssignments.pending, (s) => { s.loading = true; })
            .addCase(fetchAssignments.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchAssignments.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchAssignment.fulfilled, (s, a) => {
                s.current = a.payload.assignment;
                s.currentSubmission = a.payload.submission;
            })
            .addCase(createAssignment.fulfilled, (s, a) => { s.list.unshift(a.payload); })
            .addCase(submitAssignment.fulfilled, (s, a) => { s.currentSubmission = a.payload; })
            .addCase(gradeSubmission.fulfilled, (s, a) => { s.currentSubmission = a.payload; });
    },
});
export const { clearAssignmentError } = assignmentSlice.actions;
export default assignmentSlice.reducer;