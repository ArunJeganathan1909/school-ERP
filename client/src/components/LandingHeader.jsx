import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './LandingHeader.css';

export default function LandingHeader() {
    const navigate   = useNavigate();
    const location   = useLocation();
    const { token, user } = useSelector((s) => s.auth);
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    /* shrink header on scroll */
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    /* smooth-scroll to section or navigate to landing first */
    const scrollTo = (id) => {
        setMenuOpen(false);
        if (location.pathname !== '/') {
            navigate('/');
            setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const goToDashboard = () => {
        if (!user) return;
        navigate(`/${user.role}/dashboard`);
    };

    return (
        <header className={`landing-header ${scrolled ? 'landing-header--scrolled' : ''}`}>
            <div className="landing-header__inner">

                {/* Logo */}
                <button className="landing-header__logo" onClick={() => navigate('/')}>
                    <div className="landing-header__logo-icon">S</div>
                    <div>
                        <div className="landing-header__logo-name">School ERP</div>
                        <div className="landing-header__logo-sub">Management System</div>
                    </div>
                </button>

                {/* Desktop nav */}
                <nav className="landing-header__nav">
                    <button className="landing-nav-link" onClick={() => scrollTo('hero')}>Home</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('about')}>About</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('features')}>Features</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('contact')}>Contact</button>
                </nav>

                {/* CTA buttons */}
                <div className="landing-header__cta">
                    {token && user ? (
                        <button className="btn-landing btn-landing--primary" onClick={goToDashboard}>
                            Go to dashboard →
                        </button>
                    ) : (
                        <>
                            <button
                                className="btn-landing btn-landing--ghost"
                                onClick={() => navigate('/login')}
                            >
                                Log in
                            </button>
                            <button
                                className="btn-landing btn-landing--primary"
                                onClick={() => navigate('/register')}
                            >
                                Register free
                            </button>
                        </>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    className={`landing-header__burger ${menuOpen ? 'open' : ''}`}
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Toggle menu"
                >
                    <span /><span /><span />
                </button>
            </div>

            {/* Mobile drawer */}
            {menuOpen && (
                <div className="landing-mobile-menu">
                    <button className="landing-nav-link" onClick={() => scrollTo('hero')}>Home</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('about')}>About</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('features')}>Features</button>
                    <button className="landing-nav-link" onClick={() => scrollTo('contact')}>Contact</button>
                    <div className="landing-mobile-menu__divider" />
                    {token && user ? (
                        <button className="btn-landing btn-landing--primary" onClick={() => { goToDashboard(); setMenuOpen(false); }}>
                            Go to dashboard →
                        </button>
                    ) : (
                        <>
                            <button className="btn-landing btn-landing--ghost" onClick={() => { navigate('/login'); setMenuOpen(false); }}>Log in</button>
                            <button className="btn-landing btn-landing--primary" onClick={() => { navigate('/register'); setMenuOpen(false); }}>Register free</button>
                        </>
                    )}
                </div>
            )}
        </header>
    );
}