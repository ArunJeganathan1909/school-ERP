import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// ── Student: own subjects ─────────────────────────────────────────────────────

// GET /api/subject-enrollments/my?academicYear=&semester=
export const fetchMySubjects = createAsyncThunk('subjectEnrollments/fetchMine', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subject-enrollments/my?${query}`);
        return data; // { enrollments, mandatory, buckets }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: view any student's subjects ───────────────────────────────────────

// GET /api/subject-enrollments/student/:studentId?academicYear=&semester=
export const fetchStudentSubjects = createAsyncThunk('subjectEnrollments/fetchStudent', async ({ studentId, ...params }, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subject-enrollments/student/${studentId}?${query}`);
        return data; // { enrollments, mandatory, buckets }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: students enrolled in a subject ────────────────────────────────────

// GET /api/subject-enrollments/subject/:subjectId?academicYear=&status=
export const fetchSubjectStudents = createAsyncThunk('subjectEnrollments/fetchSubjectStudents', async ({ subjectId, ...params }, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subject-enrollments/subject/${subjectId}?${query}`);
        return data.enrollments;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: all enrollments with filters ──────────────────────────────────────

// GET /api/subject-enrollments?student=&subject=&section=&academicYear=&status=&bucket=&page=&limit=
export const fetchAllSubjectEnrollments = createAsyncThunk('subjectEnrollments/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/subject-enrollments?${query}`);
        return data; // { total, enrollments }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: assign bucket subject for a student ───────────────────────────────

// POST /api/subject-enrollments/bucket
// Body: { studentId, subjectId, academicYearId }
export const assignBucketSubject = createAsyncThunk('subjectEnrollments/assignBucket', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/subject-enrollments/bucket', payload);
        return data.enrollment;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: change a student's bucket selection ───────────────────────────────

// PUT /api/subject-enrollments/bucket/change
// Body: { studentId, newSubjectId, academicYearId }
export const changeBucketSubject = createAsyncThunk('subjectEnrollments/changeBucket', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await api.put('/subject-enrollments/bucket/change', payload);
        return data; // { enrollment, dropped }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Admin: section pending bucket checklist ──────────────────────────────────

// GET /api/subject-enrollments/section/:sectionId/pending-buckets?academicYearId=
export const fetchPendingBuckets = createAsyncThunk('subjectEnrollments/fetchPending', async ({ sectionId, academicYearId }, { rejectWithValue }) => {
    try {
        const { data } = await api.get(`/subject-enrollments/section/${sectionId}/pending-buckets?academicYearId=${academicYearId}`);
        return data; // { pending, total }
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Teacher/Admin: enter marks ───────────────────────────────────────────────

// PUT /api/subject-enrollments/:id/marks
// Body: { marks, grade_letter, remarks }
export const enterMarks = createAsyncThunk('subjectEnrollments/enterMarks', async ({ id, ...payload }, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/subject-enrollments/${id}/marks`, payload);
        return data.enrollment;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ─────────────────────────────────────────────────────────────────────────────

const subjectEnrollmentSlice = createSlice({
    name: 'subjectEnrollments',
    initialState: {
        // Student's own view
        myEnrollments: [],   // all active enrollments
        myMandatory:   [],   // mandatory subjects only
        myBuckets:     [],   // bucket selections only

        // Admin view of a specific student
        studentEnrollments: [],
        studentMandatory:   [],
        studentBuckets:     [],

        // Students enrolled in a subject (teacher/admin view)
        subjectStudents: [],

        // Admin: full paginated list
        list:  [],
        total: 0,

        // Admin: pending bucket checklist
        pendingBuckets: [],
        pendingTotal:   0,

        loading: false,
        error:   null,
    },
    reducers: {
        clearSubjectEnrollmentError(s) { s.error = null; },
        clearStudentEnrollments(s) {
            s.studentEnrollments = [];
            s.studentMandatory   = [];
            s.studentBuckets     = [];
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchMySubjects
            .addCase(fetchMySubjects.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchMySubjects.fulfilled, (s, a) => {
                s.loading        = false;
                s.myEnrollments  = a.payload.enrollments ?? [];
                s.myMandatory    = a.payload.mandatory   ?? [];
                s.myBuckets      = a.payload.buckets     ?? [];
            })
            .addCase(fetchMySubjects.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchStudentSubjects
            .addCase(fetchStudentSubjects.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchStudentSubjects.fulfilled, (s, a) => {
                s.loading            = false;
                s.studentEnrollments = a.payload.enrollments ?? [];
                s.studentMandatory   = a.payload.mandatory   ?? [];
                s.studentBuckets     = a.payload.buckets     ?? [];
            })
            .addCase(fetchStudentSubjects.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchSubjectStudents
            .addCase(fetchSubjectStudents.pending,   (s) => { s.loading = true; })
            .addCase(fetchSubjectStudents.fulfilled, (s, a) => { s.loading = false; s.subjectStudents = a.payload; })
            .addCase(fetchSubjectStudents.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // fetchAllSubjectEnrollments
            .addCase(fetchAllSubjectEnrollments.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAllSubjectEnrollments.fulfilled, (s, a) => {
                s.loading = false;
                s.list    = a.payload.enrollments ?? [];
                s.total   = a.payload.total       ?? 0;
            })
            .addCase(fetchAllSubjectEnrollments.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // assignBucketSubject — add to student's bucket list if we have it loaded
            .addCase(assignBucketSubject.pending,   (s) => { s.error = null; })
            .addCase(assignBucketSubject.fulfilled, (s, a) => {
                s.studentBuckets.push(a.payload);
                s.studentEnrollments.push(a.payload);
            })
            .addCase(assignBucketSubject.rejected,  (s, a) => { s.error = a.payload; })

            // changeBucketSubject — replace old with new in student bucket list
            .addCase(changeBucketSubject.pending,   (s) => { s.error = null; })
            .addCase(changeBucketSubject.fulfilled, (s, a) => {
                const { enrollment: newEnroll, dropped } = a.payload;

                // Update studentBuckets: remove dropped, add new
                s.studentBuckets = s.studentBuckets.filter(e => e._id !== dropped?._id);
                s.studentBuckets.push(newEnroll);

                // Update full list too
                s.studentEnrollments = s.studentEnrollments.filter(e => e._id !== dropped?._id);
                s.studentEnrollments.push(newEnroll);
            })
            .addCase(changeBucketSubject.rejected,  (s, a) => { s.error = a.payload; })

            // fetchPendingBuckets
            .addCase(fetchPendingBuckets.pending,   (s) => { s.loading = true; })
            .addCase(fetchPendingBuckets.fulfilled, (s, a) => {
                s.loading       = false;
                s.pendingBuckets = a.payload.pending ?? [];
                s.pendingTotal   = a.payload.total   ?? 0;
            })
            .addCase(fetchPendingBuckets.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            // enterMarks — update in list if present
            .addCase(enterMarks.pending,   (s) => { s.error = null; })
            .addCase(enterMarks.fulfilled, (s, a) => {
                const i = s.list.findIndex(e => e._id === a.payload._id);
                if (i !== -1) s.list[i] = a.payload;
                // also update in subjectStudents
                const j = s.subjectStudents.findIndex(e => e._id === a.payload._id);
                if (j !== -1) s.subjectStudents[j] = a.payload;
            })
            .addCase(enterMarks.rejected,  (s, a) => { s.error = a.payload; });
    },
});

export const { clearSubjectEnrollmentError, clearStudentEnrollments } = subjectEnrollmentSlice.actions;
export default subjectEnrollmentSlice.reducer;