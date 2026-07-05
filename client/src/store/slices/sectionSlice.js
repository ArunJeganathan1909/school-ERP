import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchSections = createAsyncThunk('sections/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/sections?${query}`);
        return data.sections;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createSection = createAsyncThunk('sections/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/sections', d);
        return data.section;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateSection = createAsyncThunk('sections/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/sections/${id}`, d);
        return data.section;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteSection = createAsyncThunk('sections/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/sections/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const sectionSlice = createSlice({
    name: 'sections',
    initialState: { list: [], loading: false, error: null },
    reducers: { clearSectionError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSections.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchSections.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchSections.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(createSection.fulfilled, (s, a) => { s.list.push(a.payload); })
            .addCase(createSection.rejected, (s, a) => { s.error = a.payload; })
            .addCase(updateSection.fulfilled, (s, a) => {
                const i = s.list.findIndex(x => x._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(deleteSection.fulfilled, (s, a) => {
                s.list = s.list.filter(x => x._id !== a.payload);
            });
    },
});
export const { clearSectionError } = sectionSlice.actions;
export default sectionSlice.reducer;