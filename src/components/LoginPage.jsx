import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, User, Eye, EyeOff, ChevronRight, Lock, Building2, Loader2, KeyRound, Hash, CheckCircle2, LogOut } from 'lucide-react';
import Logo from './Logo';
import { tenantLogin, createTenant, resolveTenant } from '../utils/storageUtils';

const FloatingOrb = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={{ y: [0, -30, 0], opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: 6, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

// ── Step 1: Org code ──────────────────────────────────────────────────────────
const OrgStep = ({ onNext }) => {
  const [slug, setSlug]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    const clean = slug.trim().toLowerCase();
    if (!clean) { setError('Enter your organisation code.'); return; }
    setLoading(true);
    setError('');
    try {
      const tenant = await resolveTenant(clean);
      onNext({ slug: tenant.slug, name: tenant.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 rounded-2xl border border-blue-500/20 bg-dark-800/80 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
          <Building2 size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-white font-bold">Enter Organisation</h2>
          <p className="text-gray-500 text-xs">Your organisation / company code</p>
        </div>
      </div>

      <input
        type="text"
        value={slug}
        onChange={e => { setSlug(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleNext()}
        placeholder="Enter your organisation code"
        autoFocus
        className="w-full bg-dark-700/60 border border-white/10 rounded-xl px-4 py-3
                   text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/60
                   focus:ring-1 focus:ring-blue-500/30 transition-all mb-3"
      />

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-red-400 text-xs mb-3 pl-1">{error}</motion.p>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={handleNext}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold text-sm
                   hover:from-blue-500 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/20
                   disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        Continue
      </motion.button>
    </div>
  );
};

// ── Reusable labeled input ────────────────────────────────────────────────────
const Field = ({ icon: Icon, label, required, hint, type = 'text', value, onChange, placeholder, maxLength }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <Icon size={11} className="text-blue-400" />
        {label}
        {required && <span className="text-blue-400">*</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full bg-dark-700/60 border border-white/10 rounded-xl px-4 py-2.5
                     text-white placeholder-gray-600 text-sm focus:outline-none
                     focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
                     transition-all duration-200 pr-10"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        {!isPassword && value && (
          <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500/60" />
        )}
      </div>
      {hint && <p className="text-gray-600 text-[10px] pl-1">{hint}</p>}
    </div>
  );
};

// ── Confirm-password field (coloured border on match/mismatch) ───────────────
const ConfirmField = ({ value, onChange, match }) => {
  const [show, setShow] = useState(false);
  const hasValue = value.length > 0;
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder="Re-enter admin password"
        className={`w-full bg-dark-700/60 rounded-xl px-4 py-2.5 pr-10
                   text-white placeholder-gray-600 text-sm focus:outline-none transition-all duration-200
                   border ${hasValue
                     ? match ? 'border-green-500/40 focus:ring-1 focus:ring-green-500/20' : 'border-red-500/40 focus:ring-1 focus:ring-red-500/20'
                     : 'border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20'
                   }`}
      />
      <button type="button" onClick={() => setShow(p => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

// ── Step 1.5: Signup ─────────────────────────────────────────────────────────
const SignupStep = ({ onBack, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '', slug: '', admin_pass: '', admin_pass2: '', user_pass: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const update = (key) => (e) => {
    const val = key === 'slug'
      ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : e.target.value;
    setFormData(p => ({ ...p, [key]: val }));
    setError('');
  };

  const handleSignup = async () => {
    if (!formData.name.trim())   { setError('Organisation name is required.'); return; }
    if (!formData.slug.trim())   { setError('Organisation code is required.'); return; }
    if (!formData.admin_pass)    { setError('Admin password is required.'); return; }
    if (formData.admin_pass.length < 8) { setError('Admin password must be at least 8 characters.'); return; }
    if (!/[a-zA-Z]/.test(formData.admin_pass)) { setError('Password must contain at least one letter.'); return; }
    if (!/[0-9]/.test(formData.admin_pass)) { setError('Password must contain at least one number.'); return; }
    if (formData.admin_pass !== formData.admin_pass2) { setError('Admin passwords do not match.'); return; }

    setLoading(true); setError('');
    try {
      const res = await createTenant({
        name:       formData.name.trim(),
        slug:       formData.slug.trim(),
        admin_pass: formData.admin_pass,
        user_pass:  formData.user_pass || '1234',
      });
      setDone(true);
      setTimeout(() => onSuccess({ slug: res.slug, name: formData.name.trim() }), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filled = formData.name.trim() && formData.slug.trim() && formData.admin_pass && formData.admin_pass2;
  const pwMatch = formData.admin_pass && formData.admin_pass2 && formData.admin_pass === formData.admin_pass2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col rounded-2xl border border-white/10 bg-dark-800/90 backdrop-blur-xl shadow-2xl w-full"
      style={{ maxHeight: 'calc(100svh - 120px)' }}
    >
      {/* Top accent */}
      <div className="h-1 w-full flex-shrink-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-t-2xl" />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-7 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
              <Building2 size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-bold">New Organisation</h2>
              <p className="text-gray-500 text-xs">Set up your workspace &amp; access credentials</p>
            </div>
          </div>
          {!done && (
            <button onClick={onBack} className="text-gray-600 hover:text-white transition-colors mt-0.5">
              <ChevronRight size={18} className="rotate-180" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            /* ── Success ── */
            <motion.div key="done" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.5 }}
                className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 size={30} className="text-green-400" />
              </motion.div>
              <div>
                <p className="text-white font-bold text-base">Organisation Created!</p>
                <p className="text-gray-500 text-xs mt-1">Redirecting to login…</p>
              </div>
              {/* credentials summary */}
              <div className="w-full bg-white/4 border border-white/8 rounded-xl p-4 text-left space-y-2 mt-1">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-medium mb-1">Your credentials</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs flex items-center gap-1.5"><Shield size={11} className="text-blue-400" /> Admin password</span>
                  <span className="text-blue-300 text-xs font-mono bg-blue-500/10 px-2 py-0.5 rounded">{formData.admin_pass}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs flex items-center gap-1.5"><User size={11} className="text-purple-400" /> User Password</span>
                  <span className="text-purple-300 text-xs font-mono bg-purple-500/10 px-2 py-0.5 rounded">{formData.user_pass || '1234'}</span>
                </div>
                <p className="text-gray-600 text-[10px] pt-1">Save these — you will need them to log in.</p>
              </div>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div key="form" exit={{ opacity: 0, x: -20 }} className="space-y-5">

              {/* ── Section 1: Identity ── */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Organisation</p>
                <Field icon={Building2} label="Organisation Name" required
                  placeholder="e.g. Acme Corporation"
                  value={formData.name} onChange={update('name')} />
                <Field icon={Hash} label="Organisation Code" required
                  placeholder="e.g. acme-corp"
                  hint="Lowercase, no spaces. Used as login identifier."
                  value={formData.slug} onChange={update('slug')} />
              </div>

              {/* ── Section 2: Admin credentials ── */}
              <div className="space-y-3 border-t border-white/6 pt-4">
                <div className="flex items-center gap-2">
                  <Shield size={11} className="text-blue-400" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Admin Credentials</p>
                </div>
                <Field icon={KeyRound} label="Admin Password" required type="password"
                  placeholder="Min 8 chars, letters & numbers"
                  value={formData.admin_pass} onChange={update('admin_pass')} />

                {/* Confirm password with inline match indicator */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <KeyRound size={11} className="text-blue-400" />
                    Confirm Admin Password
                    <span className="text-blue-400">*</span>
                    {formData.admin_pass2 && (
                      <span className={`ml-auto text-[10px] font-medium ${pwMatch ? 'text-green-400' : 'text-red-400'}`}>
                        {pwMatch ? '✓ Match' : '✗ No match'}
                      </span>
                    )}
                  </label>
                  <ConfirmField
                    value={formData.admin_pass2}
                    onChange={update('admin_pass2')}
                    match={pwMatch}
                  />
                </div>
              </div>

              {/* ── Section 3: User PIN ── */}
              <div className="space-y-3 border-t border-white/6 pt-4">
                <div className="flex items-center gap-2">
                  <User size={11} className="text-purple-400" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">User Access</p>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3.5 space-y-3">
                  <Field icon={Lock} label="User Password" type="password"
                    placeholder="Default: 1234"
                    hint="Employees enter this password to take attendance."
                    value={formData.user_pass} onChange={update('user_pass')} />
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-xs">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                whileHover={filled ? { scale: 1.02 } : {}}
                whileTap={filled ? { scale: 0.97 } : {}}
                onClick={handleSignup}
                disabled={loading || !filled}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200
                  ${filled
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'}`}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                  : <><Building2 size={16} /> Create Organisation</>
                }
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ── Step 2: Role select ────────────────────────────────────────────────────────
const RoleStep = ({ slug, tenantName, onSelectRole, onBack }) => (
  <div>
    {/* Top bar: org info + logout button */}
    <div className="flex items-center justify-between mb-5">
      <p className="text-gray-400 text-xs">
        Organisation: <span className="text-blue-400 font-medium">{tenantName || slug}</span>
      </p>
      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                   bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40
                   text-red-400 text-xs font-medium transition-all"
      >
        <LogOut size={12} />
        Change Organisation
      </motion.button>
    </div>
    <div className="flex flex-col sm:flex-row gap-4">
      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => onSelectRole('admin')}
        className="group relative w-full sm:w-56 p-5 rounded-2xl border border-blue-500/30
                   bg-gradient-to-br from-blue-900/40 to-dark-800/60 backdrop-blur-xl text-left
                   shadow-xl shadow-blue-500/10 hover:border-blue-400/60 transition-colors duration-300"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mb-3 shadow-lg">
          <Shield size={20} className="text-white" />
        </div>
        <h2 className="text-white font-bold mb-1">Admin</h2>
        <p className="text-gray-400 text-xs leading-relaxed">Full access — Dashboard, Register, Records.</p>
        <div className="mt-3 flex items-center gap-1.5 text-blue-400 text-xs font-medium">
          <Lock size={10} /> Password required
        </div>
        <ChevronRight size={14} className="absolute bottom-5 right-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => onSelectRole('user')}
        className="group relative w-full sm:w-56 p-5 rounded-2xl border border-purple-500/30
                   bg-gradient-to-br from-purple-900/40 to-dark-800/60 backdrop-blur-xl text-left
                   shadow-xl shadow-purple-500/10 hover:border-purple-400/60 transition-colors duration-300"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mb-3 shadow-lg">
          <User size={20} className="text-white" />
        </div>
        <h2 className="text-white font-bold mb-1">User</h2>
        <p className="text-gray-400 text-xs leading-relaxed">Take Attendance only.</p>
        <div className="mt-3 flex items-center gap-1.5 text-purple-400 text-xs font-medium">
          <Lock size={10} /> Password required
        </div>
        <ChevronRight size={14} className="absolute bottom-5 right-4 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
      </motion.button>
    </div>
  </div>
);

// ── Step 3: Password ───────────────────────────────────────────────────────────
const PasswordStep = ({ slug, tenantName, role, onBack, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shaking, setShaking]   = useState(false);

  const isAdmin = role === 'admin';

  const shake = () => { setShaking(true); setTimeout(() => setShaking(false), 500); };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const tenant = await tenantLogin(slug, role, password);
      onSuccess(role, tenant);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className={`p-8 rounded-2xl border backdrop-blur-xl shadow-2xl ${
        isAdmin
          ? 'border-blue-500/30 bg-dark-800/80 shadow-blue-500/10'
          : 'border-purple-500/30 bg-dark-800/80 shadow-purple-500/10'
      }`}
    >
      <button onClick={onBack} className="text-gray-500 hover:text-white text-xs mb-5 flex items-center gap-1 transition-colors">
        ← Back
      </button>

      <div className="flex items-center gap-3 mb-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${
          isAdmin ? 'from-blue-600 to-blue-800' : 'from-purple-600 to-purple-800'
        }`}>
          {isAdmin ? <Shield size={18} className="text-white" /> : <User size={18} className="text-white" />}
        </div>
        <div>
          <h2 className="text-white font-bold">{isAdmin ? 'Admin Login' : 'User Access'}</h2>
          <p className="text-gray-500 text-xs">
            {isAdmin ? 'Enter admin password' : 'Enter user password'}
          </p>
        </div>
      </div>

      <p className="text-gray-600 text-xs mb-5 pl-[52px]">
        Org: <span className="text-blue-400">{tenantName || slug}</span>
      </p>

      <div className="relative mb-4">
        <input
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password"
          inputMode="text"
          maxLength={undefined}
          autoFocus
          className={`w-full bg-dark-700/60 border border-white/10 rounded-xl px-4 py-3 pr-11
                     text-white placeholder-gray-600 text-sm focus:outline-none transition-all
                     ${isAdmin
                       ? 'focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30'
                       : 'focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30'
                     }`}
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
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-red-400 text-xs mb-3 pl-1">{error}</motion.p>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all
                   disabled:opacity-60 flex items-center justify-center gap-2 ${
          isAdmin
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/20'
            : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 shadow-lg shadow-purple-500/20'
        }`}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {isAdmin ? 'Sign In as Admin' : 'Enter as User'}
      </motion.button>
    </motion.div>
  );
};

// ─── Main LoginPage ───────────────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [step, setStep]             = useState('org');
  const [slug, setSlug]             = useState('');
  const [tenantName, setTenantName] = useState('');
  const [role, setRole]             = useState(null);

  const cardVariants = {
    hidden:  { opacity: 0, y: 40, scale: 0.95 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 22 } },
    exit:    { opacity: 0, y: -20, scale: 0.95,
      transition: { duration: 0.2 } },
  };

  const steps = ['org', 'role', 'password'];

  return (
    <div className="relative min-h-screen bg-dark-900 flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto py-8">
      {/* ... orbs ... */}
      <FloatingOrb className="top-[-100px] left-[-80px] w-[450px] h-[450px] bg-blue-700/20" delay={0} />
      <FloatingOrb className="bottom-[-120px] right-[-60px] w-[400px] h-[400px] bg-purple-700/20" delay={2} />
      <FloatingOrb className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-900/10" delay={4} />

      <motion.div
        initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 z-10"
      >
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="relative">
            <div className="flex items-center justify-center">
              <Logo size={48} />
            </div>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Kagzso
          </h1>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'org' && (
          <motion.div key="org" variants={cardVariants} initial="hidden" animate="visible" exit="exit"
            className="z-10 w-full max-w-sm px-4 flex flex-col gap-4">
            <OrgStep onNext={({ slug: s, name: n }) => { setSlug(s); setTenantName(n); setStep('role'); }} />
            <button
              onClick={() => setStep('signup')}
              className="text-gray-500 hover:text-white text-xs transition-colors"
            >
              Don't have an organisation? <span className="text-blue-400 font-bold">Sign up</span>
            </button>
          </motion.div>
        )}

        {step === 'signup' && (
          <motion.div key="signup" variants={cardVariants} initial="hidden" animate="visible" exit="exit"
            className="z-10 w-full max-w-sm px-4">
            <SignupStep
              onBack={() => setStep('org')}
              onSuccess={({ slug: s, name: n }) => { setSlug(s); setTenantName(n); setStep('role'); }}
            />
          </motion.div>
        )}

        {step === 'role' && (
          <motion.div key="role" variants={cardVariants} initial="hidden" animate="visible" exit="exit"
            className="z-10 w-full px-4 max-w-xs sm:max-w-none sm:w-auto">
            <RoleStep
              slug={slug}
              tenantName={tenantName}
              onSelectRole={(r) => { setRole(r); setStep('password'); }}
              onBack={() => setStep('org')}
            />
          </motion.div>
        )}

        {step === 'password' && (
          <motion.div key="password" variants={cardVariants} initial="hidden" animate="visible" exit="exit"
            className="z-10 w-full max-w-sm px-4">
            <PasswordStep
              slug={slug}
              tenantName={tenantName}
              role={role}
              onBack={() => setStep('role')}
              onSuccess={onLogin}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
