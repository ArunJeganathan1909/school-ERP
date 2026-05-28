import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAnnouncements = createAsyncThunk('announcements/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/announcements?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createAnnouncement = createAsyncThunk('announcements/create', async (d, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/announcements', d);
        return data.announcement;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateAnnouncement = createAsyncThunk('announcements/update', async ({ id, data: d }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/announcements/${id}`, d);
        return data.announcement;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteAnnouncement = createAsyncThunk('announcements/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/announcements/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const announcementSlice = createSlice({
    name: 'announcements',
    initialState: { list: [], total: 0, loading: false, error: null },
    reducers: {
        // Called from SocketContext on real-time announcement
        prependAnnouncement(state, action) {
            state.list.unshift(action.payload);
            state.total += 1;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAnnouncements.pending, (s) => { s.loading = true; })
            .addCase(fetchAnnouncements.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.announcements;
                s.total = a.payload.total;
            })
            .addCase(fetchAnnouncements.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(createAnnouncement.fulfilled, (s, a) => { s.list.unshift(a.payload); s.total += 1; })
            .addCase(updateAnnouncement.fulfilled, (s, a) => {
                const i = s.list.findIndex(x => x._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(deleteAnnouncement.fulfilled, (s, a) => {
                s.list = s.list.filter(x => x._id !== a.payload);
                s.total -= 1;
            });
    },
});

export const { prependAnnouncement } = announcementSlice.actions;
export default announcementSlice.reducer;