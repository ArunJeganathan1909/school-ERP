import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import LandingHeader from '../../components/LandingHeader';
import LandingFooter from '../../components/LandingFooter';
import './LandingPage.css';

/* ── feature data ── */
const FEATURES = [
    { icon: '📚', title: 'Learning Management', desc: 'Full LMS with lessons, assignments, quiz engine with auto-grading, and progress tracking.' },
    { icon: '✅', title: 'Attendance tracking', desc: 'Bulk attendance marking per session, student calendar view, and automated alerts below 75%.' },
    { icon: '💳', title: 'Fee management', desc: 'Invoice creation, partial payment recording, overdue detection, and PDF fee reports.' },
    { icon: '📊', title: 'Reports & analytics', desc: 'Role-specific dashboards with Recharts visualisations and one-click PDF exports.' },
    { icon: '🔔', title: 'Real-time notifications', desc: 'Socket.io powered live alerts for grades, fees, announcements, and enrollments.' },
    { icon: '📢', title: 'Announcements', desc: 'Audience-targeted announcements with pinning, expiry, and instant broadcast to all online users.' },
    { icon: '🎓', title: 'Course management', desc: 'Full course and subject CRUD, enrollment with capacity limits, and teacher assignment.' },
    { icon: '👥', title: 'User management', desc: 'Admin-controlled student, teacher, and admin accounts with role-based access control.' },
];

/* ── stats ── */
const STATS = [
    { value: '3', label: 'User roles', sub: 'Student · Teacher · Admin' },
    { value: '7', label: 'Core modules', sub: 'Fully integrated' },
    { value: '100%', label: 'MERN stack', sub: 'MongoDB · Express · React · Node' },
    { value: '∞', label: 'Students supported', sub: 'Cloud-hosted database' },
];

/* ── team / about ── */
const STEPS = [
    { num: '01', title: 'Register & enroll', desc: 'Students sign up and enroll in available courses in seconds.' },
    { num: '02', title: 'Learn & attend', desc: 'Access lessons, submit assignments, take quizzes, and track attendance.' },
    { num: '03', title: 'Track & improve', desc: 'View real-time grades, attendance reports, and personalised insights.' },
    { num: '04', title: 'Manage & export', desc: 'Admins manage fees, generate PDF reports, and broadcast announcements.' },
];

export default function LandingPage() {
    const navigate  = useNavigate();
    const { token, user } = useSelector((s) => s.auth);

    /* redirect logged-in users to their dashboard */
    useEffect(() => {
        if (token && user) navigate(`/${user.role}/dashboard`, { replace: true });
    }, [token, user, navigate]);

    return (
        <div className="landing-page">
            <LandingHeader />

            {/* ══ HERO ══ */}
            <section id="hero" className="landing-hero">
                <div className="landing-hero__bg-shapes">
                    <div className="landing-hero__shape landing-hero__shape--1" />
                    <div className="landing-hero__shape landing-hero__shape--2" />
                    <div className="landing-hero__shape landing-hero__shape--3" />
                </div>

                <div className="landing-hero__content">
                    <div className="landing-hero__badge">
                        🎓 Complete School & College ERP
                    </div>
                    <h1 className="landing-hero__title">
                        Manage your school<br />
                        <span className="landing-hero__title-accent">smarter, faster</span>
                    </h1>
                    <p className="landing-hero__subtitle">
                        One platform for students, teachers, and administrators.
                        LMS, attendance, fees, analytics — all in one place, in real time.
                    </p>
                    <div className="landing-hero__actions">
                        <button
                            className="btn-landing btn-landing--primary btn-landing--lg"
                            onClick={() => navigate('/register')}
                        >
                            Get started free →
                        </button>
                        <button
                            className="btn-landing btn-landing--outline btn-landing--lg"
                            onClick={() => navigate('/login')}
                        >
                            Sign in
                        </button>
                    </div>

                    {/* Role cards */}
                    <div className="landing-hero__roles">
                        {[
                            { role: 'Student',  icon: '👨‍🎓', desc: 'Courses, grades & attendance',  color: '#4F46E5', bg: '#EEF2FF' },
                            { role: 'Teacher',  icon: '👩‍🏫', desc: 'Lessons, quizzes & reports',    color: '#7C3AED', bg: '#F5F3FF' },
                            { role: 'Admin',    icon: '🏫',   desc: 'Users, fees & analytics',        color: '#0F766E', bg: '#F0FDFA' },
                        ].map((r) => (
                            <div
                                key={r.role}
                                className="landing-role-card"
                                onClick={() => navigate('/login')}
                                style={{ '--rc': r.color, '--rb': r.bg }}
                            >
                                <div className="landing-role-card__icon">{r.icon}</div>
                                <div className="landing-role-card__role">{r.role}</div>
                                <div className="landing-role-card__desc">{r.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ STATS ══ */}
            <section className="landing-stats">
                <div className="landing-stats__inner">
                    {STATS.map((s) => (
                        <div key={s.label} className="landing-stats__item">
                            <div className="landing-stats__value">{s.value}</div>
                            <div className="landing-stats__label">{s.label}</div>
                            <div className="landing-stats__sub">{s.sub}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══ ABOUT ══ */}
            <section id="about" className="landing-section">
                <div className="landing-section__inner landing-about">
                    <div className="landing-about__text">
                        <div className="landing-section__eyebrow">About</div>
                        <h2 className="landing-section__title">
                            Built for modern schools<br />and colleges
                        </h2>
                        <p className="landing-section__body">
                            School ERP is a full-stack MERN application designed to digitalise every
                            aspect of school and college administration. From student enrolment to fee
                            collection, lesson delivery to real-time notifications — everything lives in
                            one secure, cloud-hosted platform.
                        </p>
                        <p className="landing-section__body">
                            Built with React, Node.js, Express, and MongoDB Atlas, it uses JWT
                            authentication, role-based access control, and Socket.io for live updates.
                            Teachers create lessons and quizzes; students learn and track progress;
                            admins manage users and generate reports — all without leaving the platform.
                        </p>
                        <div className="landing-about__tags">
                            {['React.js', 'Node.js', 'Express', 'MongoDB Atlas', 'Socket.io', 'Redux Toolkit', 'JWT', 'PDFKit'].map((t) => (
                                <span key={t} className="landing-tag">{t}</span>
                            ))}
                        </div>
                    </div>

                    {/* How it works steps */}
                    <div className="landing-about__steps">
                        {STEPS.map((s) => (
                            <div key={s.num} className="landing-step">
                                <div className="landing-step__num">{s.num}</div>
                                <div>
                                    <div className="landing-step__title">{s.title}</div>
                                    <div className="landing-step__desc">{s.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ FEATURES ══ */}
            <section id="features" className="landing-section landing-section--alt">
                <div className="landing-section__inner">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <div className="landing-section__eyebrow">Features</div>
                        <h2 className="landing-section__title">Everything you need</h2>
                        <p className="landing-section__body" style={{ maxWidth: 560, margin: '0 auto' }}>
                            Eight deeply integrated modules that work together seamlessly — no
                            third-party integrations required.
                        </p>
                    </div>

                    <div className="landing-features-grid">
                        {FEATURES.map((f) => (
                            <div key={f.title} className="landing-feature-card">
                                <div className="landing-feature-card__icon">{f.icon}</div>
                                <h3 className="landing-feature-card__title">{f.title}</h3>
                                <p className="landing-feature-card__desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ CTA BAND ══ */}
            <section className="landing-cta-band">
                <div className="landing-cta-band__inner">
                    <h2>Ready to get started?</h2>
                    <p>Create your account in seconds — no credit card required.</p>
                    <div className="landing-cta-band__actions">
                        <button
                            className="btn-landing btn-landing--primary btn-landing--lg"
                            onClick={() => navigate('/register')}
                        >
                            Register as student →
                        </button>
                        <button
                            className="btn-landing btn-landing--ghost"
                            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
                            onClick={() => navigate('/login')}
                        >
                            Already have an account
                        </button>
                    </div>
                </div>
            </section>

            {/* ══ CONTACT ══ */}
            <section id="contact" className="landing-section">
                <div className="landing-section__inner landing-contact">
                    {/* Info side */}
                    <div className="landing-contact__info">
                        <div className="landing-section__eyebrow">Contact</div>
                        <h2 className="landing-section__title">Get in touch</h2>
                        <p className="landing-section__body">
                            Have a question about the platform, need a demo, or want to set it up
                            for your institution? Reach out — we'd love to hear from you.
                        </p>
                        <div className="landing-contact__items">
                            {[
                                { icon: '📍', label: 'Address',  val: '123 School Lane, Colombo 03, Sri Lanka' },
                                { icon: '📞', label: 'Phone',    val: '+94 11 234 5678' },
                                { icon: '✉',  label: 'Email',    val: 'hello@schoolerp.lk' },
                                { icon: '🕐', label: 'Hours',    val: 'Mon – Fri, 8 AM – 5 PM' },
                            ].map((c) => (
                                <div key={c.label} className="landing-contact__item">
                                    <div className="landing-contact__item-icon">{c.icon}</div>
                                    <div>
                                        <div className="landing-contact__item-label">{c.label}</div>
                                        <div className="landing-contact__item-val">{c.val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contact form */}
                    <div className="landing-contact__form-wrap">
                        <ContactForm />
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
}

/* ── Contact form (local state only — wire to API in production) ── */
function ContactForm() {
    const [form, setForm]           = useState({ name: '', email: '', subject: '', message: '' });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading]     = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => { setLoading(false); setSubmitted(true); }, 1000);
    };

    if (submitted) return (
        <div className="landing-contact__success">
            <div style={{ fontSize: '3rem' }}>✅</div>
            <h3>Message sent!</h3>
            <p>Thank you for reaching out. We'll get back to you within one business day.</p>
            <button className="btn-landing btn-landing--outline" onClick={() => setSubmitted(false)}>
                Send another
            </button>
        </div>
    );

    return (
        <form className="landing-contact__form" onSubmit={handleSubmit}>
            <h3 className="landing-contact__form-title">Send us a message</h3>
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Your name *</label>
                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="Full name" />
                </div>
                <div className="form-group">
                    <label className="form-label">Email address *</label>
                    <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" />
                </div>
            </div>
            <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-input" name="subject" value={form.subject} onChange={handleChange} required placeholder="What is this about?" />
            </div>
            <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea
                    className="form-input"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Tell us more…"
                    style={{ resize: 'vertical' }}
                />
            </div>
            <button
                type="submit"
                className="btn-landing btn-landing--primary btn-landing--lg"
                disabled={loading}
                style={{ width: '100%' }}
            >
                {loading ? 'Sending…' : 'Send message →'}
            </button>
        </form>
    );
}