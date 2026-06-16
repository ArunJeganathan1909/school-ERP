import { configureStore } from '@reduxjs/toolkit';

import authReducer               from './slices/authSlice';
// import userReducer               from './slices/userSlice';          // keep if you have one

// Academic structure
import academicYearReducer       from './slices/academicYearSlice';
import gradeReducer              from './slices/gradeSlice';
import sectionReducer            from './slices/sectionSlice';

// Subjects & enrollment  ← replaces courseReducer + enrollmentReducer
import subjectReducer            from './slices/subjectSlice';
import subjectEnrollmentReducer  from './slices/subjectEnrollmentSlice';

// Learning content
import lessonReducer             from './slices/lessonSlice';
import assignmentReducer         from './slices/assignmentSlice';
import quizReducer               from './slices/quizSlice';

// School operations
import attendanceReducer         from './slices/attendanceSlice';
import feeReducer                from './slices/feeSlice';
import timetableReducer          from './slices/timetableSlice';
import notificationReducer       from './slices/notificationSlice';
import announcementReducer       from './slices/announcementSlice';
import reportReducer             from './slices/reportSlice';

// REMOVED:
// import courseReducer          from './slices/courseSlice';
// import enrollmentReducer      from './slices/enrollmentSlice';

export const store = configureStore({
    reducer: {
        auth:               authReducer,

        // Academic structure
        academicYears:      academicYearReducer,
        grades:             gradeReducer,
        sections:           sectionReducer,

        // Subjects & enrollment
        subjects:           subjectReducer,
        subjectEnrollments: subjectEnrollmentReducer,

        // Learning content
        lessons:            lessonReducer,
        assignments:        assignmentReducer,
        quizzes:            quizReducer,

        // School operations
        attendance:         attendanceReducer,
        fees:               feeReducer,
        timetables:         timetableReducer,
        notifications:      notificationReducer,
        announcements:      announcementReducer,
        reports:            reportReducer,
    },
});

export default store;