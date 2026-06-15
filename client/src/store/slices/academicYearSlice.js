import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAcademicYears = createAsyncThunk('academicYears/fetchAll', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/academic-years');
        return data.years;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchActiveYear = createAsyncThunk('academicYears/fetchActive', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/academic-years/active');
        return data.year;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createAcademicYear = createAsyncThunk('academicYears/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/academic-years', d);
        return data.year;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateAcademicYear = createAsyncThunk('academicYears/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/academic-years/${id}`, d);
        return data.year;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const activateAcademicYear = createAsyncThunk('academicYears/activate', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/academic-years/${id}/activate`);
        return data.year;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const setSemester = createAsyncThunk('academicYears/setSemester', async ({ id, currentSemester }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/academic-years/${id}/semester`, { currentSemester });
        return data.year;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteAcademicYear = createAsyncThunk('academicYears/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/academic-years/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const academicYearSlice = createSlice({
    name: 'academicYears',
    initialState: { list: [], active: null, loading: false, error: null },
    reducers: { clearAYError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAcademicYears.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAcademicYears.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchAcademicYears.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchActiveYear.fulfilled, (s, a) => { s.active = a.payload; })
            .addCase(createAcademicYear.fulfilled, (s, a) => { s.list.unshift(a.payload); })
            .addCase(createAcademicYear.rejected, (s, a) => { s.error = a.payload; })
            .addCase(updateAcademicYear.fulfilled, (s, a) => {
                const i = s.list.findIndex(y => y._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(activateAcademicYear.fulfilled, (s, a) => {
                // Mark all inactive, then activate the returned one
                s.list = s.list.map(y => ({ ...y, isActive: y._id === a.payload._id }));
                s.active = a.payload;
            })
            .addCase(setSemester.fulfilled, (s, a) => {
                const i = s.list.findIndex(y => y._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
                if (s.active?._id === a.payload._id) s.active = a.payload;
            })
            .addCase(deleteAcademicYear.fulfilled, (s, a) => {
                s.list = s.list.filter(y => y._id !== a.payload);
            });
    },
});
export const { clearAYError } = academicYearSlice.actions;
export default academicYearSlice.reducer;