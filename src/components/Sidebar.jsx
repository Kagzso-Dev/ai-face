import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, UserPlus, Camera, ClipboardList,
  ChevronLeft, ChevronRight, Cpu, LogOut, Shield, User, X,
} from 'lucide-react';
import Logo from './Logo';

const ALL_NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',         icon: LayoutDashboard, roles: ['admin'] },
  { id: 'attendance', label: 'Take Attendance',    icon: Camera,          roles: ['admin', 'user'] },
  { id: 'register',   label: 'Register Face',      icon: UserPlus,        roles: ['admin'] },
  { id: 'records',    label: 'Attendance Records', icon: ClipboardList,   roles: ['admin'] },
];

const Sidebar = ({ currentPage, onNavigate, collapsed, onToggleCollapse, role, onLogout, mobileDrawer }) => {
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => item.roles.includes(role));

  return (
    <motion.aside
      animate={{ width: collapsed && !mobileDrawer ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full bg-dark-800 border-r border-white/10 overflow-hidden flex-shrink-0"
      style={{ minWidth: collapsed && !mobileDrawer ? 72 : 260, height: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="relative flex-shrink-0">
          <Logo size={collapsed ? 36 : 40} />
          <span className="absolute inset-0 rounded-xl bg-blue-500/20 animate-ping"
            style={{ animationDuration: '2.5s' }} />
        </div>

        <AnimatePresence>
          {(!collapsed || mobileDrawer) && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
              className="flex-1 overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">Kagzso</p>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest whitespace-nowrap">Attendance System</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button — mobile drawer only */}
        {mobileDrawer && (
          <button onClick={onToggleCollapse}
            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>



      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon   = item.icon;
          const active = currentPage === item.id;
          const show   = !collapsed || mobileDrawer;
          return (
            <motion.button key={item.id}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-left ${
                active
                  ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/8'
              } ${!show ? 'justify-center' : ''}`}
            >
              <div className={`flex-shrink-0 ${active ? 'text-blue-400' : ''}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <AnimatePresence>
                {show && (
                  <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && show && (
                <motion.div layoutId="activeIndicator"
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              )}
            </motion.button>
          );
        })}
      </nav>



      {/* ── Collapse toggle — desktop only ── */}
      {!mobileDrawer && (
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-[68px] w-7 h-7 rounded-full bg-dark-700 border border-white/20
                     flex items-center justify-center text-gray-400 hover:text-white hover:border-blue-500/50
                     transition-colors duration-200 shadow-lg z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </motion.button>
      )}
    </motion.aside>
  );
};

export default Sidebar;
