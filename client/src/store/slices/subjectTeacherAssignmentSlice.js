import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAssignmentsBySubject = createAsyncThunk(
    'subjectTeacherAssignments/fetchBySubject',
    async (subjectId, { rejectWithValue }) => {
        try {
            const { data } = await api.get(`/subject-teacher-assignments/by-subject/${subjectId}`);
            return data.assignments;
        } catch (err) { return rejectWithValue(err.response?.data?.message); }
    }
);

export const fetchMyTeaching = createAsyncThunk(
    'subjectTeacherAssignments/fetchMyTeaching',
    async (_, { rejectWithValue }) => {
        try {
            const { data } = await api.get('/subject-teacher-assignments/my-teaching');
            return data.assignments;
        } catch (err) { return rejectWithValue(err.response?.data?.message); }
    }
);

export const assignTeacherToSection = createAsyncThunk(
    'subjectTeacherAssignments/assign',
    async ({ subjectId, sectionId, teacherId }, { rejectWithValue }) => {
        try {
            const { data } = await api.post('/subject-teacher-assignments', { subjectId, sectionId, teacherId });
            return data.assignment;
        } catch (err) { return rejectWithValue(err.response?.data?.message); }
    }
);

export const removeAssignment = createAsyncThunk(
    'subjectTeacherAssignments/remove',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/subject-teacher-assignments/${id}`);
            return id;
        } catch (err) { return rejectWithValue(err.response?.data?.message); }
    }
);

const subjectTeacherAssignmentSlice = createSlice({
    name: 'subjectTeacherAssignments',
    initialState: {
        bySubject:  [],   // assignments for the subject currently being viewed/edited
        myTeaching: [],   // teacher's own assignments
        loading:    false,
        error:      null,
    },
    reducers: { clearAssignmentError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAssignmentsBySubject.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAssignmentsBySubject.fulfilled, (s, a) => { s.loading = false; s.bySubject = a.payload; })
            .addCase(fetchAssignmentsBySubject.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchMyTeaching.pending,   (s) => { s.loading = true; })
            .addCase(fetchMyTeaching.fulfilled, (s, a) => { s.loading = false; s.myTeaching = a.payload; })
            .addCase(fetchMyTeaching.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(assignTeacherToSection.pending,   (s) => { s.error = null; })
            .addCase(assignTeacherToSection.fulfilled, (s, a) => {
                const i = s.bySubject.findIndex((x) => x._id === a.payload._id);
                if (i !== -1) s.bySubject[i] = a.payload;
                else s.bySubject.push(a.payload);
            })
            .addCase(assignTeacherToSection.rejected, (s, a) => { s.error = a.payload; })

            .addCase(removeAssignment.fulfilled, (s, a) => {
                s.bySubject = s.bySubject.filter((x) => x._id !== a.payload);
            });
    },
});

export const { clearAssignmentError } = subjectTeacherAssignmentSlice.actions;
export default subjectTeacherAssignmentSlice.reducer;