import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchStructures = createAsyncThunk('timetableStructures/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/timetable-structures?${query}`);
        return data.structures;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createStructure = createAsyncThunk('timetableStructures/create', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/timetable-structures', payload);
        return data.structure;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateStructure = createAsyncThunk('timetableStructures/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/timetable-structures/${id}`, d);
        return data.structure;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteStructure = createAsyncThunk('timetableStructures/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/timetable-structures/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const timetableStructureSlice = createSlice({
    name: 'timetableStructures',
    initialState: { list: [], loading: false, error: null },
    reducers: { clearStructureError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchStructures.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchStructures.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchStructures.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(createStructure.fulfilled, (s, a) => { s.list.unshift(a.payload); })
            .addCase(createStructure.rejected,  (s, a) => { s.error = a.payload; })
            .addCase(updateStructure.fulfilled, (s, a) => {
                const i = s.list.findIndex((x) => x._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(deleteStructure.fulfilled, (s, a) => { s.list = s.list.filter((x) => x._id !== a.payload); });
    },
});
export const { clearStructureError } = timetableStructureSlice.actions;
export default timetableStructureSlice.reducer;