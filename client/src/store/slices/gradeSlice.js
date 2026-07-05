import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchGrades = createAsyncThunk('grades/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/grades?${query}`);
        return data.grades;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createGrade = createAsyncThunk('grades/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/grades', d);
        return data.grade;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateGrade = createAsyncThunk('grades/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/grades/${id}`, d);
        return data.grade;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteGrade = createAsyncThunk('grades/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/grades/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const gradeSlice = createSlice({
    name: 'grades',
    initialState: { list: [], loading: false, error: null },
    reducers: { clearGradeError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchGrades.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchGrades.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchGrades.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(createGrade.fulfilled, (s, a) => { s.list.push(a.payload); })
            .addCase(createGrade.rejected, (s, a) => { s.error = a.payload; })
            .addCase(updateGrade.fulfilled, (s, a) => {
                const i = s.list.findIndex(g => g._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(deleteGrade.fulfilled, (s, a) => {
                s.list = s.list.filter(g => g._id !== a.payload);
            });
    },
});
export const { clearGradeError } = gradeSlice.actions;
export default gradeSlice.reducer;