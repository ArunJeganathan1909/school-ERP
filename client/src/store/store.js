import { configureStore } from '@reduxjs/toolkit';
import authReducer               from './slices/authSlice';
import lessonReducer              from './slices/lessonSlice';
import assignmentReducer          from './slices/assignmentSlice';
import quizReducer                from './slices/quizSlice';
import attendanceReducer          from './slices/attendanceSlice';
import feeReducer                 from './slices/feeSlice';
import notificationReducer        from './slices/notificationSlice';
import announcementReducer        from './slices/announcementSlice';
import reportReducer              from './slices/reportSlice';
import timetableReducer           from './slices/timetableSlice';
import academicYearReducer        from './slices/academicYearSlice';
import gradeReducer               from './slices/gradeSlice';
import sectionReducer             from './slices/sectionSlice';
import studentSectionReducer      from './slices/studentSectionSlice';
import subjectReducer             from './slices/subjectSlice';
import subjectEnrollmentReducer   from './slices/subjectEnrollmentSlice';

export const store = configureStore({
    reducer: {
        auth:               authReducer,
        lessons:            lessonReducer,
        assignments:        assignmentReducer,
        quizzes:            quizReducer,
        attendance:         attendanceReducer,
        fees:               feeReducer,
        notifications:      notificationReducer,
        announcements:      announcementReducer,
        reports:            reportReducer,
        timetables:         timetableReducer,
        academicYears:      academicYearReducer,
        grades:             gradeReducer,
        sections:           sectionReducer,
        studentSections:    studentSectionReducer,
        subjects:           subjectReducer,
        subjectEnrollments: subjectEnrollmentReducer,
    },
});