import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, User, Eye, EyeOff, ChevronRight, Lock, Zap } from 'lucide-react';
import Logo from './Logo';

const ADMIN_PASSWORD = 'admin123';

const FloatingOrb = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={{ y: [0, -30, 0], opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: 6, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState(null); // null | 'admin' | 'user'
  const [password, setPassword] = useState('');
  const [pin, setPin]           = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [shaking, setShaking]   = useState(false);

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleAdminLogin = () => {
    if (password === ADMIN_PASSWORD) {
      onLogin('admin');
    } else {
      setError('Incorrect password. Try "admin123".');
      shake();
    }
  };

  const handleUserLogin = () => {
    // User mode: no PIN required — just enter, OR if PIN set check it
    if (pin.length === 0 || pin === '1234') {
      onLogin('user');
    } else {
      setError('Incorrect PIN. Default is 1234 or leave blank.');
      shake();
    }
  };

  const cardVariants = {
    hidden:  { opacity: 0, y: 40, scale: 0.95 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 22 } },
    exit:    { opacity: 0, y: -20, scale: 0.95,
      transition: { duration: 0.2 } },
  };

  return (
    <div className="relative min-h-screen bg-dark-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient orbs */}
      <FloatingOrb className="top-[-100px] left-[-80px] w-[450px] h-[450px] bg-blue-700/20" delay={0} />
      <FloatingOrb className="bottom-[-120px] right-[-60px] w-[400px] h-[400px] bg-purple-700/20" delay={2} />
      <FloatingOrb className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-900/10" delay={4} />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 z-10"
      >
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <div className="flex items-center justify-center shadow-2xl shadow-blue-500/30">
              <Logo size={72} />
            </div>
            <motion.span
              className="absolute inset-0 rounded-2xl border-2 border-blue-400/40"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Kagzso</h1>
        <p className="text-gray-500 text-sm mt-1">Smart Face Recognition Attendance</p>
      </motion.div>

      {/* Mode cards */}
      <AnimatePresence mode="wait">
        {!mode && (
          <motion.div
            key="select"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="z-10 flex flex-col sm:flex-row gap-4 px-4 w-full sm:w-auto max-w-sm sm:max-w-none"
          >
            {/* Admin card */}
            <motion.button
              whileHover={{ scale: 1.04, rotateY: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setMode('admin'); setError(''); }}
              className="group relative w-full sm:w-64 p-5 sm:p-7 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-900/40 to-dark-800/60
                         backdrop-blur-xl text-left shadow-xl shadow-blue-500/10 hover:border-blue-400/60 transition-colors duration-300"
              style={{ perspective: 600 }}
            >
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center
                              group-hover:bg-blue-500/40 transition-colors duration-300">
                <Shield size={15} className="text-blue-400" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mb-4 shadow-lg">
                <Shield size={22} className="text-white" />
              </div>
              <h2 className="text-white font-bold text-lg mb-1">Admin Mode</h2>
              <p className="text-gray-400 text-xs leading-relaxed">
                Full access — Dashboard, Register Face, Take Attendance, View Records.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-blue-400 text-xs font-medium">
                <Lock size={11} /> Password required
              </div>
              <ChevronRight size={16} className="absolute bottom-6 right-5 text-gray-600 group-hover:text-blue-400
                                                  group-hover:translate-x-1 transition-all duration-200" />
            </motion.button>

            {/* User card */}
            <motion.button
              whileHover={{ scale: 1.04, rotateY: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setMode('user'); setError(''); }}
              className="group relative w-full sm:w-64 p-5 sm:p-7 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-dark-800/60
                         backdrop-blur-xl text-left shadow-xl shadow-purple-500/10 hover:border-purple-400/60 transition-colors duration-300"
              style={{ perspective: 600 }}
            >
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center
                              group-hover:bg-purple-500/40 transition-colors duration-300">
                <User size={15} className="text-purple-400" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mb-4 shadow-lg">
                <User size={22} className="text-white" />
              </div>
              <h2 className="text-white font-bold text-lg mb-1">User Mode</h2>
              <p className="text-gray-400 text-xs leading-relaxed">
                Limited access — Take Attendance only. No login required.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-purple-400 text-xs font-medium">
                <Zap size={11} /> Quick access
              </div>
              <ChevronRight size={16} className="absolute bottom-6 right-5 text-gray-600 group-hover:text-purple-400
                                                  group-hover:translate-x-1 transition-all duration-200" />
            </motion.button>
          </motion.div>
        )}

        {/* Admin login form */}
        {mode === 'admin' && (
          <motion.div
            key="admin-form"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="z-10 w-full max-w-sm px-4"
          >
            <motion.div
              animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="p-8 rounded-2xl border border-blue-500/30 bg-dark-800/80 backdrop-blur-xl shadow-2xl shadow-blue-500/10"
            >
              <button onClick={() => { setMode(null); setError(''); setPassword(''); }}
                className="text-gray-500 hover:text-white text-xs mb-5 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                  <Shield size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold">Admin Login</h2>
                  <p className="text-gray-500 text-xs">Enter your admin password</p>
                </div>
              </div>

              <div className="relative mb-4">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Password"
                  autoFocus
                  className="w-full bg-dark-700/60 border border-white/10 rounded-xl px-4 py-3 pr-11
                             text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/60
                             focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-red-400 text-xs mb-3 pl-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleAdminLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm
                           hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/20"
              >
                Sign In as Admin
              </motion.button>
              <p className="text-gray-600 text-xs text-center mt-3">Default: admin123</p>
            </motion.div>
          </motion.div>
        )}

        {/* User login form */}
        {mode === 'user' && (
          <motion.div
            key="user-form"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="z-10 w-full max-w-sm px-4"
          >
            <motion.div
              animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="p-8 rounded-2xl border border-purple-500/30 bg-dark-800/80 backdrop-blur-xl shadow-2xl shadow-purple-500/10"
            >
              <button onClick={() => { setMode(null); setError(''); setPin(''); }}
                className="text-gray-500 hover:text-white text-xs mb-5 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold">User Access</h2>
                  <p className="text-gray-500 text-xs">Leave blank or enter PIN (default 1234)</p>
                </div>
              </div>

              {/* PIN dots */}
              <div className="relative mb-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleUserLogin()}
                  placeholder="PIN (optional)"
                  className="w-full bg-dark-700/60 border border-white/10 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 text-sm text-center tracking-[0.5em]
                             focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-red-400 text-xs mb-3 pl-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleUserLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold text-sm
                           hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/20"
              >
                Enter as User
              </motion.button>
              <p className="text-gray-600 text-xs text-center mt-3">Access to Take Attendance only</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="absolute bottom-6 text-gray-700 text-xs z-10"
      >
        Kagzso · Smart Attendance System
      </motion.p>
    </div>
  );
};

export default LoginPage;
