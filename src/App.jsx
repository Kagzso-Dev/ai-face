import { useState, Suspense, lazy, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, UserPlus, Camera, ClipboardList, Menu, ArrowLeft, LogOut
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import PageTransitionLoader from './components/PageTransitionLoader';
import AmeliaChat, { ameliaSpeak } from './components/AmeliaChat';

// Lazy load pages
const Dashboard         = lazy(() => import('./components/Dashboard'));
const RegisterFace      = lazy(() => import('./components/RegisterFace'));
const TakeAttendance    = lazy(() => import('./components/TakeAttendance'));
const AttendanceRecords = lazy(() => import('./components/AttendanceRecords'));

const PAGE_MAP = {
  dashboard:  Dashboard,
  register:   RegisterFace,
  attendance: TakeAttendance,
  records:    AttendanceRecords,
};

const ROLE_DEFAULT = { admin: 'dashboard', user: 'attendance' };
const ROLE_PAGES   = {
  admin: ['dashboard', 'attendance', 'register', 'records'],
  user:  ['attendance'],
};

const PAGE_LABELS = {
  dashboard: 'Dashboard', register: 'Register Face',
  attendance: 'Take Attendance', records: 'Records',
};

const ADMIN_NAV = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: Camera },
  { id: 'register',   label: 'Register',   icon: UserPlus },
  { id: 'records',    label: 'Records',    icon: ClipboardList },
];
const USER_NAV = [
  { id: 'attendance', label: 'Attendance', icon: Camera },
];

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, scale: 0.97, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1,    filter: 'blur(0px)',
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 1.02, filter: 'blur(4px)',
    transition: { duration: 0.18, ease: 'easeIn' } },
};

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="spinner" />
  </div>
);

// ── Bottom nav (mobile only) ────────────────────────────────────────────────
const BottomNav = ({ role, currentPage, onNavigate }) => {
  const items = role === 'admin' ? ADMIN_NAV : USER_NAV;
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-dark-800/95 backdrop-blur-xl
                    border-t border-white/10 safe-bottom">
      {items.map(item => {
        const Icon   = item.icon;
        const active = currentPage === item.id;
        return (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium
                        transition-colors duration-200 ${
              active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-blue-500/20' : ''}`}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
            </div>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

const App = () => {
  const [role, setRole]                 = useState(null);
  const [currentPage, setCurrentPage]   = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [time, setTime]                 = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );

  // Live clock
  useEffect(() => {
    const t = setInterval(() =>
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })), 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 1024) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const check = () => { if (window.innerWidth >= 768) setDrawerOpen(false); };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('fa_role');
    if (saved) { setRole(saved); setCurrentPage(ROLE_DEFAULT[saved] || 'attendance'); }
  }, []);

  const handleLogin = (r) => {
    sessionStorage.setItem('fa_role', r);
    setRole(r);
    setCurrentPage(ROLE_DEFAULT[r]);
    const hour = new Date().getHours();
    const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    ameliaSpeak(r === 'admin'
      ? `${g}! Welcome back, Admin. Kagzso dashboard is ready.`
      : `${g}! Welcome. Please proceed to mark your attendance.`
    );
  };

  const handleLogout = () => {
    ameliaSpeak('Goodbye! Have a great day. See you next time.');
    setTimeout(() => {
      sessionStorage.removeItem('fa_role');
      setRole(null);
    }, 600);
  };

  const handleNavigate = useCallback((page) => {
    setDrawerOpen(false);
    if (page === currentPage) return;
    setTransitioning(true);
    const labels = {
      dashboard: 'Opening Dashboard.',
      register:  'Opening Register Face.',
      attendance:'Opening Take Attendance.',
      records:   'Opening Attendance Records.',
    };
    ameliaSpeak(labels[page] || '');
    setTimeout(() => { setCurrentPage(page); setTransitioning(false); }, 340);
  }, [currentPage]);

  const safePage = role && ROLE_PAGES[role]?.includes(currentPage)
    ? currentPage : ROLE_DEFAULT[role] || 'attendance';
  const PageComponent = PAGE_MAP[safePage] || TakeAttendance;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-dark-900">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      {/* Login gate */}
      <AnimatePresence mode="wait">
        {!role && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
            transition={{ duration: 0.4 }} className="absolute inset-0 z-50">
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D transition overlay */}
      <AnimatePresence>
        {transitioning && <PageTransitionLoader key="loader" />}
      </AnimatePresence>

      {role && (
        <>
          {/* ── Mobile drawer backdrop ── */}
          <AnimatePresence>
            {drawerOpen && (
              <motion.div key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDrawerOpen(false)}
                className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              />
            )}
          </AnimatePresence>

          {/* ── Sidebar (desktop: push | mobile: drawer) ── */}
          <div className={`
            hidden md:flex
            ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}
            flex-shrink-0 transition-all duration-300
          `}>
            <Sidebar currentPage={safePage} onNavigate={handleNavigate}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(p => !p)}
              role={role} onLogout={handleLogout} />
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {drawerOpen && (
              <motion.div key="drawer"
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="md:hidden fixed left-0 top-0 bottom-0 z-40 w-[260px]"
              >
                <Sidebar currentPage={safePage} onNavigate={handleNavigate}
                  collapsed={false}
                  onToggleCollapse={() => setDrawerOpen(false)}
                  role={role} onLogout={handleLogout}
                  mobileDrawer />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main content ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Top bar */}
            <div className="flex items-center justify-between
                            px-3 sm:px-6 py-3 sm:py-4
                            border-b border-white/8 bg-dark-800/50 backdrop-blur-xl flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Hamburger — mobile only */}
                <motion.button onClick={() => setDrawerOpen(true)}
                  whileTap={{ scale: 0.92 }}
                  className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400
                             hover:text-white transition-colors border border-white/10 flex-shrink-0">
                  <Menu size={18} />
                </motion.button>

                {/* Back button — show when not on default home page */}
                <AnimatePresence>
                  {safePage !== ROLE_DEFAULT[role] && role && (
                    <motion.button
                      key="back-btn"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      whileHover={{ scale: 1.05, x: -2 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleNavigate(ROLE_DEFAULT[role])}
                      className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-xl
                                 bg-white/6 hover:bg-white/12 border border-white/10 hover:border-white/20
                                 text-gray-400 hover:text-white transition-all duration-200 group flex-shrink-0"
                    >
                      <ArrowLeft size={18} className="text-blue-400 group-hover:text-blue-300" />
                      <span className="text-sm font-medium">Back</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 min-w-0">
                  <span className="text-gray-600 hidden sm:block truncate">Kagzso</span>
                  <span className="text-gray-700 hidden sm:block">/</span>
                  <span className="text-gray-200 font-medium truncate">{PAGE_LABELS[safePage] || safePage}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:block text-xs text-gray-500 mr-2">{time}</span>
                
                {/* Quick Logout Button */}
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 
                             hover:bg-red-500/20 hover:border-red-500/30 transition-all flex items-center gap-2"
                >
                  <LogOut size={16} />
                  <span className="hidden md:block text-xs font-bold uppercase tracking-wider">Logout</span>
                </motion.button>

                <span className={`text-xs px-2 sm:px-2.5 py-0.5 rounded-full border font-medium ${
                  role === 'admin'
                    ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                    : 'text-purple-400 border-purple-500/30 bg-purple-500/10'
                }`}>
                  {role === 'admin' ? 'Admin' : 'User'}
                </span>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
            </div>

            {/* Page content */}
            <div className="flex-1 overflow-hidden flex flex-col pb-16 md:pb-0">
              <AnimatePresence mode="wait">
                <motion.div key={safePage} variants={pageVariants}
                  initial="initial" animate="animate" exit="exit"
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  <Suspense fallback={<PageLoader />}>
                    <PageComponent onNavigate={handleNavigate} role={role} />
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* ── Bottom nav (mobile) ── */}
          <BottomNav role={role} currentPage={safePage} onNavigate={handleNavigate} />

          {/* ── Amelia AI Chat ── */}
          <AmeliaChat />
        </>
      )}
    </div>
  );
};

export default App;
