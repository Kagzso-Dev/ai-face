import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, UserX, TrendingUp,
  Clock, Calendar, ChevronRight, Activity,
  RefreshCw, Camera, UserPlus, ClipboardList,
} from 'lucide-react';
import { getDashboardStats } from '../utils/storageUtils';

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, gradient, glow, delay = 0 }) => (
  <motion.div
    variants={itemVariants}
    whileHover={{ y: -4, scale: 1.01 }}
    transition={{ delay }}
    className="stat-card group relative overflow-hidden p-4 sm:p-6"
  >
    {/* background glow */}
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glow}`} />

    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon size={22} className="text-white" />
        </div>
        <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">Today</span>
      </div>

      <div className="space-y-1">
        <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-sm font-medium text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-600">{sub}</p>}
      </div>
    </div>
  </motion.div>
);

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
const WeeklyChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = d.date === new Date().toISOString().split('T')[0];

        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, 4)}%` }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                className={`w-full rounded-t-md ${
                  isToday
                    ? 'bg-gradient-to-t from-blue-600 to-purple-500 shadow-lg shadow-blue-500/30'
                    : 'bg-white/10 hover:bg-white/20 transition-colors'
                }`}
                title={`${d.date}: ${d.count}`}
                style={{ minHeight: 4 }}
              />
            </div>
            <p className={`text-xs ${isToday ? 'text-blue-400 font-semibold' : 'text-gray-600'}`}>{dayLabel}</p>
          </div>
        );
      })}
    </div>
  );
};

// ─── Recent Activity Row ──────────────────────────────────────────────────────
const RecentRow = ({ record, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
  >
    {/* Avatar */}
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/40 to-purple-600/40 border border-white/10 flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
      {record.name.charAt(0).toUpperCase()}
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-white truncate">{record.name}</p>
      <p className="text-xs text-gray-500 truncate">{record.department}</p>
    </div>

    <div className="text-right flex-shrink-0">
      <p className="text-xs font-medium text-blue-400">{record.time}</p>
      <p className="text-xs text-gray-600">{record.date}</p>
    </div>

    <span className="status-recognized">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Present
    </span>
  </motion.div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setStats(getDashboardStats());
      setRefreshing(false);
    }, 400);
  };

  useEffect(() => {
    setStats(getDashboardStats());
  }, []);

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const attendanceRate = stats.totalRegistered > 0
    ? Math.round((stats.presentToday / stats.totalRegistered) * 100)
    : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6"
    >
      {/* ── Page header ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </motion.button>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={Users}
          label="Total Registered"
          value={stats.totalRegistered}
          sub="All-time registrations"
          gradient="from-blue-600 to-blue-800"
          glow="bg-gradient-to-br from-blue-600/10 to-transparent"
        />
        <StatCard
          icon={UserCheck}
          label="Present Today"
          value={stats.presentToday}
          sub={`${attendanceRate}% attendance rate`}
          gradient="from-green-500 to-emerald-700"
          glow="bg-gradient-to-br from-green-600/10 to-transparent"
        />
        <StatCard
          icon={UserX}
          label="Absent Today"
          value={stats.absentToday}
          sub="Not yet marked"
          gradient="from-red-500 to-rose-700"
          glow="bg-gradient-to-br from-red-600/10 to-transparent"
        />
        <StatCard
          icon={TrendingUp}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          sub="Today's rate"
          gradient="from-purple-600 to-purple-800"
          glow="bg-gradient-to-br from-purple-600/10 to-transparent"
        />
      </div>

      {/* ── Charts + Quick actions row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">

        {/* Weekly chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Weekly Attendance</h2>
              <p className="text-xs text-gray-500 mt-0.5">Last 7 days overview</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-600 to-purple-500" />
              <span className="text-xs text-gray-500">Today</span>
            </div>
          </div>
          <WeeklyChart data={stats.weeklyData} />
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={itemVariants} className="glass-card p-6 space-y-3">
          <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>

          {[
            { label: 'Take Attendance', desc: 'Scan & mark present', page: 'attendance', gradient: 'from-blue-600 to-purple-600', icon: Camera },
            { label: 'Register New Face', desc: 'Add team member', page: 'register', gradient: 'from-purple-600 to-pink-600', icon: UserPlus },
            { label: 'View Records', desc: 'Full attendance log', page: 'records', gradient: 'from-cyan-600 to-blue-600', icon: ClipboardList },
          ].map(({ label, desc, page, gradient, icon: Icon }) => (
            <motion.button
              key={page}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate(page)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 border border-white/5 hover:border-white/15 transition-all group"
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* ── Recent Activity ── */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Activity size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold text-white">Recent Attendance</h2>
          </div>
          <button
            onClick={() => onNavigate('records')}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>

        {stats.recentRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Clock size={28} className="text-gray-600" />
            </div>
            <p className="text-gray-500 font-medium">No attendance records yet</p>
            <p className="text-gray-600 text-sm mt-1">Start by taking attendance with the camera</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('attendance')}
              className="btn-primary mt-4 text-sm"
            >
              Take Attendance
            </motion.button>
          </div>
        ) : (
          <div className="space-y-1">
            {stats.recentRecords.map((record, i) => (
              <RecentRow key={record.id} record={record} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
