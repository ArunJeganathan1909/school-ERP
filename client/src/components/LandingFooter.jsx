import { useNavigate } from 'react-router-dom';
import './LandingFooter.css';

export default function LandingFooter() {
    const navigate = useNavigate();
    const year = new Date().getFullYear();

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <footer className="landing-footer">
            <div className="landing-footer__inner">

                {/* Brand column */}
                <div className="landing-footer__brand">
                    <div className="landing-footer__logo">
                        <div className="landing-footer__logo-icon">S</div>
                        <div>
                            <div className="landing-footer__logo-name">School ERP</div>
                            <div className="landing-footer__logo-sub">Management System</div>
                        </div>
                    </div>
                    <p className="landing-footer__tagline">
                        A complete school and college management platform — built for students,
                        teachers, and administrators.
                    </p>
                    <div className="landing-footer__socials">
                        {['𝕏', 'in', 'fb', 'yt'].map((s) => (
                            <a key={s} href="#" className="landing-footer__social-btn" aria-label={s}>
                                {s}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Platform links */}
                <div className="landing-footer__col">
                    <h4 className="landing-footer__col-title">Platform</h4>
                    <ul className="landing-footer__links">
                        <li><button onClick={() => scrollTo('features')}>Features</button></li>
                        <li><button onClick={() => scrollTo('about')}>About us</button></li>
                        <li><button onClick={() => navigate('/login')}>Student portal</button></li>
                        <li><button onClick={() => navigate('/login')}>Teacher portal</button></li>
                        <li><button onClick={() => navigate('/login')}>Admin portal</button></li>
                    </ul>
                </div>

                {/* Modules */}
                <div className="landing-footer__col">
                    <h4 className="landing-footer__col-title">Modules</h4>
                    <ul className="landing-footer__links">
                        {[
                            'LMS & Content',
                            'Attendance',
                            'Fee management',
                            'Assignments & Quizzes',
                            'Reports & Analytics',
                            'Notifications',
                        ].map((m) => (
                            <li key={m}><span>{m}</span></li>
                        ))}
                    </ul>
                </div>

                {/* Contact */}
                <div className="landing-footer__col">
                    <h4 className="landing-footer__col-title">Contact</h4>
                    <ul className="landing-footer__links landing-footer__contact">
                        <li>
                            <span className="landing-footer__contact-icon">📍</span>
                            <span>123 School Lane, Colombo 03, Sri Lanka</span>
                        </li>
                        <li>
                            <span className="landing-footer__contact-icon">📞</span>
                            <span>+94 11 234 5678</span>
                        </li>
                        <li>
                            <span className="landing-footer__contact-icon">✉</span>
                            <span>hello@schoolerp.lk</span>
                        </li>
                        <li>
                            <span className="landing-footer__contact-icon">🕐</span>
                            <span>Mon – Fri, 8 AM – 5 PM</span>
                        </li>
                    </ul>
                </div>

            </div>

            {/* Bottom bar */}
            <div className="landing-footer__bottom">
                <div className="landing-footer__bottom-inner">
                    <p>© {year} School ERP. All rights reserved.</p>
                    <div className="landing-footer__bottom-links">
                        <a href="#">Privacy policy</a>
                        <a href="#">Terms of service</a>
                        <a href="#">Cookie policy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}