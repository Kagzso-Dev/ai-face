import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Search, Download, Trash2,
  Calendar, Filter, ChevronUp, ChevronDown, Clock,
  Users, CheckCircle, RefreshCw, X, ArrowLeft,
} from 'lucide-react';
import {
  getAttendanceRecords, deleteAttendanceRecord,
  clearAttendanceRecords, exportToCSV,
} from '../utils/storageUtils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 border border-white/8`}>
    <Icon size={16} className={color} />
    <div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  </div>
);

// ─── Sort indicator ───────────────────────────────────────────────────────────
const SortIcon = ({ col, sortKey, dir }) => {
  if (sortKey !== col) return <ChevronUp size={12} className="text-gray-700" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-400" />
    : <ChevronDown size={12} className="text-blue-400" />;
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="glass-card p-6 max-w-sm w-full space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <Trash2 size={18} className="text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold">Confirm Delete</p>
          <p className="text-gray-400 text-sm mt-1">{message}</p>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
        >
          Delete
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AttendanceRecords = ({ onNavigate }) => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [confirmModal, setConfirmModal] = useState(null); // { type, id? }
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const refresh = () => setRecords(getAttendanceRecords());

  useEffect(() => { refresh(); }, []);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set(records.map(r => r.department).filter(Boolean));
    return ['', ...Array.from(set).sort()];
  }, [records]);

  // Today's date string
  const today = new Date().toISOString().split('T')[0];

  // Filter + sort
  const filtered = useMemo(() => {
    let arr = [...records];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
      );
    }
    if (filterDate) arr = arr.filter(r => r.date === filterDate);
    if (filterDept) arr = arr.filter(r => r.department === filterDept);

    arr.sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [records, search, filterDate, filterDept, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const handleDelete = (id) => {
    setConfirmModal({ type: 'single', id });
  };

  const handleClearAll = () => {
    setConfirmModal({ type: 'all' });
  };

  const confirmDelete = () => {
    if (confirmModal.type === 'single') {
      deleteAttendanceRecord(confirmModal.id);
    } else {
      clearAttendanceRecords();
    }
    refresh();
    setConfirmModal(null);
  };

  const handleExport = () => {
    const dateStr = filterDate || today;
    exportToCSV(filtered, `attendance_${dateStr}.csv`);
  };

  // Stats
  const todayCount = useMemo(() => records.filter(r => r.date === today).length, [records]);
  const uniquePeople = useMemo(() => new Set(records.map(r => r.userId)).size, [records]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [search, filterDate, filterDept]);

  const TH = ({ label, col }) => (
    <th
      className="table-header cursor-pointer select-none hover:text-gray-200 transition-colors"
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <SortIcon col={col} sortKey={sortKey} dir={sortDir} />
      </div>
    </th>
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-xl
                       bg-white/6 hover:bg-white/12 border border-white/10 hover:border-white/20
                       text-gray-400 hover:text-white transition-all duration-200 group flex-shrink-0"
          >
            <ArrowLeft size={18} className="text-blue-400 group-hover:text-blue-300" />
            <span className="text-sm font-medium">Back</span>
          </motion.button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Attendance Records</h1>
            <p className="text-sm text-gray-500 mt-0.5">Complete attendance history with filters and export</p>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={refresh}
            className="btn-secondary flex items-center gap-2 py-2 px-3"
          >
            <RefreshCw size={15} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            Export CSV
          </motion.button>
          {records.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 text-sm font-medium transition-all"
            >
              <Trash2 size={15} />
              Clear All
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <StatPill icon={ClipboardList} label="Total Records" value={records.length} color="text-blue-400" />
        <StatPill icon={CheckCircle} label="Present Today" value={todayCount} color="text-green-400" />
        <StatPill icon={Users} label="Unique People" value={uniquePeople} color="text-purple-400" />
        <StatPill icon={Filter} label="Filtered" value={filtered.length} color="text-cyan-400" />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="glass-card p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or department…"
              className="input-field pl-10 py-2.5 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date filter */}
          <div className="relative">
            <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="input-field pl-9 py-2.5 text-sm w-44 [color-scheme:dark]"
            />
            {filterDate && (
              <button onClick={() => setFilterDate('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department filter */}
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="input-field py-2.5 text-sm w-48 cursor-pointer bg-dark-700"
          >
            {departments.map(d => (
              <option key={d} value={d} className="bg-gray-900">
                {d === '' ? 'All Departments' : d}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Records Display — Table on MD+, Cards on mobile */}
      <motion.div variants={itemVariants} className="space-y-4">
        {/* Desktop Table (Hidden on mobile) */}
        <div className="hidden md:block glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10 bg-white/3">
                <tr>
                  <th className="table-header w-10 text-center">#</th>
                  <TH label="Name" col="name" />
                  <TH label="Department" col="department" />
                  <TH label="Date" col="date" />
                  <TH label="Time" col="time" />
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <ClipboardList size={36} className="text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">
                          {records.length === 0 ? 'No records' : 'No matches'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((record, i) => (
                      <motion.tr key={record.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="table-row">
                        <td className="table-cell text-center text-gray-600 text-xs">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/8 flex items-center justify-center text-xs font-bold text-blue-300">
                              {record.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-white">{record.name}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/8">{record.department}</span>
                        </td>
                        <td className="table-cell flex items-center gap-1.5 mt-2.5">
                          <Calendar size={12} className="text-gray-600" />
                          <span className={record.date === today ? 'text-blue-400 font-medium' : ''}>{record.date}</span>
                        </td>
                        <td className="table-cell font-mono text-xs">{record.time}</td>
                        <td className="table-cell">
                          <span className="status-recognized">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            {record.status || 'Present'}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <button onClick={() => handleDelete(record.id)} className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/30 flex items-center justify-center text-red-400 ml-auto">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card List (Hidden on md+) */}
        <div className="md:hidden space-y-3">
          {paginated.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <ClipboardList size={32} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No records found</p>
            </div>
          ) : (
            paginated.map((record, i) => (
              <motion.div key={record.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="glass-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center font-bold text-blue-300">
                      {record.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{record.name}</p>
                      <p className="text-[10px] text-gray-500">{record.department}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(record.id)} className="p-2 rounded-lg bg-red-500/15 text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Calendar size={12} className="text-gray-600" />
                      {record.date === today ? <span className="text-blue-400 font-medium">Today</span> : record.date}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Clock size={12} className="text-gray-600" />
                      {record.time}
                    </div>
                  </div>
                  <span className="status-recognized !text-[10px] !px-2 !py-0.5">
                    Present
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass-card flex items-center justify-between px-4 py-3 mt-4">
          <p className="text-xs text-gray-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-gray-400 transition-colors"
            >
              <ChevronUp size={14} className="rotate-[-90deg]" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) { p = i + 1; }
              else if (currentPage <= 3) { p = i + 1; }
              else if (currentPage >= totalPages - 2) { p = totalPages - 4 + i; }
              else { p = currentPage - 2 + i; }
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400'
                    }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-gray-400 transition-colors"
            >
              <ChevronDown size={14} className="rotate-[-90deg]" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            message={
              confirmModal.type === 'all'
                ? `This will permanently delete all ${records.length} attendance records. This cannot be undone.`
                : 'This will permanently delete this attendance record.'
            }
            onConfirm={confirmDelete}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AttendanceRecords;
