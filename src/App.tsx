import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  LogOut, 
  Settings, 
  History, 
  UserPlus,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  Utensils
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Database, User, SupportService, Engineer, UsageRecord, Role } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket = io();

export default function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('syndicate_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading user from localStorage:', e);
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('syndicate_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('syndicate_user');
    }
  }, [currentUser]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'engineers' | 'services' | 'users' | 'reports' | 'booking' | 'search-history'>('dashboard');
  const [bookingStep, setBookingStep] = useState<'search' | 'select' | 'confirm'>('search');
  const [bookingEngineer, setBookingEngineer] = useState<Engineer | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const validUsage = useMemo(() => {
    if (!db) return [];
    return db.usage.filter(record => db.engineers.some(e => e.id === record.engineerId));
  }, [db]);

  useEffect(() => {
    // Initial fetch
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        setDb(data);
        setIsLoadingDb(false);
      })
      .catch(err => {
        console.error('Initial fetch error:', err);
        setIsLoadingDb(false);
      });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('db-update', (newDb: Database) => {
      setDb(newDb);
      setIsLoadingDb(false);
    });
    return () => { 
      socket.off('connect');
      socket.off('disconnect');
      socket.off('db-update'); 
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', loginForm.username);
    if (!db) {
      console.error('Database not loaded yet');
      return;
    }
    const user = db.users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      console.log('Login successful:', user.username);
      setCurrentUser(user);
      setError('');
    } else {
      console.warn('Login failed: Invalid credentials');
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSelectedEngineer(null);
  };

  const updateDb = async (type: keyof Database, data: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      });
      if (!response.ok) throw new Error('Failed to save');
    } catch (err) {
      console.error('Save error:', err);
      alert('خطأ في حفظ البيانات على السيرفر المحلي!');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const exportToExcel = () => {
    if (!db) return;
    const wb = XLSX.utils.book_new();
    
    const engineersSheet = XLSX.utils.json_to_sheet(db.engineers);
    XLSX.utils.book_append_sheet(wb, engineersSheet, "المهندسين");
    
    const usageSheet = XLSX.utils.json_to_sheet(db.usage.map(u => ({
      ...u,
      engineerName: db.engineers.find(e => e.id === u.engineerId)?.name,
      serviceName: db.services.find(s => s.id === u.serviceId)?.name
    })));
    XLSX.utils.book_append_sheet(wb, usageSheet, "الاستفادات");

    XLSX.writeFile(wb, "syndicate_data.xlsx");
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      // Basic validation and merging
      const newEngineers = [...db.engineers];
      data.forEach(item => {
        if (item.name && item.membershipNumber) {
          if (!newEngineers.find(e => e.membershipNumber === String(item.membershipNumber))) {
            newEngineers.push({
              id: crypto.randomUUID(),
              name: String(item.name),
              phone: String(item.phone || ''),
              membershipNumber: String(item.membershipNumber)
            });
          }
        }
      });
      updateDb('engineers', newEngineers);
    };
    reader.readAsBinaryString(file);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-accent/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/5 rounded-full blur-[120px]" />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-surface p-10 rounded-[40px] shadow-2xl shadow-brand-ink/5 w-full max-w-md border border-brand-ink/5 relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-20 h-20 bg-brand-ink rounded-[28px] flex items-center justify-center mb-6 shadow-xl shadow-brand-ink/20 overflow-hidden relative"
            >
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-cover z-10" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                referrerPolicy="no-referrer"
              />
              <ShieldCheck className="text-white w-10 h-10 absolute" />
            </motion.div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-2 text-brand-ink">نقابة المهندسين الفرعية بأسيوط</h1>
            <p className="text-brand-ink/40 font-medium">نظام إدارة خدمات الدعم - أسيوط</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <Input 
              label="اسم المستخدم" 
              value={loginForm.username} 
              onChange={v => setLoginForm({ ...loginForm, username: v })} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLogin(e as any);
                }
              }}
              required
            />
            <Input 
              label="كلمة المرور" 
              type="password" 
              value={loginForm.password} 
              onChange={v => setLoginForm({ ...loginForm, password: v })} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLogin(e as any);
                }
              }}
              required
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-red-500 text-sm text-center font-bold bg-red-50 py-2 rounded-xl"
              >
                {error}
              </motion.p>
            )}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoadingDb}
              className={cn(
                "w-full bg-brand-ink text-white rounded-2xl py-4 font-bold transition-all shadow-lg shadow-brand-ink/20 mt-4 font-display text-lg",
                isLoadingDb ? "opacity-50 cursor-not-allowed" : "hover:bg-brand-ink/90"
              )}
            >
              {isLoadingDb ? 'جاري تحميل البيانات...' : 'تسجيل الدخول'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  const filteredEngineers = db?.engineers.filter(e => 
    e.name.includes(searchQuery) || e.membershipNumber.includes(searchQuery)
  ) || [];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans flex" dir="rtl">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-surface border-l border-brand-ink/5 flex flex-col shadow-2xl shadow-brand-ink/5 z-20">
        <div className="p-8 border-b border-brand-ink/5">
          <div className="flex items-center gap-4 mb-4">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="w-12 h-12 bg-brand-ink rounded-2xl flex items-center justify-center overflow-hidden relative shadow-lg"
            >
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-cover z-10" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                referrerPolicy="no-referrer"
              />
              <ShieldCheck className="text-white w-5 h-5 absolute" />
            </motion.div>
            <span className="font-display font-bold text-xl tracking-tight">نقابة المهندسين بأسيوط</span>
          </div>
          <div className="text-[10px] text-brand-ink/30 font-display font-bold uppercase tracking-[0.2em] bg-brand-muted px-3 py-1 rounded-full inline-block">
            {currentUser.role === 'admin' ? 'مدير النظام' : 'موظف'}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="لوحة التحكم"
          />
          <NavItem 
            active={activeTab === 'engineers'} 
            onClick={() => setActiveTab('engineers')}
            icon={<Users size={20} />}
            label="المهندسين"
          />
          <NavItem 
            active={activeTab === 'booking'} 
            onClick={() => setActiveTab('booking')}
            icon={<CreditCard size={20} />}
            label="حجز خدمة"
          />
          <NavItem 
            active={activeTab === 'search-history'} 
            onClick={() => setActiveTab('search-history')}
            icon={<Search size={20} />}
            label="استعلام الاستفادات"
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<History size={20} />}
            label="التقارير"
          />
          {currentUser.role === 'admin' && (
            <>
              <NavItem 
                active={activeTab === 'services'} 
                onClick={() => setActiveTab('services')}
                icon={<Utensils size={20} />}
                label="إدارة الخدمات"
              />
              <NavItem 
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')}
                icon={<Settings size={20} />}
                label="إدارة المستخدمين"
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]/10">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors font-semibold"
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-brand-bg relative">
        <header className="bg-brand-surface/80 backdrop-blur-xl sticky top-0 z-30 p-8 border-b border-brand-ink/5 flex justify-between items-center">
          <h2 className="text-2xl font-display font-bold tracking-tight">
            {activeTab === 'dashboard' && 'نظرة عامة'}
            {activeTab === 'engineers' && 'قائمة المهندسين'}
            {activeTab === 'booking' && 'حجز خدمة لمهندس'}
            {activeTab === 'search-history' && 'استعلام عن استفادات مهندس'}
            {activeTab === 'services' && 'إدارة خدمات الدعم'}
            {activeTab === 'users' && 'إدارة المستخدمين'}
            {activeTab === 'reports' && 'التقارير'}
          </h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-brand-surface shadow-sm border border-brand-ink/5">
              <div className={cn("w-2.5 h-2.5 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]" : "bg-red-500")} />
              <span className="text-[11px] font-bold text-brand-ink/60 font-display">
                {isConnected ? "متصل بالسيرفر" : "فشل الاتصال"}
              </span>
            </div>
            {isSaving && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-blue-600">جاري الحفظ...</span>
              </div>
            )}
            <div className="flex gap-3">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#1a1a1a]/10 hover:bg-[#F5F2ED] transition-colors text-sm font-semibold"
              >
                <Download size={16} />
                تصدير البيانات
              </button>
              {currentUser.role === 'admin' && (
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors text-sm font-semibold cursor-pointer">
                  <Upload size={16} />
                  استيراد مهندسين
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={importFromExcel} />
                </label>
              )}
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'booking' && (
              <motion.div 
                key="booking"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-[#1a1a1a]/5">
                  {bookingStep === 'search' && (
                    <div className="space-y-8 text-center">
                      <div className="space-y-2">
                        <h2 className="text-3xl font-black">حجز خدمة جديدة</h2>
                        <p className="text-[#1a1a1a]/50">أدخل رقم عضوية المهندس للبدء</p>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="رقم العضوية..."
                          className="w-full bg-[#F5F2ED] border-none rounded-2xl px-6 py-5 text-2xl font-bold text-center outline-none focus:ring-4 focus:ring-[#1a1a1a]/5 transition-all"
                          value={bookingSearch}
                          onChange={e => setBookingSearch(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const eng = db?.engineers.find(e => e.membershipNumber === bookingSearch);
                              if (eng) {
                                setBookingEngineer(eng);
                                setBookingStep('select');
                              } else {
                                alert('رقم العضوية غير موجود');
                              }
                            }
                          }}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const eng = db?.engineers.find(e => e.membershipNumber === bookingSearch);
                          if (eng) {
                            setBookingEngineer(eng);
                            setBookingStep('select');
                          } else {
                            alert('رقم العضوية غير موجود');
                          }
                        }}
                        className="w-full bg-[#1a1a1a] text-white py-5 rounded-2xl text-xl font-bold hover:bg-[#333] transition-all"
                      >
                        بحث
                      </button>
                    </div>
                  )}

                  {bookingStep === 'select' && bookingEngineer && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-[#1a1a1a]/10 pb-4">
                        <div>
                          <h2 className="text-2xl font-bold">{bookingEngineer.name}</h2>
                          <p className="text-[#1a1a1a]/50">رقم العضوية: {bookingEngineer.membershipNumber}</p>
                        </div>
                        <button onClick={() => setBookingStep('search')} className="text-sm font-bold text-red-500">تغيير المهندس</button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {db?.services.map(svc => (
                          <ServiceActionCard 
                            key={svc.id} 
                            service={svc} 
                            engineerUsage={db.usage.filter(u => u.engineerId === bookingEngineer.id && u.serviceId === svc.id)}
                            onRecord={(count, price, isDeceasedFamily) => {
                              const newRecord: UsageRecord = {
                                id: crypto.randomUUID(),
                                engineerId: bookingEngineer.id,
                                serviceId: svc.id,
                                count,
                                date: new Date().toISOString(),
                                totalPrice: price,
                                isDeceasedFamily
                              };
                              updateDb('usage', [...(db?.usage || []), newRecord]);
                              setBookingStep('confirm');
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {bookingStep === 'confirm' && (
                    <div className="text-center space-y-6 py-8">
                      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <ShieldCheck size={48} />
                      </div>
                      <h2 className="text-3xl font-bold text-green-600">تم الحجز بنجاح!</h2>
                      <p className="text-[#1a1a1a]/60">تم تسجيل الخدمة في حساب المهندس.</p>
                      <button 
                        onClick={() => {
                          setBookingStep('search');
                          setBookingSearch('');
                          setBookingEngineer(null);
                        }}
                        className="bg-[#1a1a1a] text-white px-8 py-4 rounded-xl font-bold"
                      >
                        حجز خدمة أخرى
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'search-history' && (
              <motion.div 
                key="search-history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-3xl border border-[#1a1a1a]/10 space-y-6">
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/30" size={24} />
                    <input 
                      type="text" 
                      placeholder="ابحث عن مهندس برقم العضوية أو الاسم لعرض سجل استفاداته..."
                      className="w-full bg-[#F5F2ED] border-none rounded-2xl px-14 py-5 text-xl outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 transition-all"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          // Real-time search already filters, but Enter can provide feedback
                          console.log('History search triggered');
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    {db?.engineers.filter(e => e.name.includes(historySearch) || e.membershipNumber.includes(historySearch)).slice(0, 5).map(eng => (
                      <div key={eng.id} className="bg-[#F5F2ED]/50 p-6 rounded-2xl border border-[#1a1a1a]/5">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="text-xl font-bold">{eng.name}</h4>
                            <p className="text-sm text-[#1a1a1a]/50">رقم العضوية: {eng.membershipNumber}</p>
                          </div>
                          <div className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-[#1a1a1a]/10">
                            إجمالي الاستفادات: {db.usage.filter(u => u.engineerId === eng.id).length}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {db.usage.filter(u => u.engineerId === eng.id).reverse().map(record => {
                            const svc = db.services.find(s => s.id === record.serviceId);
                            return (
                              <div key={record.id} className="flex justify-between items-center p-3 bg-white rounded-xl text-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-[#F5F2ED] rounded-lg flex items-center justify-center">
                                    <CreditCard size={14} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold">{svc?.name}</span>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-[#1a1a1a]/40 text-[10px]">العدد: {record.count}</span>
                                      {record.isDeceasedFamily && (
                                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">أسرة متوفي</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <div className="font-mono font-bold">{record.isDeceasedFamily ? "مجاني" : `${record.totalPrice} ج.م`}</div>
                                  <div className="text-[10px] text-[#1a1a1a]/40">{new Date(record.date).toLocaleString('ar-EG')}</div>
                                </div>
                              </div>
                            );
                          })}
                          {db.usage.filter(u => u.engineerId === eng.id).length === 0 && (
                            <p className="text-center text-[#1a1a1a]/30 py-4 italic">لا توجد سجلات استفادة لهذا المهندس</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {historySearch && db?.engineers.filter(e => e.name.includes(historySearch) || e.membershipNumber.includes(historySearch)).length === 0 && (
                      <div className="text-center py-12 text-[#1a1a1a]/40">
                        لم يتم العثور على مهندس بهذا الاسم أو الرقم
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <StatCard 
                  title="إجمالي المهندسين" 
                  value={db?.engineers.length || 0} 
                  icon={<Users size={24} />}
                />
                <StatCard 
                  title="إجمالي الاستفادات" 
                  value={db?.usage.length || 0} 
                  icon={<History size={24} />}
                />
                <StatCard 
                  title="خدمات الدعم المتاحة" 
                  value={db?.services.length || 0} 
                  icon={<CreditCard size={24} />}
                />
                
                {currentUser.role === 'admin' && (
                  <div className="md:col-span-3 bg-blue-50 p-6 rounded-3xl border border-blue-200">
                    <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <Settings size={20} />
                      تشغيل البرنامج على الشبكة المحلية
                    </h3>
                    <p className="text-sm text-blue-700 mb-4">
                      لتشغيل البرنامج على أجهزة أخرى في نفس الشبكة، استخدم عنوان IP الخاص بهذا الجهاز متبوعاً بـ :3000
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 text-xs font-mono">
                        <span className="text-blue-400">الرابط المحلي:</span> http://localhost:3000
                      </div>
                      <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 text-xs font-mono">
                        <span className="text-blue-400">رابط الشبكة:</span> http://[IP_ADDRESS]:3000
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button 
                        onClick={() => {
                          const dataStr = JSON.stringify(db, null, 2);
                          const dataBlob = new Blob([dataStr], { type: 'application/json' });
                          const url = URL.createObjectURL(dataBlob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = 'syndicate_backup.json';
                          link.click();
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        <Download size={14} />
                        تحميل نسخة احتياطية (JSON)
                      </button>
                      <label className="bg-white text-blue-600 border border-blue-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors cursor-pointer">
                        <Upload size={14} />
                        استيراد نسخة احتياطية (JSON)
                        <input 
                          type="file" 
                          accept=".json" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (evt) => {
                              try {
                                const importedDb = JSON.parse(evt.target?.result as string);
                                // Update each part of the DB
                                for (const key in importedDb) {
                                  await updateDb(key as any, importedDb[key]);
                                }
                                alert('تم استيراد البيانات بنجاح');
                              } catch (err) {
                                alert('خطأ في ملف النسخة الاحتياطية');
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            window.location.href = '/api/download-source';
                          }}
                          className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors"
                        >
                          <Download size={14} />
                          تحميل كود البرنامج بالكامل (ZIP)
                        </button>
                        <button 
                          onClick={() => {
                            window.location.href = '/api/db-download';
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
                        >
                          <History size={14} />
                          نسخة احتياطية للبيانات فقط (JSON)
                        </button>
                        <button 
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'مسح سجل التحركات',
                              message: 'هل أنت متأكد من مسح كافة سجلات التحركات والتقارير؟ لا يمكن التراجع عن هذا الإجراء.',
                              onConfirm: () => updateDb('usage', [])
                            });
                          }}
                          className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-colors"
                        >
                          <Trash2 size={14} />
                          مسح كافة السجلات
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-500 mt-4">
                      * لتشغيل البرنامج على جهازك، شغل <code className="bg-blue-100 px-1 rounded">setup_and_run.bat</code> لأول مرة، ثم استخدم <code className="bg-blue-100 px-1 rounded">run_app.bat</code> للتشغيل السريع لاحقاً.
                    </p>
                  </div>
                )}
                
                <div className="md:col-span-3 bg-white p-6 rounded-3xl border border-[#1a1a1a]/10">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <History size={20} />
                    آخر التحركات
                  </h3>
                    <div className="space-y-4">
                      {validUsage.slice(-5).reverse().map(record => {
                        const eng = db?.engineers.find(e => e.id === record.engineerId);
                        const svc = db?.services.find(s => s.id === record.serviceId);
                        return (
                          <div key={record.id} className="flex items-center justify-between p-4 bg-[#F5F2ED] rounded-2xl">
                            <div>
                              <div className="font-bold">{eng?.name}</div>
                              <div className="text-xs text-[#1a1a1a]/50">
                                {svc?.name} - {record.count} وحدة دعم
                                {record.isDeceasedFamily && (
                                  <span className="mr-2 text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">أسرة متوفي</span>
                                )}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="font-mono text-sm">{record.isDeceasedFamily ? "مجاني" : `${record.totalPrice} ج.م`}</div>
                              <div className="text-[10px] text-[#1a1a1a]/40">{new Date(record.date).toLocaleString('ar-EG')}</div>
                            </div>
                          </div>
                        );
                      })}
                      {validUsage.length === 0 && (
                        <div className="text-center py-8 text-[#1a1a1a]/30">لا توجد تحركات مسجلة</div>
                      )}
                    </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'engineers' && (
              <motion.div 
                key="engineers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/30" size={20} />
                    <input 
                      type="text" 
                      placeholder="ابحث بالاسم أو رقم العضوية..."
                      className="w-full bg-white border border-[#1a1a1a]/10 rounded-2xl px-12 py-4 outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 transition-all"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const firstMatch = filteredEngineers[0];
                          if (firstMatch) setSelectedEngineer(firstMatch);
                        }
                      }}
                    />
                  </div>
                  <EngineerModal 
                    existingEngineers={db?.engineers || []}
                    onSave={(eng) => updateDb('engineers', [...(db?.engineers || []), eng])} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-3xl border border-[#1a1a1a]/10 overflow-hidden">
                    <div className="p-4 border-b border-[#1a1a1a]/10 bg-[#F5F2ED]/50 font-bold text-sm">نتائج البحث</div>
                    <div className="divide-y divide-[#1a1a1a]/5 max-h-[600px] overflow-auto">
                      {filteredEngineers.map(eng => (
                        <button 
                          key={eng.id}
                          onClick={() => setSelectedEngineer(eng)}
                          className={cn(
                            "w-full p-4 text-right flex items-center justify-between hover:bg-[#F5F2ED] transition-colors",
                            selectedEngineer?.id === eng.id && "bg-[#F5F2ED]"
                          )}
                        >
                          <div>
                            <div className="font-bold">{eng.name}</div>
                            <div className="text-xs text-[#1a1a1a]/50">عضوية: {eng.membershipNumber}</div>
                          </div>
                          <ChevronRight size={16} className="text-[#1a1a1a]/20" />
                        </button>
                      ))}
                      {filteredEngineers.length === 0 && (
                        <div className="p-8 text-center text-[#1a1a1a]/40">لا توجد نتائج</div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {selectedEngineer ? (
                      <motion.div 
                        key={selectedEngineer.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-3xl border border-[#1a1a1a]/10 p-6 space-y-6"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-2xl font-bold">{selectedEngineer.name}</h3>
                            <p className="text-[#1a1a1a]/50">رقم العضوية: {selectedEngineer.membershipNumber}</p>
                            <p className="text-[#1a1a1a]/50">الهاتف: {selectedEngineer.phone}</p>
                          </div>
                          <div className="flex gap-2">
                            <EngineerModal 
                              engineer={selectedEngineer} 
                              existingEngineers={db?.engineers || []}
                              onSave={(updated) => {
                                const newList = db?.engineers.map(e => e.id === updated.id ? updated : e) || [];
                                updateDb('engineers', newList);
                                setSelectedEngineer(updated);
                              }} 
                            />
                            <button 
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'حذف المهندس',
                                  message: `هل أنت متأكد من حذف المهندس "${selectedEngineer.name}"؟ سيؤدي هذا لحذف كافة سجلات استهلاكه أيضاً.`,
                                  onConfirm: () => {
                                    const newEngineers = db?.engineers.filter(e => e.id !== selectedEngineer.id) || [];
                                    const newUsage = db?.usage.filter(u => u.engineerId !== selectedEngineer.id) || [];
                                    updateDb('engineers', newEngineers);
                                    updateDb('usage', newUsage);
                                    setSelectedEngineer(null);
                                  }
                                });
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-sm uppercase tracking-widest text-[#1a1a1a]/40">إضافة استفادة جديدة</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {db?.services.map((svc: SupportService) => (
                              <ServiceActionCard 
                                key={svc.id} 
                                service={svc} 
                                engineerUsage={db.usage.filter(u => u.engineerId === selectedEngineer.id && u.serviceId === svc.id)}
                                onRecord={(count, price) => {
                                  const newRecord: UsageRecord = {
                                    id: crypto.randomUUID(),
                                    engineerId: selectedEngineer.id,
                                    serviceId: svc.id,
                                    count,
                                    date: new Date().toISOString(),
                                    totalPrice: price
                                  };
                                  updateDb('usage', [...(db?.usage || []), newRecord]);
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-sm uppercase tracking-widest text-[#1a1a1a]/40">سجل الاستفادات</h4>
                          <div className="space-y-2">
                            {db?.usage.filter(u => u.engineerId === selectedEngineer.id).reverse().map(record => {
                              const svc = db.services.find(s => s.id === record.serviceId);
                              return (
                                <div key={record.id} className="flex justify-between items-center p-3 bg-[#F5F2ED] rounded-xl text-sm">
                                  <span>{svc?.name} ({record.count})</span>
                                  <span className="font-mono">{record.totalPrice} ج.م - {new Date(record.date).toLocaleDateString('ar-EG')}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-white rounded-3xl border border-[#1a1a1a]/10 flex flex-col items-center justify-center p-12 text-center opacity-40">
                        <Users size={64} className="mb-4" />
                        <p>اختر مهندساً من القائمة لعرض التفاصيل وإضافة استفادات</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl border border-[#1a1a1a]/10 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">تقرير الاستفادات الشامل</h3>
                    <div className="flex flex-col items-end gap-2">
                      <button 
                        onClick={() => {
                          const content = document.getElementById('printable-report');
                          if (!content) return;

                          // Create a hidden iframe for printing
                          const printFrame = document.createElement('iframe');
                          printFrame.style.position = 'fixed';
                          printFrame.style.right = '0';
                          printFrame.style.bottom = '0';
                          printFrame.style.width = '0';
                          printFrame.style.height = '0';
                          printFrame.style.border = '0';
                          document.body.appendChild(printFrame);

                          const frameDoc = printFrame.contentWindow?.document;
                          if (!frameDoc) return;

                          frameDoc.open();
                          frameDoc.write(`
                            <html dir="rtl">
                              <head>
                                <title>تقرير الاستفادات</title>
                                <style>
                                  body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                                  table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #1a1a1a; }
                                  th, td { border: 1px solid #1a1a1a; padding: 12px; text-align: right; font-size: 12px; }
                                  th { background-color: #F5F2ED; font-weight: bold; }
                                  tfoot { background-color: #F5F2ED; font-weight: bold; font-size: 14px; }
                                  .text-left { text-align: left; }
                                  .text-right { text-align: right; }
                                  h2 { text-align: center; margin-bottom: 30px; }
                                  .header-info { margin-bottom: 20px; font-size: 14px; }
                                </style>
                              </head>
                              <body>
                                <h2>تقرير الاستفادات الشامل</h2>
                                <div class="header-info">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</div>
                                ${content.innerHTML}
                              </body>
                            </html>
                          `);
                          frameDoc.close();

                          // Wait for content to load then print
                          setTimeout(() => {
                            printFrame.contentWindow?.focus();
                            printFrame.contentWindow?.print();
                            // Clean up after printing
                            setTimeout(() => {
                              document.body.removeChild(printFrame);
                            }, 1000);
                          }, 500);
                        }}
                        className="bg-[#1a1a1a] text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                      >
                        <Download size={18} />
                        طباعة التقرير
                      </button>
                      <p className="text-[10px] text-[#1a1a1a]/40">إذا واجهت مشكلة، يرجى التأكد من السماح بالنوافذ المنبثقة (Popups)</p>
                    </div>
                  </div>

                  <div id="printable-report" className="overflow-hidden rounded-2xl border border-[#1a1a1a]/10">
                    <table className="w-full text-right">
                      <thead className="bg-[#F5F2ED] text-xs font-bold uppercase tracking-widest">
                        <tr>
                          <th className="p-4">التاريخ</th>
                          <th className="p-4">المهندس</th>
                          <th className="p-4">رقم العضوية</th>
                          <th className="p-4">رقم الهاتف</th>
                          <th className="p-4">الخدمة</th>
                          <th className="p-4">العدد</th>
                          <th className="p-4">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a1a1a]/5">
                        {validUsage.slice().reverse().map(record => {
                          const eng = db?.engineers.find(e => e.id === record.engineerId);
                          const svc = db?.services.find(s => s.id === record.serviceId);
                          return (
                            <tr key={record.id} className="text-sm">
                              <td className="p-4">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                              <td className="p-4 font-bold">{eng?.name}</td>
                              <td className="p-4 font-mono">{eng?.membershipNumber}</td>
                              <td className="p-4 font-mono">{eng?.phone}</td>
                              <td className="p-4">{svc?.name}</td>
                              <td className="p-4">{record.count}</td>
                              <td className="p-4 font-bold">{record.totalPrice} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#F5F2ED] border-t-2 border-[#1a1a1a]">
                        <tr className="font-black text-lg">
                          <td colSpan={6} className="p-6 text-left">إجمالي المبلغ المستحق:</td>
                          <td className="p-6 text-right text-green-700">
                            {validUsage.reduce((acc, curr) => acc + curr.totalPrice, 0)} ج.م
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'services' && currentUser.role === 'admin' && (
              <motion.div 
                key="services"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <ServiceModal onSave={(svc) => updateDb('services', [...(db?.services || []), svc])} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {db?.services.map(svc => (
                    <div key={svc.id} className="bg-white p-6 rounded-3xl border border-[#1a1a1a]/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg">{svc.name}</h3>
                        <div className="flex gap-1">
                          <ServiceModal 
                            service={svc} 
                            onSave={(updated) => {
                              const newList = db?.services.map(s => s.id === updated.id ? updated : s) || [];
                              updateDb('services', newList);
                            }} 
                          />
                          <button 
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'حذف الخدمة',
                                message: `هل أنت متأكد من حذف خدمة "${svc.name}"؟`,
                                onConfirm: () => updateDb('services', db.services.filter(s => s.id !== svc.id))
                              });
                            }}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#1a1a1a]/50">السعر الأصلي:</span>
                          <span className="font-bold">{svc.originalPrice} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#1a1a1a]/50">السعر المدعم:</span>
                          <span className="font-bold text-green-600">{svc.subsidizedPrice} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#1a1a1a]/50">عدد الوجبات المدعمة:</span>
                          <span className="font-bold">{svc.subsidizedLimit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#1a1a1a]/50">السعر بعد انتهاء الدعم:</span>
                          <span className="font-bold">{svc.priceAfterLimit} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[#1a1a1a]/5">
                          <span className="text-[#1a1a1a]/50">الحالة بعد الدعم:</span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full",
                            svc.blockAfterLimit ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {svc.blockAfterLimit ? 'منع الحجز' : 'سعر أصلي'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && currentUser.role === 'admin' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <AddUserModal onAdd={(user) => updateDb('users', [...(db?.users || []), user])} />
                <div className="bg-white rounded-3xl border border-[#1a1a1a]/10 overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-[#F5F2ED]/50 text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                      <tr>
                        <th className="p-4">اسم المستخدم</th>
                        <th className="p-4">الصلاحية</th>
                        <th className="p-4">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]/5">
                      {db?.users.map(user => (
                        <tr key={user.id} className="hover:bg-[#F5F2ED]/30 transition-colors">
                          <td className="p-4 font-bold">{user.username}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                              user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {user.role === 'admin' ? 'مدير' : 'موظف'}
                            </span>
                          </td>
                          <td className="p-4">
                            {user.username !== 'admin' && (
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'حذف المستخدم',
                                    message: `هل أنت متأكد من حذف المستخدم "${user.username}"؟`,
                                    onConfirm: () => updateDb('users', db.users.filter(u => u.id !== user.id))
                                  });
                                }}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <motion.button 
      whileHover={{ x: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl transition-all font-semibold relative overflow-hidden group",
        active 
          ? "bg-brand-ink text-white shadow-xl shadow-brand-ink/20" 
          : "text-brand-ink/60 hover:bg-brand-muted hover:text-brand-ink"
      )}
    >
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="absolute right-0 top-0 bottom-0 w-1 bg-brand-accent"
        />
      )}
      <div className={cn(
        "transition-transform duration-300",
        active ? "scale-110" : "group-hover:scale-110"
      )}>
        {icon}
      </div>
      <span className="font-display">{label}</span>
    </motion.button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number | string, icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      className="bg-white p-6 rounded-3xl border border-brand-ink/5 flex items-center gap-4 transition-all duration-300"
    >
      <div className="w-14 h-14 rounded-2xl bg-brand-muted flex items-center justify-center text-brand-accent">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold text-brand-ink/40 uppercase tracking-[0.2em] font-display mb-1">{title}</div>
        <div className="text-3xl font-bold font-display tracking-tight">{value}</div>
      </div>
    </motion.div>
  );
}

const ServiceActionCard: React.FC<{ service: SupportService, engineerUsage: UsageRecord[], onRecord: (count: number, price: number, isDeceasedFamily: boolean) => void }> = ({ service, engineerUsage, onRecord }) => {
  const [count, setCount] = useState(1);
  const [isDeceasedFamily, setIsDeceasedFamily] = useState(false);
  const totalUsed = engineerUsage.reduce((acc, curr) => acc + curr.count, 0);
  const remainingSubsidized = Math.max(0, service.subsidizedLimit - totalUsed);

  const calculatePrice = (qty: number) => {
    if (isDeceasedFamily) return 0;
    let price = 0;
    let tempUsed = totalUsed;
    for (let i = 0; i < qty; i++) {
      if (tempUsed < service.subsidizedLimit) {
        price += service.subsidizedPrice;
      } else {
        price += service.priceAfterLimit;
      }
      tempUsed++;
    }
    return price;
  };

  const isBlocked = !isDeceasedFamily && service.blockAfterLimit && totalUsed >= service.subsidizedLimit;
  const isExceedingLimit = !isDeceasedFamily && service.blockAfterLimit && (totalUsed + count > service.subsidizedLimit);

  return (
    <div className="p-6 bg-brand-muted rounded-[32px] space-y-4 border border-brand-ink/5 relative overflow-hidden group">
      <div className="flex justify-between items-center relative z-10">
        <h5 className="font-display font-bold text-lg">{service.name}</h5>
        <span className="text-[10px] font-bold bg-brand-surface px-3 py-1.5 rounded-full text-brand-ink/40 uppercase tracking-widest border border-brand-ink/5 shadow-sm">
          الاستهلاك: {totalUsed} / {service.subsidizedLimit}
        </span>
      </div>

      <div className="flex items-center gap-3 bg-brand-surface/50 p-3 rounded-2xl border border-brand-ink/5 relative z-10">
        <input 
          type="checkbox" 
          id={`deceased-${service.id}`}
          checked={isDeceasedFamily}
          onChange={(e) => setIsDeceasedFamily(e.target.checked)}
          className="w-5 h-5 accent-brand-ink rounded-lg cursor-pointer transition-all"
        />
        <label htmlFor={`deceased-${service.id}`} className="text-xs font-bold text-brand-ink/60 cursor-pointer">أسرة مهندس متوفي (دعم مجاني)</label>
      </div>

      {!isBlocked ? (
        <div className="space-y-4 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-ink/40 uppercase tracking-widest font-display block mr-1">عدد الوحدات / الدعم</label>
            <div className="flex items-center gap-3 bg-brand-surface p-2 rounded-2xl border border-brand-ink/5 shadow-sm">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setCount(Math.max(1, count - 1))} 
                className="w-10 h-10 bg-brand-muted rounded-xl flex items-center justify-center text-brand-ink/60 hover:bg-brand-ink/5 transition-colors"
              >-</motion.button>
              <span className="flex-1 text-center font-bold text-lg font-display">{count}</span>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setCount(count + 1)} 
                className="w-10 h-10 bg-brand-muted rounded-xl flex items-center justify-center text-brand-ink/60 hover:bg-brand-ink/5 transition-colors"
              >+</motion.button>
            </div>
          </div>
          
          {isExceedingLimit && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] text-red-500 font-bold text-center bg-red-50 py-2 rounded-xl border border-red-100"
            >
              عفواً، لا يمكن حجز أكثر من {service.subsidizedLimit} وحدات إجمالاً
            </motion.div>
          )}

          <div className="flex justify-between items-center pt-2">
            <div className="text-left">
              <div className="text-[10px] font-bold text-brand-ink/30 uppercase tracking-widest font-display mb-1">الإجمالي</div>
              <div className="text-2xl font-display font-bold text-brand-accent">
                {isDeceasedFamily ? "مجاني" : `${calculatePrice(count)} ج.م`}
              </div>
            </div>
            <motion.button 
              whileHover={!isExceedingLimit ? { scale: 1.05 } : {}}
              whileTap={!isExceedingLimit ? { scale: 0.95 } : {}}
              disabled={isExceedingLimit}
              onClick={() => {
                onRecord(count, calculatePrice(count), isDeceasedFamily);
                setCount(1);
                setIsDeceasedFamily(false);
              }}
              className={cn(
                "text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-lg font-display text-sm",
                isExceedingLimit 
                  ? "bg-brand-ink/10 text-brand-ink/30 cursor-not-allowed shadow-none" 
                  : "bg-brand-ink hover:bg-brand-ink/90 shadow-brand-ink/20"
              )}
            >
              تأكيد الدعم
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl border border-red-100 relative z-10">
          عفواً، تم استنفاد الحد الأقصى للدعم
        </div>
      )}
    </div>
  );
};

// Modals
function EngineerModal({ engineer, onSave, existingEngineers }: { engineer?: Engineer, onSave: (eng: Engineer) => void, existingEngineers: Engineer[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', membershipNumber: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (engineer) {
      setForm({ name: engineer.name, phone: engineer.phone, membershipNumber: engineer.membershipNumber });
    }
    if (!isOpen) setError('');
  }, [engineer, isOpen]);

  const handleSave = () => {
    if (!form.name || !form.membershipNumber) {
      setError('يرجى ملء البيانات الأساسية');
      return;
    }
    const isDuplicate = existingEngineers.some(e => e.membershipNumber === form.membershipNumber && e.id !== engineer?.id);
    if (isDuplicate) {
      setError('رقم العضوية هذا مسجل بالفعل لمهندس آخر');
      return;
    }
    onSave({ id: engineer?.id || crypto.randomUUID(), ...form });
    setIsOpen(false);
    if (!engineer) setForm({ name: '', phone: '', membershipNumber: '' });
  };

  if (!isOpen) return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setIsOpen(true)} 
      className={cn(
        engineer 
          ? "p-2 text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-colors" 
          : "bg-brand-ink text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-brand-ink/90 transition-all shadow-lg shadow-brand-ink/20 font-display"
      )}
    >
      {engineer ? <Settings size={20} /> : <><UserPlus size={20} />إضافة مهندس</>}
    </motion.button>
  );

  return (
    <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-surface rounded-[40px] p-10 w-full max-w-md space-y-8 shadow-2xl border border-brand-ink/5"
      >
        <h3 className="text-2xl font-display font-bold tracking-tight">{engineer ? 'تعديل بيانات المهندس' : 'إضافة مهندس جديد'}</h3>
        <div className="space-y-5">
          <Input label="الاسم بالكامل" value={form.name} onChange={v => setForm({...form, name: v})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <Input label="رقم الهاتف" value={form.phone} onChange={v => setForm({...form, phone: v})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <Input label="رقم العضوية" value={form.membershipNumber} onChange={v => { setForm({...form, membershipNumber: v}); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>
        {error && (
          <motion.p 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-red-500 text-sm text-center font-bold bg-red-50 py-2 rounded-xl"
          >
            {error}
          </motion.p>
        )}
        <div className="flex gap-4 pt-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave} 
            className="flex-1 bg-brand-ink text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-ink/20 font-display"
          >
            حفظ البيانات
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(false)} 
            className="flex-1 bg-brand-muted text-brand-ink/60 py-4 rounded-2xl font-bold font-display"
          >
            إلغاء
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function ServiceModal({ service, onSave }: { service?: SupportService, onSave: (svc: SupportService) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: '', originalPrice: 0, subsidizedPrice: 0, subsidizedLimit: 0, priceAfterLimit: 0, blockAfterLimit: false });

  useEffect(() => {
    if (service) {
      setForm({ 
        name: service.name, 
        originalPrice: service.originalPrice, 
        subsidizedPrice: service.subsidizedPrice, 
        subsidizedLimit: service.subsidizedLimit, 
        priceAfterLimit: service.priceAfterLimit,
        blockAfterLimit: service.blockAfterLimit
      });
    }
  }, [service, isOpen]);

  const handleSave = () => {
    onSave({ id: service?.id || crypto.randomUUID(), ...form });
    setIsOpen(false);
    if (!service) setForm({ name: '', originalPrice: 0, subsidizedPrice: 0, subsidizedLimit: 0, priceAfterLimit: 0, blockAfterLimit: false });
  };

  if (!isOpen) return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setIsOpen(true)} 
      className={cn(
        service 
          ? "text-brand-accent hover:bg-brand-accent/10 p-2 rounded-xl transition-colors" 
          : "bg-brand-ink text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-brand-ink/90 transition-all shadow-lg shadow-brand-ink/20 font-display"
      )}
    >
      {service ? <Settings size={18} /> : <><Plus size={20} />إضافة خدمة دعم</>}
    </motion.button>
  );

  return (
    <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-surface rounded-[40px] p-10 w-full max-w-md space-y-8 shadow-2xl border border-brand-ink/5"
      >
        <h3 className="text-2xl font-display font-bold tracking-tight">{service ? 'تعديل خدمة الدعم' : 'إضافة خدمة دعم جديدة'}</h3>
        <div className="space-y-5">
          <Input label="اسم الخدمة (مثلاً: دعم طبي أو وجبة)" value={form.name} onChange={v => setForm({...form, name: v})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="السعر الأصلي" type="number" value={form.originalPrice} onChange={v => setForm({...form, originalPrice: Number(v)})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <Input label="السعر المدعم" type="number" value={form.subsidizedPrice} onChange={v => setForm({...form, subsidizedPrice: Number(v)})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <Input label="العدد المدعم" type="number" value={form.subsidizedLimit} onChange={v => setForm({...form, subsidizedLimit: Number(v)})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <Input label="السعر بعد الدعم" type="number" value={form.priceAfterLimit} onChange={v => setForm({...form, priceAfterLimit: Number(v)})} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
          <label className="flex items-center gap-3 p-4 bg-brand-muted rounded-2xl cursor-pointer hover:bg-brand-ink/5 transition-colors border border-brand-ink/5">
            <input 
              type="checkbox" 
              className="w-5 h-5 accent-brand-ink"
              checked={form.blockAfterLimit}
              onChange={e => setForm({...form, blockAfterLimit: e.target.checked})}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <span className="text-sm font-bold text-brand-ink/60">منع الحجز بعد انتهاء العدد المدعم</span>
          </label>
        </div>
        <div className="flex gap-4 pt-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave} 
            className="flex-1 bg-brand-ink text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-ink/20 font-display"
          >
            حفظ
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(false)} 
            className="flex-1 bg-brand-muted text-brand-ink/60 py-4 rounded-2xl font-bold font-display"
          >
            إلغاء
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function AddUserModal({ onAdd }: { onAdd: (user: User) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' as Role });

  const handleAdd = () => {
    if (!form.username || !form.password) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    onAdd({ id: crypto.randomUUID(), ...form });
    setIsOpen(false);
    setForm({ username: '', password: '', role: 'staff' });
  };

  if (!isOpen) return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setIsOpen(true)} 
      className="bg-brand-ink text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-brand-ink/90 transition-all shadow-lg shadow-brand-ink/20 font-display"
    >
      <UserPlus size={20} />
      إضافة مستخدم
    </motion.button>
  );

  return (
    <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-surface rounded-[40px] p-10 w-full max-w-md space-y-8 shadow-2xl border border-brand-ink/5"
      >
        <h3 className="text-2xl font-display font-bold tracking-tight">إضافة مستخدم جديد</h3>
        <div className="space-y-5">
          <Input label="اسم المستخدم" value={form.username} onChange={v => setForm({...form, username: v})} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <Input label="كلمة المرور" type="password" value={form.password} onChange={v => setForm({...form, password: v})} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-brand-ink/40 uppercase tracking-widest font-display block mr-1">الصلاحية</label>
            <select 
              className="w-full bg-brand-muted border border-brand-ink/5 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all font-medium text-sm appearance-none cursor-pointer"
              value={form.role}
              onChange={e => setForm({...form, role: e.target.value as Role})}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            >
              <option value="staff">موظف</option>
              <option value="admin">مدير</option>
            </select>
          </div>
        </div>
        <div className="flex gap-4 pt-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAdd} 
            className="flex-1 bg-brand-ink text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-ink/20 font-display"
          >
            إضافة المستخدم
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(false)} 
            className="flex-1 bg-brand-muted text-brand-ink/60 py-4 rounded-2xl font-bold font-display"
          >
            إلغاء
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-brand-surface w-full max-w-sm rounded-[40px] p-10 shadow-2xl relative z-10 border border-brand-ink/5"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center shadow-xl shadow-red-500/10">
                <Trash2 className="text-red-500 w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-brand-ink">{title}</h3>
                <p className="text-brand-ink/40 font-medium leading-relaxed">{message}</p>
              </div>
              <div className="flex gap-4 w-full pt-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-500/20 font-display"
                >
                  تأكيد الحذف
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 bg-brand-muted text-brand-ink/60 py-4 rounded-2xl font-bold font-display"
                >
                  تراجع
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Input({ label, value, onChange, type = "text", onKeyDown, required }: { label: string, value: any, onChange: (v: string) => void, type?: string, onKeyDown?: (e: React.KeyboardEvent) => void, required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-brand-ink/40 uppercase tracking-widest font-display block mr-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        required={required}
        className="w-full bg-brand-muted border border-brand-ink/5 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all font-medium text-sm"
      />
    </div>
  );
}
