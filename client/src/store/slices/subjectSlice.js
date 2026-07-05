import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// GET /api/subjects?section=&grade=&academicYear=&semester=&teacher=&bucket=&isMandatory=
export const fetchSubjects = createAsyncThunk('subjects/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subjects?${query}`);
        return data.subjects;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/subjects/buckets?grade=&academicYear=&section=
// Returns { grouped: { bucket1: [...], religion: [...], ... }, subjects: [...] }
export const fetchBucketSubjects = createAsyncThunk('subjects/fetchBuckets', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subjects/buckets?${query}`);
        return data; // { grouped, subjects }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// GET /api/subjects/:id
export const fetchSubject = createAsyncThunk('subjects/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/subjects/${id}`);
        return data.subject;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// POST /api/subjects — admin
export const createSubject = createAsyncThunk('subjects/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/subjects', d);
        return data.subject;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// PUT /api/subjects/:id — admin or teacher
export const updateSubject = createAsyncThunk('subjects/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/subjects/${id}`, d);
        return data.subject;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// DELETE /api/subjects/:id — admin
export const deleteSubject = createAsyncThunk('subjects/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/subjects/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const subjectSlice = createSlice({
    name: 'subjects',
    initialState: {
        list:          [],       // flat list (mandatory + bucket mixed)
        current:       null,
        bucketGrouped: {},       // { bucket1: [...], religion: [...], firstLang: [...], secondLang: [...] }
        loading:       false,
        error:         null,
    },
    reducers: {
        clearSubjectError(s) { s.error = null; },
        clearCurrentSubject(s) { s.current = null; },
    },
    extraReducers: (builder) => {
        builder
            // fetchSubjects
            .addCase(fetchSubjects.pending,    (s) => { s.loading = true; s.error = null; })
            .addCase(fetchSubjects.fulfilled,  (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchSubjects.rejected,   (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchBucketSubjects
            .addCase(fetchBucketSubjects.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchBucketSubjects.fulfilled, (s, a) => {
                s.loading       = false;
                s.bucketGrouped = a.payload.grouped;  // { bucket1: [], religion: [], ... }
            })
            .addCase(fetchBucketSubjects.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchSubject
            .addCase(fetchSubject.fulfilled, (s, a) => { s.current = a.payload; })

            // createSubject
            .addCase(createSubject.fulfilled, (s, a) => { s.list.unshift(a.payload); })
            .addCase(createSubject.rejected,  (s, a) => { s.error = a.payload; })

            // updateSubject
            .addCase(updateSubject.fulfilled, (s, a) => {
                const i = s.list.findIndex(x => x._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
                if (s.current?._id === a.payload._id) s.current = a.payload;
            })
            .addCase(updateSubject.rejected, (s, a) => { s.error = a.payload; })

            // deleteSubject
            .addCase(deleteSubject.fulfilled, (s, a) => {
                s.list = s.list.filter(x => x._id !== a.payload);
            })
            .addCase(deleteSubject.rejected, (s, a) => { s.error = a.payload; });
    },
});

export const { clearSubjectError, clearCurrentSubject } = subjectSlice.actions;
export default subjectSlice.reducer;