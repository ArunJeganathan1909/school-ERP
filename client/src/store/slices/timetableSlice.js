import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// ── Admin: list all timetables (optionally filtered) ──
export const fetchTimetables = createAsyncThunk('timetables/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/timetables${query ? `?${query}` : ''}`);
        return data.timetables;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to fetch timetables');
    }
});

// ── Get a single timetable by id ──
export const fetchTimetable = createAsyncThunk('timetables/fetchOne', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/timetables/${id}`);
        return data.timetable;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to fetch timetable');
    }
});

// ── Admin: create a new timetable structure ──
export const createTimetable = createAsyncThunk('timetables/create', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/timetables', payload);
        return data.timetable;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to create timetable');
    }
});

// ── Admin: update timetable meta (term, workingDays, periods, isActive) ──
export const updateTimetable = createAsyncThunk('timetables/update', async ({ id, data: payload }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/timetables/${id}`, payload);
        return data.timetable;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to update timetable');
    }
});

// ── Admin: assign / clear a subject in a slot ──
export const updateSlot = createAsyncThunk('timetables/updateSlot', async ({ id, day, period, subjectId }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/timetables/${id}/slots`, { day, period, subjectId });
        return data.timetable;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to update slot');
    }
});

// ── Admin: delete a timetable ──
export const deleteTimetable = createAsyncThunk('timetables/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/timetables/${id}`);
        return id;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to delete timetable');
    }
});

// ── Student: view timetables for enrolled courses ──
export const fetchMyTimetableAsStudent = createAsyncThunk('timetables/fetchMineStudent', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/timetables/my/student');
        return data.timetables;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to fetch your timetable');
    }
});

// ── Teacher: view timetables containing their subjects ──
export const fetchMyTimetableAsTeacher = createAsyncThunk('timetables/fetchMineTeacher', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/timetables/my/teacher');
        return data.timetables;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || 'Failed to fetch your timetable');
    }
});

const timetableSlice = createSlice({
    name: 'timetables',
    initialState: {
        list:    [],   // admin: all timetables
        current: null, // admin: timetable being edited
        mine:    [],   // student/teacher: my timetables
        loading: false,
        error:   null,
    },
    reducers: {
        clearTimetableError(state)  { state.error = null; },
        clearCurrentTimetable(state) { state.current = null; },
    },
    extraReducers: (builder) => {
        builder
            // ── fetchTimetables ──
            .addCase(fetchTimetables.pending, (state) => {
                state.loading = true;
                state.error   = null;
            })
            .addCase(fetchTimetables.fulfilled, (state, action) => {
                state.loading = false;
                state.list    = action.payload;
            })
            .addCase(fetchTimetables.rejected, (state, action) => {
                state.loading = false;
                state.error   = action.payload;
            })

            // ── fetchTimetable ──
            .addCase(fetchTimetable.pending, (state) => {
                state.loading = true;
                state.error   = null;
            })
            .addCase(fetchTimetable.fulfilled, (state, action) => {
                state.loading = false;
                state.current = action.payload;
            })
            .addCase(fetchTimetable.rejected, (state, action) => {
                state.loading = false;
                state.error   = action.payload;
            })

            // ── createTimetable ──
            .addCase(createTimetable.pending, (state) => {
                state.error = null;
            })
            .addCase(createTimetable.fulfilled, (state, action) => {
                state.list.unshift(action.payload);
                state.current = action.payload;
                state.error   = null;
            })
            .addCase(createTimetable.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ── updateTimetable ──
            .addCase(updateTimetable.pending, (state) => {
                state.error = null;
            })
            .addCase(updateTimetable.fulfilled, (state, action) => {
                const idx = state.list.findIndex(t => t._id === action.payload._id);
                if (idx !== -1) state.list[idx] = action.payload;
                if (state.current?._id === action.payload._id) state.current = action.payload;
                state.error = null;
            })
            .addCase(updateTimetable.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ── updateSlot ──
            .addCase(updateSlot.pending, (state) => {
                state.error = null;
            })
            .addCase(updateSlot.fulfilled, (state, action) => {
                const idx = state.list.findIndex(t => t._id === action.payload._id);
                if (idx !== -1) state.list[idx] = action.payload;
                if (state.current?._id === action.payload._id) state.current = action.payload;
                state.error = null;
            })
            .addCase(updateSlot.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ── deleteTimetable ──
            .addCase(deleteTimetable.pending, (state) => {
                state.error = null;
            })
            .addCase(deleteTimetable.fulfilled, (state, action) => {
                state.list = state.list.filter(t => t._id !== action.payload);
                if (state.current?._id === action.payload) state.current = null;
                state.error = null;
            })
            .addCase(deleteTimetable.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ── fetchMyTimetableAsStudent ──
            .addCase(fetchMyTimetableAsStudent.pending, (state) => {
                state.loading = true;
                state.error   = null;
            })
            .addCase(fetchMyTimetableAsStudent.fulfilled, (state, action) => {
                state.loading = false;
                state.mine    = action.payload;
            })
            .addCase(fetchMyTimetableAsStudent.rejected, (state, action) => {
                state.loading = false;
                state.error   = action.payload;
            })

            // ── fetchMyTimetableAsTeacher ──
            .addCase(fetchMyTimetableAsTeacher.pending, (state) => {
                state.loading = true;
                state.error   = null;
            })
            .addCase(fetchMyTimetableAsTeacher.fulfilled, (state, action) => {
                state.loading = false;
                state.mine    = action.payload;
            })
            .addCase(fetchMyTimetableAsTeacher.rejected, (state, action) => {
                state.loading = false;
                state.error   = action.payload;
            });
    },
});

export const { clearTimetableError, clearCurrentTimetable } = timetableSlice.actions;
export default timetableSlice.reducer;