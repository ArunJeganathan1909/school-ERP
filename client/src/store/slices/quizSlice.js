import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchQuizzes = createAsyncThunk('quizzes/fetchAll', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/quizzes?${query}`);
        return data.quizzes;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchQuiz = createAsyncThunk('quizzes/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/quizzes/${id}`);
        return data.quiz;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createQuiz = createAsyncThunk('quizzes/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/quizzes', d);
        return data.quiz;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const submitQuizAttempt = createAsyncThunk('quizzes/attempt', async ({ quizId, answers, timeTaken }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/quizzes/${quizId}/attempt`, { answers, timeTaken });
        return data.result;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const quizSlice = createSlice({
    name: 'quizzes',
    initialState: { list: [], current: null, lastResult: null, loading: false, error: null },
    reducers: {
        clearQuizError(s) { s.error = null; },
        clearLastResult(s) { s.lastResult = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchQuizzes.pending, (s) => { s.loading = true; })
            .addCase(fetchQuizzes.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchQuizzes.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchQuiz.fulfilled, (s, a) => { s.current = a.payload; })
            .addCase(createQuiz.fulfilled, (s, a) => { s.list.unshift(a.payload); })
            .addCase(submitQuizAttempt.fulfilled, (s, a) => { s.lastResult = a.payload; })
            .addCase(submitQuizAttempt.rejected, (s, a) => { s.error = a.payload; });
    },
});
export const { clearQuizError, clearLastResult } = quizSlice.actions;
export default quizSlice.reducer;