import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchMyEnrollments = createAsyncThunk('enrollments/fetchMine', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/enrollments/my');
        return data.enrollments;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const enrollCourse = createAsyncThunk('enrollments/enroll', async (courseId, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/enrollments/enroll', { courseId });
        return data.enrollment;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const dropCourse = createAsyncThunk('enrollments/drop', async (enrollmentId, { rejectWithValue }) => {
    try {
        await api.put(`/enrollments/${enrollmentId}/drop`);
        return enrollmentId;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

const enrollmentSlice = createSlice({
    name: 'enrollments',
    initialState: { list: [], loading: false, error: null },
    reducers: {
        clearEnrollmentError(state) { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMyEnrollments.pending, (state) => { state.loading = true; })
            .addCase(fetchMyEnrollments.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchMyEnrollments.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
            .addCase(enrollCourse.fulfilled, (state, action) => { state.list.unshift(action.payload); })
            .addCase(enrollCourse.rejected, (state, action) => { state.error = action.payload; })
            .addCase(dropCourse.fulfilled, (state, action) => {
                const idx = state.list.findIndex(e => e._id === action.payload);
                if (idx !== -1) state.list[idx].status = 'dropped';
            });
    },
});

export const { clearEnrollmentError } = enrollmentSlice.actions;
export default enrollmentSlice.reducer;