import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAllFees = createAsyncThunk('fees/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/fees?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchMyFees = createAsyncThunk('fees/fetchMine', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/fees/my?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createFee = createAsyncThunk('fees/create', async (feeData, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/fees', feeData);
        return data.fee;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const recordPayment = createAsyncThunk('fees/payment', async ({ id, ...paymentData }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/fees/${id}/payment`, paymentData);
        return data.fee;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteFee = createAsyncThunk('fees/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/fees/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const feeSlice = createSlice({
    name: 'fees',
    initialState: {
        list: [], myFees: [], stats: {}, totalDue: 0,
        total: 0, pages: 1, loading: false, error: null,
    },
    reducers: { clearFeeError(s) { s.error = null; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllFees.pending, (s) => { s.loading = true; })
            .addCase(fetchAllFees.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.fees;
                s.stats = a.payload.stats;
                s.total = a.payload.total;
                s.pages = a.payload.pages;
            })
            .addCase(fetchAllFees.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchMyFees.pending, (s) => { s.loading = true; })
            .addCase(fetchMyFees.fulfilled, (s, a) => {
                s.loading = false;
                s.myFees = a.payload.fees;
                s.totalDue = a.payload.totalDue;
            })
            .addCase(fetchMyFees.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(createFee.fulfilled, (s, a) => { s.list.unshift(a.payload); s.total += 1; })
            .addCase(createFee.rejected, (s, a) => { s.error = a.payload; })
            .addCase(recordPayment.fulfilled, (s, a) => {
                const i = s.list.findIndex(f => f._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
            })
            .addCase(recordPayment.rejected, (s, a) => { s.error = a.payload; })
            .addCase(deleteFee.fulfilled, (s, a) => {
                s.list = s.list.filter(f => f._id !== a.payload);
                s.total -= 1;
            });
    },
});
export const { clearFeeError } = feeSlice.actions;
export default feeSlice.reducer;