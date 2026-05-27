import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchLessons = createAsyncThunk('lessons/fetchAll', async (params, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/lessons?${query}`);
        return data.lessons;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchLesson = createAsyncThunk('lessons/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/lessons/${id}`);
        return data.lesson;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createLesson = createAsyncThunk('lessons/create', async (lessonData, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/lessons', lessonData);
        return data.lesson;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateLesson = createAsyncThunk('lessons/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/lessons/${id}`, d);
        return data.lesson;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteLesson = createAsyncThunk('lessons/delete', async (id, { rejectWithValue }) => {
    try { await api.delete(`/lessons/${id}`); return id; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const lessonSlice = createSlice({
    name: 'lessons',
    initialState: { list: [], current: null, loading: false, error: null },
    reducers: { clearLessonError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchLessons.pending, (s) => { s.loading = true; })
            .addCase(fetchLessons.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchLessons.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchLesson.fulfilled, (s, a) => { s.current = a.payload; })
            .addCase(createLesson.fulfilled, (s, a) => { s.list.push(a.payload); })
            .addCase(updateLesson.fulfilled, (s, a) => {
                const i = s.list.findIndex(l => l._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
                if (s.current?._id === a.payload._id) s.current = a.payload;
            })
            .addCase(deleteLesson.fulfilled, (s, a) => { s.list = s.list.filter(l => l._id !== a.payload); });
    },
});
export const { clearLessonError } = lessonSlice.actions;
export default lessonSlice.reducer;