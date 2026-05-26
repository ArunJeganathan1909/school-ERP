import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js'

export const fetchCourses = createAsyncThunk('courses/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/courses?${query}`);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || 'Failed to fetch courses');
    }
});

export const fetchCourse = createAsyncThunk('courses/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/courses/${id}`);
        return data.course;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message);
    }
});

export const createCourse = createAsyncThunk('courses/create', async (courseData, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/courses', courseData);
        return data.course;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message);
    }
})

export const updateCourse = createAsyncThunk('courses/update', async ({ id, data: courseData }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/courses/${id}`, courseData);
        return data.course;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message);
    }
})

export const deleteCourse = createAsyncThunk('courses/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/courses/${id}`);
        return id;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message);
    }
})

const courseSlice = createSlice({
    name: 'courses',
    initialState: {
        list: [],
        current: null,
        total: 0,
        pages: 1,
        loading: false,
        error: null,
    },
    reducers: {
        clearCourseError(state) { state.error = null; },
        clearCurrentCourse(state) { state.current = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCourses.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchCourses.fulfilled, (state, action) => {
                state.loading = false;
                state.list = action.payload.courses;
                state.total = action.payload.total;
                state.pages = action.payload.pages;
            })
            .addCase(fetchCourses.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchCourse.fulfilled, (state, action) => { state.current = action.payload; })

            .addCase(createCourse.fulfilled, (state, action) => { state.list.unshift(action.payload); state.total += 1; })
            .addCase(createCourse.rejected, (state, action) => { state.error = action.payload; })

            .addCase(updateCourse.fulfilled, (state, action) => {
                const idx = state.list.findIndex(c => c._id === action.payload._id);
                if (idx !== -1) state.list[idx] = action.payload;
                if (state.current?._id === action.payload._id) state.current = action.payload;
            })
            .addCase(updateCourse.rejected, (state, action) => { state.error = action.payload; })

            .addCase(deleteCourse.fulfilled, (state, action) => {
                state.list = state.list.filter(c => c._id !== action.payload);
                state.total -= 1;
            })
            .addCase(deleteCourse.rejected, (state, action) => { state.error = action.payload; });
    },
});

export const { clearCourseError, clearCurrentCourse } = courseSlice.actions;
export default courseSlice.reducer;