import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Customer, Column, Task, AppState, Employee, TemplateTask } from './types';
import { INITIAL_CUSTOMERS, INITIAL_COLUMNS, INITIAL_TASKS, INITIAL_EMPLOYEES, INITIAL_TEMPLATE_TASKS } from './constants';
import CustomerSheet from './components/CustomerSheet';
import GanttMap from './components/GanttMap';
import Progress3D from './components/Progress3D';
import TaskModal from './components/TaskModal';
import SettingsModal, { SettingsMode } from './components/SettingsModal';
import SplashScreen from './components/SplashScreen';
import AdminPanel from './components/AdminPanel';
import ConstructionSchedule from './components/ConstructionSchedule';
import { AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Table, Map as MapIcon, Box, 
  FileText, Save, Printer, Building2, 
  FileSpreadsheet, Download, Upload, Info, 
  Settings, FolderOpen, ChevronRight, RotateCcw,
  Undo2, Redo2, Shield, HardHat
} from 'lucide-react';

const STORAGE_KEY = 'iekoto_mind_data_v1';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  
  // Load initial state from LocalStorage or constants
  const loadState = <T,>(key: string, defaultVal: T): T => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed[key] || defaultVal;
      }
    } catch (e) {
      console.error("Failed to load state", e);
    }
    return defaultVal;
  };

  const [customers, setCustomers] = useState<Customer[]>(() => loadState('customers', INITIAL_CUSTOMERS));
  const [columns, setColumns] = useState<Column[]>(() => loadState('columns', INITIAL_COLUMNS));
  const [tasks, setTasks] = useState<Task[]>(() => loadState('tasks', INITIAL_TASKS));
  const [employees, setEmployees] = useState<Employee[]>(() => loadState('employees', INITIAL_EMPLOYEES));
  const [templateTasks, setTemplateTasks] = useState<TemplateTask[]>(() => loadState('templateTasks', INITIAL_TEMPLATE_TASKS));
  
  const [viewMode, setViewMode] = useState<AppState['viewMode']>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [settingsMode, setSettingsMode] = useState<SettingsMode>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo State
  const [history, setHistory] = useState<{ past: Partial<AppState>[], future: Partial<AppState>[] }>({ past: [], future: [] });

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-save to LocalStorage
  useEffect(() => {
    const dataToSave = {
      customers,
      columns,
      tasks,
      employees,
      templateTasks
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [customers, columns, tasks, employees, templateTasks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // --- History-aware State Setters ---
  const updateCustomers = (updater: React.SetStateAction<Customer[]>) => {
    setHistory(h => ({ past: [...h.past, { customers }], future: [] }));
    setCustomers(updater);
  };
  const updateColumns = (updater: React.SetStateAction<Column[]>) => {
    setHistory(h => ({ past: [...h.past, { columns }], future: [] }));
    setColumns(updater);
  };
  const updateTasks = (updater: React.SetStateAction<Task[]>) => {
    setHistory(h => ({ past: [...h.past, { tasks }], future: [] }));
    setTasks(updater);
  };
  const updateEmployees = (updater: React.SetStateAction<Employee[]>) => {
    setHistory(h => ({ past: [...h.past, { employees }], future: [] }));
    setEmployees(updater);
  };
  const updateTemplateTasks = (updater: React.SetStateAction<TemplateTask[]>) => {
    setHistory(h => ({ past: [...h.past, { templateTasks }], future: [] }));
    setTemplateTasks(updater);
  };
  
  // --- Undo/Redo Logic ---

  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;

    const lastState = history.past[history.past.length - 1];
    
    setHistory({
        past: history.past.slice(0, history.past.length - 1),
        future: [{ customers, columns, tasks, employees, templateTasks }, ...history.future],
    });

    if (lastState.customers) setCustomers(lastState.customers);
    if (lastState.columns) setColumns(lastState.columns);
    if (lastState.tasks) setTasks(lastState.tasks);
    if (lastState.employees) setEmployees(lastState.employees);
    if (lastState.templateTasks) setTemplateTasks(lastState.templateTasks);

  }, [history, customers, columns, tasks, employees, templateTasks]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;

    const nextState = history.future[0];

    setHistory({
        past: [...history.past, { customers, columns, tasks, employees, templateTasks }],
        future: history.future.slice(1),
    });

    if (nextState.customers) setCustomers(nextState.customers);
    if (nextState.columns) setColumns(nextState.columns);
    if (nextState.tasks) setTasks(nextState.tasks);
    if (nextState.employees) setEmployees(nextState.employees);
    if (nextState.templateTasks) setTemplateTasks(nextState.templateTasks);

  }, [history, customers, columns, tasks, employees, templateTasks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);


  // Handlers for Data Manipulation with History
  const handleDeleteColumn = (columnId: string) => {
    // Save current state before modification (atomic update for multiple states)
    setHistory(h => ({
      past: [...h.past, { customers, columns }],
      future: [] // Clear future on new action
    }));

    // Update columns
    setColumns(prev => prev.filter(c => c.id !== columnId));

    // Update customers to remove data associated with the deleted column
    setCustomers(prev => prev.map(customer => {
      if (columnId in customer.data) {
        const newData = { ...customer.data };
        delete newData[columnId];
        return { ...customer, data: newData };
      }
      return customer;
    }));
  };

  // Handlers for Import/Export
  const handleExport = () => {
    const dataStr = JSON.stringify({ customers, columns, tasks, employees, templateTasks }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iekoto_data_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setHistory({ past: [], future: [] }); // Reset history on import
        if (json.customers) setCustomers(json.customers);
        if (json.columns) setColumns(json.columns);
        if (json.tasks) setTasks(json.tasks);
        if (json.employees) setEmployees(json.employees);
        if (json.templateTasks) setTemplateTasks(json.templateTasks);
        alert('データを読み込みました');
      } catch (err) {
        console.error(err);
        alert('ファイルの読み込みに失敗しました。形式を確認してください。');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleResetData = () => {
    if (window.confirm('現在のデータを全て削除し、初期状態に戻しますか？この操作は取り消せません。')) {
      setHistory({ past: [], future: [] }); // Reset history
      setCustomers(INITIAL_CUSTOMERS);
      setColumns(INITIAL_COLUMNS);
      setTasks(INITIAL_TASKS);
      setEmployees(INITIAL_EMPLOYEES);
      setTemplateTasks(INITIAL_TEMPLATE_TASKS);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const menuItems = [
    { label: '開く (インポート)', icon: FolderOpen, action: handleImportClick },
    { label: '保存 (エクスポート)', icon: Save, action: handleExport },
    { label: '新規作成 (初期化)', icon: RotateCcw, action: handleResetData },
    { label: '印刷', icon: Printer, action: () => window.print() },
    { type: 'divider' },
    { label: '会社情報・社員登録', icon: Building2, action: () => setSettingsMode('company'), hasSubmenu: true },
    { type: 'divider' },
    { label: 'タスクひな形', icon: FileSpreadsheet, action: () => setSettingsMode('task_template') },
    { label: '工程ひな形', icon: Settings, action: () => setSettingsMode('schedule_template') },
    { type: 'divider' },
    { label: 'バージョン情報', icon: Info, action: () => alert('iekoto MIND v1.0.0') },
  ];

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>

      {/* Hidden File Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".json"
      />

      <div className="h-screen w-screen bg-slate-100 grid grid-rows-[auto_1fr] text-slate-800 font-sans overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-4 md:px-6 shadow-md z-50 relative print:hidden">
          
          {/* Logo & Menu Trigger */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 hover:bg-slate-800 p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
                {/* Custom Logo Icon: House centered at X=16 (ViewBox 32), Dot moved to X=31 */}
                <svg 
                  viewBox="0 0 32 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-9 h-9 text-white"
                >
                  {/* House: Width 22, Height 20.5. Center X=16. Peak Y=2. */}
                  <path d="M5 22.5V8.5L16 2L27 8.5V22.5" />
                  <circle cx="31" cy="22.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight hidden lg:block">ie-koto MIND</h1>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 text-gray-800 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {menuItems.map((item, idx) => {
                  if (item.type === 'divider') {
                    return <div key={idx} className="h-px bg-gray-100 my-1" />;
                  }
                  const Icon = item.icon as React.ElementType;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        item.action?.();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                    >
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-3 text-gray-400 group-hover:text-blue-500" />
                        <span>{item.label}</span>
                      </div>
                      {item.hasSubmenu && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* View Switcher */}
          <nav className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Table className="w-4 h-4" />
              <span className="hidden md:inline">顧客台帳</span>
            </button>
            <button
              onClick={() => setViewMode('gantt_map')}
              className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === 'gantt_map' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span className="hidden md:inline">工程＆マップ</span>
            </button>
            <button
              onClick={() => setViewMode('3d_progress')}
              className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === '3d_progress' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Box className="w-4 h-4" />
              <span className="hidden md:inline">3D進捗</span>
            </button>
            <button
              onClick={() => setViewMode('construction_schedule')}
              className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === 'construction_schedule' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span className="hidden md:inline">着工スケジュール</span>
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
             {/* Undo/Redo Buttons */}
              <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={handleUndo}
                  disabled={history.past.length === 0}
                  className="p-2 rounded text-slate-400 disabled:text-slate-600 disabled:cursor-not-allowed hover:enabled:bg-slate-700 hover:enabled:text-white transition-colors"
                  title="元に戻す (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={history.future.length === 0}
                  className="p-2 rounded text-slate-400 disabled:text-slate-600 disabled:cursor-not-allowed hover:enabled:bg-slate-700 hover:enabled:text-white transition-colors"
                  title="やり直す (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
               {/* Admin Panel Button */}
              <button
                onClick={() => setIsAdminPanelOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                title="管理者パネル"
              >
                <Shield className="w-5 h-5" />
              </button>
              {/* User Info */}
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold border border-slate-600 cursor-pointer hover:bg-slate-600 transition-colors">
                  User
              </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="overflow-hidden p-4 overscroll-contain" onClick={() => setIsMenuOpen(false)}>
          {viewMode === 'list' && (
              <CustomerSheet 
                customers={customers} 
                columns={columns} 
                setCustomers={updateCustomers} 
                setColumns={updateColumns}
                employees={employees}
                onDeleteColumn={handleDeleteColumn}
              />
          )}
          
          {viewMode === 'gantt_map' && (
              <GanttMap customers={customers} />
          )}

          {viewMode === '3d_progress' && (
            <Progress3D 
              customers={customers}
              tasks={tasks}
              onCustomerClick={setSelectedCustomer} 
            />
          )}

          {viewMode === 'construction_schedule' && (
            <ConstructionSchedule 
              customers={customers} 
              setCustomers={updateCustomers}
              onCustomerClick={setSelectedCustomer}
            />
          )}
        </main>

        {/* Modal Layers */}
        <TaskModal 
          customer={selectedCustomer} 
          tasks={tasks} 
          setTasks={updateTasks} 
          templateTasks={templateTasks}
          onClose={() => setSelectedCustomer(null)} 
        />

        <SettingsModal 
          mode={settingsMode}
          onClose={() => setSettingsMode(null)}
          employees={employees}
          setEmployees={updateEmployees}
          templateTasks={templateTasks}
          setTemplateTasks={updateTemplateTasks}
        />

        <AdminPanel
            isOpen={isAdminPanelOpen}
            onClose={() => setIsAdminPanelOpen(false)}
            customers={customers}
            employees={employees}
        />
      </div>
    </>
  );
};

export default App;