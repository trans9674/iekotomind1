import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer, Column, CustomerStatus, ColumnType, Employee, AvatarConfig } from '../types';
import { STATUS_CONFIG } from '../constants';
import { Plus, Trash2, Filter, UserPlus, X, Type, List, DollarSign, Calendar, Phone, UserCircle, ChevronDown } from 'lucide-react';
import CalendarModal from './CalendarModal';
import { motion, AnimatePresence } from 'framer-motion';


interface Props {
  customers: Customer[];
  columns: Column[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  employees: Employee[];
  onDeleteColumn: (columnId: string) => void;
}

// Helper component for currency input, now fully controlled by parent for editing state
const CurrencyInput = ({ 
    value, 
    onChange, 
    onFocus, 
    onBlur 
}: { 
    value: any, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onFocus: () => void,
    onBlur: () => void,
}) => {
  const [isDomFocused, setIsDomFocused] = useState(false);

  const displayValue = isDomFocused 
    ? value 
    : value 
      ? Number(value).toLocaleString() 
      : '';

  return (
    <input
      type={isDomFocused ? "number" : "text"}
      className="w-full bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-right text-sm"
      value={displayValue}
      onChange={onChange}
      onFocus={() => {
          onFocus();
          setIsDomFocused(true);
      }}
      onBlur={() => {
          onBlur();
          setIsDomFocused(false);
      }}
      placeholder="¥0"
    />
  );
};


// Simplified avatar for sheet view
const MiniAvatar = ({ config }: { config?: AvatarConfig }) => {
  if (!config) {
    return (
      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
        <UserCircle className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
      <svg viewBox="0 0 100 120" className="w-full h-full">
        <rect x="0" y="85" width="100" height="35" fill={config.clothingColor} />
        <circle cx="50" cy="50" r="35" fill={config.skinColor} />
        <circle cx="50" cy="20" r="25" fill={config.hairColor} />
      </svg>
    </div>
  );
};


const CustomerSheet: React.FC<Props> = ({ customers, columns, setCustomers, setColumns, employees, onDeleteColumn }) => {
  const [activeTab, setActiveTab] = useState<CustomerStatus | 'All'>('All');
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');
  const [newColOptions, setNewColOptions] = useState('');
  const [isAddColExpanded, setIsAddColExpanded] = useState(false);
  
  // New Customer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerRep, setNewCustomerRep] = useState('');
  const [newCustomerStatus, setNewCustomerStatus] = useState<CustomerStatus>(CustomerStatus.NEGOTIATION);
  
  // Add Option Modal State
  const [addOptionModal, setAddOptionModal] = useState<{ customerId: string, columnId: string, columnTitle: string } | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');

  // Custom Scrollbar State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarHandleRef = useRef<HTMLDivElement>(null);
  const [handleTop, setHandleTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const dragStartRef = useRef({ initialMouseY: 0, initialScrollTop: 0 });

  // Cell Editing and Confirmation State
  const [editingCell, setEditingCell] = useState<{ customerId: string, field: string, value: any } | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{ 
      onConfirm: () => void, 
      onCancel: () => void, 
      content: React.ReactNode,
      title?: string,
      confirmButtonText?: string,
      confirmButtonClass?: string,
  } | null>(null);
  const [calendarState, setCalendarState] = useState<{ customerId: string; field: string; initialDate: string | null; } | null>(null);
  
  // Accordion State
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Column Drag & Drop State
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);

  // Determine status order for sorting
  const statusOrder = useMemo(() => Object.values(CustomerStatus), []);

  const filteredCustomers = useMemo(() => {
    let result = activeTab === 'All'
      ? [...customers]
      : customers.filter(c => c.status === activeTab);

    // Sort by status group if showing All, to enable layout animation grouping
    if (activeTab === 'All') {
        result.sort((a, b) => {
            const indexA = statusOrder.indexOf(a.status);
            const indexB = statusOrder.indexOf(b.status);
            if (indexA !== indexB) return indexA - indexB;
            // Secondary stable sort by ID
            return a.id.localeCompare(b.id);
        });
    }
    return result;
  }, [customers, activeTab, statusOrder]);

  const handleAddColumn = () => {
    if (!newColName) return;

    let options: string[] = [];
    if (newColType === 'select' && newColOptions) {
        options = newColOptions.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newCol: Column = {
      id: `col_${Date.now()}`,
      title: newColName,
      type: newColType,
      options: options,
      order: columns.length,
      removable: true,
    };
    setColumns([...columns, newCol]);
    setNewColName('');
    setNewColType('text');
    setNewColOptions('');
    setIsAddColExpanded(false);
  };

  const handleDeleteColumnConfirmation = (columnId: string, columnTitle: string) => {
    setConfirmationModal({
      title: '列の削除の確認',
      content: (
        <>
          <p className="mt-2 text-sm text-gray-600">
            列「<span className="font-bold">{columnTitle}</span>」を本当に削除しますか？
          </p>
          <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800">
            <strong>警告:</strong> この操作を行うと、全ての顧客からこの列に関連するデータが完全に削除されます。
            <br />
            (この操作はヘッダーの「元に戻す」ボタンで取り消し可能です)
          </div>
        </>
      ),
      onConfirm: () => {
        onDeleteColumn(columnId);
        setConfirmationModal(null);
      },
      onCancel: () => {
        setConfirmationModal(null);
      },
      confirmButtonText: '削除する',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
  };

  const handleAddCustomer = () => {
    if (!newCustomerName) return;
    
    // Default to Hiroshima Area
    const newCustomer: Customer = {
      id: `c_${Date.now()}`,
      name: newCustomerName,
      status: newCustomerStatus,
      location: { 
        x: Math.random() * 80 + 10, 
        y: Math.random() * 80 + 10,
        lat: 34.3853 + (Math.random() - 0.5) * 0.1, 
        lng: 132.4553 + (Math.random() - 0.5) * 0.1
      },
      data: {
        sales_rep: newCustomerRep,
        // Default empty strings for other known columns to ensure inputs work smoothly
        architect: '',
        ic: '',
        constructor: '',
        location: '',
        contract_date: '',
        amount: 0,
        phone: ''
      }
    };
    
    setCustomers(prev => [...prev, newCustomer]);
    setIsModalOpen(false);
    // Reset form
    setNewCustomerName('');
    setNewCustomerRep('');
    setNewCustomerStatus(CustomerStatus.NEGOTIATION);
  };

  // --- Cell Editing Logic ---
  const handleCellFocus = (customerId: string, field: string) => {
    if (editingCell && (editingCell.customerId !== customerId || editingCell.field !== field)) {
      handleCellBlur();
    }
    const customer = customers.find(c => c.id === customerId);
    setEditingCell({ customerId, field, value: customer?.data[field] ?? '' });
  };

  const handleCellValueChange = (newValue: any) => {
    if (editingCell) {
      setEditingCell({ ...editingCell, value: newValue });
    }
  };
  
  const triggerConfirmation = (customerId: string, field: string, newValue: any) => {
    if (confirmationModal) return;

    const customer = customers.find(c => c.id === customerId);
    const oldValue = customer?.data[field] ?? '';
    
    const col = columns.find(c => c.id === field);
    let isChanged = false;

    if (col?.type === 'currency') {
      const oldNum = Number(oldValue) || 0;
      const newNum = Number(String(newValue).replace(/,/g, '')) || 0;
      isChanged = oldNum !== newNum;
    } else {
      isChanged = String(newValue) !== String(oldValue);
    }
    
    if (!isChanged) {
        setEditingCell(null);
        return;
    }

    setConfirmationModal({
      title: '変更を確認',
      content: (
        <>
          <p className="mt-2 text-sm text-gray-600">【変更してよろしいですか？】</p>
          <div className="mt-4 bg-gray-50 p-3 rounded-lg border text-sm space-y-1">
            <p><span className="font-medium text-gray-500">顧客名:</span> <span className="font-bold">{customer?.name}</span></p>
            <p><span className="font-medium text-gray-500">項目:</span> {columns.find(c => c.id === field)?.title}</p>
            <p><span className="font-medium text-gray-500">変更前:</span> <span className="text-red-600">{String(oldValue) || '未設定'}</span></p>
            <p><span className="font-medium text-gray-500">変更後:</span> <span className="text-green-600">{String(newValue) || '未設定'}</span></p>
          </div>
        </>
      ),
      onConfirm: () => {
        let finalValue = newValue;
        if (col?.type === 'currency') {
          finalValue = Number(String(newValue).replace(/,/g, '')) || 0;
        }
        setCustomers(prev =>
          prev.map(c =>
            c.id === customerId ? { ...c, data: { ...c.data, [field]: finalValue } } : c
          )
        );
        setConfirmationModal(null);
        setEditingCell(null);
      },
      onCancel: () => {
        setConfirmationModal(null);
        setEditingCell(null);
      },
      confirmButtonText: '変更する',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });
  };

  const handleCellBlur = () => {
    if (!editingCell) return;
    const { customerId, field, value } = editingCell;
    triggerConfirmation(customerId, field, value);
  };
  
  const handleDiscreteChange = (customerId: string, field: string, newValue: any) => {
    // Force update editing cell to ensure UI reflects the change immediately, 
    // even if onFocus was skipped or cleared unexpectedly.
    setEditingCell({ customerId, field, value: newValue });
    triggerConfirmation(customerId, field, newValue);
  };
  
  const handleAddOptionSubmit = () => {
    if (!addOptionModal || !newOptionValue.trim()) return;
    
    const trimmed = newOptionValue.trim();
    const { customerId, columnId } = addOptionModal;
    
    // Update column options
    setColumns(prevCols => prevCols.map(c => 
        c.id === columnId 
            ? { ...c, options: [...(c.options || []), trimmed] } 
            : c
    ));
    
    // Set cell value
    handleDiscreteChange(customerId, columnId, trimmed);
    
    setAddOptionModal(null);
    setNewOptionValue('');
  };

  const handleStatusChangeRequest = (customer: Customer, newStatus: CustomerStatus) => {
    if (customer.status === newStatus) {
        setExpandedRowId(null);
        return;
    }

    setConfirmationModal({
        title: 'ステータス変更の確認',
        content: (
            <>
                <p className="mt-2 text-sm text-gray-600">
                    <span className="font-bold">{customer.name}様</span>のステータスを変更しますか？
                </p>
                <div className="mt-4 bg-gray-50 p-3 rounded-lg border text-sm space-y-1">
                    <p>
                        <span className="font-medium text-gray-500">変更前:</span>{' '}
                        <span className={`font-semibold ${STATUS_CONFIG[customer.status].text}`}>{customer.status}</span>
                    </p>
                    <p>
                        <span className="font-medium text-gray-500">変更後:</span>{' '}
                        <span className={`font-semibold ${STATUS_CONFIG[newStatus].text}`}>{newStatus}</span>
                    </p>
                </div>
            </>
        ),
        onConfirm: () => {
            setCustomers(prev =>
                prev.map(c =>
                    c.id === customer.id ? { ...c, status: newStatus } : c
                )
            );
            setConfirmationModal(null);
            setExpandedRowId(null);
        },
        onCancel: () => {
            setConfirmationModal(null);
        },
        confirmButtonText: '変更する',
        confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });
  };

  const handleDeleteCustomerRequest = (customer: Customer) => {
    setConfirmationModal({
        title: '顧客の削除',
        content: (
            <p className="mt-2 text-sm text-gray-600">
                <span className="font-bold">{customer.name}様</span>のデータを削除しますか？
            </p>
        ),
        onConfirm: () => showFinalDeleteConfirmation(customer),
        onCancel: () => setConfirmationModal(null),
        confirmButtonText: '削除する',
        confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
  };

  const showFinalDeleteConfirmation = (customer: Customer) => {
    setConfirmationModal({
        title: '最終確認',
        content: (
            <>
                <p className="mt-2 text-sm text-gray-600">
                    この操作は元に戻せません。
                </p>
                <p className="font-bold text-red-700 mt-1">
                    本当に{customer.name}様のデータを完全に削除しますか？
                </p>
            </>
        ),
        onConfirm: () => {
            setCustomers(prev => prev.filter(c => c.id !== customer.id));
            setConfirmationModal(null);
            setExpandedRowId(null);
        },
        onCancel: () => setConfirmationModal(null),
        confirmButtonText: '完全に削除する',
        confirmButtonClass: 'bg-red-800 hover:bg-red-900',
    });
  };

  // Helper to filter employees by role for person columns
  const getEmployeeOptions = (columnId: string) => {
      let role = '';
      if (columnId === 'sales_rep') role = '営業';
      if (columnId === 'architect') role = '設計';
      if (columnId === 'ic') role = 'IC';
      
      return employees.filter(e => role ? e.role === role : true);
  };

  // --- Custom Scrollbar Logic ---

  const updateScrollbar = () => {
    const container = scrollContainerRef.current;
    const track = scrollbarTrackRef.current;
    const handle = scrollbarHandleRef.current;
    if (!container || !track || !handle) return;
  
    const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight);
    const trackHeight = track.clientHeight;
    const handleHeight = handle.clientHeight;
    const newTop = scrollPercentage * (trackHeight - handleHeight);
    
    setHandleTop(newTop);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScrollable = () => {
      const isNowScrollable = container.scrollHeight > container.clientHeight;
      setIsScrollable(isNowScrollable);
      if(isNowScrollable) {
        updateScrollbar();
      }
    };

    checkScrollable();
    container.addEventListener('scroll', updateScrollbar);
    
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollbar);
      resizeObserver.disconnect();
    };
  }, [filteredCustomers]); // Re-check when data changes


  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;
    
    dragStartRef.current = {
      initialMouseY: e.clientY,
      initialScrollTop: container.scrollTop
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const container = scrollContainerRef.current;
      const track = scrollbarTrackRef.current;
      const handle = scrollbarHandleRef.current;
      if (!container || !track || !handle) return;

      const { initialMouseY, initialScrollTop } = dragStartRef.current;
      const deltaY = e.clientY - initialMouseY;
      
      const trackHeight = track.clientHeight;
      const handleHeight = handle.clientHeight;
      const handleRange = trackHeight - handleHeight;

      const scrollRange = container.scrollHeight - container.clientHeight;

      if (handleRange <= 0 || scrollRange <= 0) return;
      
      const scrollRatio = scrollRange / handleRange;
      
      // Changed from 0.5 to 0.1 to make scrolling extremely dull/slow
      const scrollDelta = deltaY * scrollRatio * 0.1;

      container.scrollTop = initialScrollTop + scrollDelta;
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);
  
  // --- Column Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingColumnId(columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnIndex: number) => {
    e.preventDefault();
    if (!draggingColumnId) return;
    
    const th = e.currentTarget as HTMLTableCellElement;
    const rect = th.getBoundingClientRect();
    const isFirstHalf = e.clientX < rect.left + rect.width / 2;
    
    let newDropIndex = isFirstHalf ? columnIndex : columnIndex + 1;
    
    const draggedColumnIndex = sortedColumns.findIndex(c => c.id === draggingColumnId);
    if(draggedColumnIndex < newDropIndex) {
        // do nothing
    } else {
        // do nothing
    }

    if (newDropIndex !== dropTargetIndex) {
      setDropTargetIndex(newDropIndex);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingColumnId(null);
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingColumnId || dropTargetIndex === null) {
      handleDragEnd();
      return;
    }

    const startIndex = sortedColumns.findIndex(c => c.id === draggingColumnId);
    let endIndex = dropTargetIndex;

    if (startIndex === -1 || startIndex === endIndex || (startIndex + 1) === endIndex) {
      handleDragEnd();
      return;
    }

    const newColumns = [...sortedColumns];
    const [removed] = newColumns.splice(startIndex, 1);
    
    // Adjust index after splice
    if (startIndex < endIndex) {
      endIndex--;
    }
    
    newColumns.splice(endIndex, 0, removed);

    const finalColumns = newColumns.map((col, index) => ({ ...col, order: index }));
    
    const draggedColumn = sortedColumns.find(c => c.id === draggingColumnId);
    const targetColumn = sortedColumns[endIndex];

    setConfirmationModal({
      title: '列の順序変更',
      content: (
        <p className="mt-2 text-sm text-gray-600">
          「<span className="font-bold">{draggedColumn?.title}</span>」を
          {targetColumn ? `「<span className="font-bold">{targetColumn.title}</span>」の前に` : '最後に'}
          移動しますか？
        </p>
      ),
      onConfirm: () => {
        setColumns(finalColumns); // This should be updateColumns to use history
        setConfirmationModal(null);
      },
      onCancel: () => {
        setConfirmationModal(null);
      },
      confirmButtonText: '移動する',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700'
    });
    
    handleDragEnd();
  };


  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b bg-gray-50 p-2 space-x-2 overscroll-x-contain">
        <button
          onClick={() => setActiveTab('All')}
          className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'All' ? 'bg-white shadow border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          全ての顧客
        </button>
        {Object.values(CustomerStatus).map(status => {
          const style = STATUS_CONFIG[status];
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? `bg-white shadow border-b-2 ${style.border} ${style.text}`
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-500">
             <Filter className="w-4 h-4" />
             <span className="text-sm">{filteredCustomers.length} 件</span>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>新規顧客登録</span>
          </button>
        </div>

        <div className="hidden md:flex items-center">
           {!isAddColExpanded ? (
               <button 
                 onClick={() => setIsAddColExpanded(true)}
                 className="flex items-center space-x-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 transition-colors text-sm"
               >
                 <Plus className="w-4 h-4" />
                 <span>項目追加</span>
               </button>
           ) : (
                <div className="flex items-center flex-wrap gap-2 bg-gray-50 p-1.5 rounded-md border animate-in fade-in slide-in-from-right-2 duration-200">
                    <select
                        value={newColType}
                        onChange={(e) => setNewColType(e.target.value as ColumnType)}
                        className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="text">テキスト</option>
                        <option value="select">リスト</option>
                        <option value="currency">金額</option>
                        <option value="date">日付</option>
                        <option value="phone">電話番号</option>
                    </select>
                    <input
                        type="text"
                        placeholder="項目名"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 bg-white"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                    />
                    {/* Options Input - Removed as per user request to start empty */}
                    
                    <div className="flex items-center self-stretch ml-auto">
                        <div className="h-full w-px bg-gray-300 mx-2"></div>
                        <button 
                            onClick={handleAddColumn} 
                            disabled={!newColName}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="追加"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setIsAddColExpanded(false);
                                setNewColName('');
                                setNewColType('text');
                                setNewColOptions('');
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200"
                            title="キャンセル"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
           )}
        </div>
      </div>

      {/* Spreadsheet Table & Custom Scrollbar */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-8 bg-white border-r border-gray-100 relative flex-shrink-0 z-30">
            {isScrollable && (
                <div
                    ref={scrollbarTrackRef}
                    className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-gray-200 rounded-full"
                >
                    <div
                        ref={scrollbarHandleRef}
                        onMouseDown={handleMouseDown}
                        className="absolute w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md -left-1.5 cursor-grab active:cursor-grabbing select-none"
                        style={{ top: `${handleTop}px` }}
                    />
                </div>
            )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto overscroll-contain bg-white" ref={scrollContainerRef}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-30 will-change-transform">
              <tr 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
              >
                <th className="px-2 py-2 lg:px-4 lg:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-40 border-r border-gray-200 will-change-transform h-10">
                  顧客名
                </th>
                {sortedColumns.map((col, colIndex) => {
                  const isLastColumn = colIndex === sortedColumns.length - 1;
                  return (
                    <th 
                      key={col.id} 
                      className={`px-2 py-2 lg:px-4 lg:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap group min-w-[150px] h-10 relative transition-opacity ${
                        draggingColumnId === col.id ? 'opacity-40' : ''
                      } cursor-grab`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, colIndex)}
                      onDragEnd={handleDragEnd}
                    >
                      {draggingColumnId && dropTargetIndex === colIndex && (
                          <div className="absolute top-0 bottom-0 -left-0.5 w-1 bg-blue-500 rounded-full z-50" />
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            {col.type === 'currency' && <DollarSign className="w-3 h-3 text-gray-400" />}
                            {col.type === 'date' && <Calendar className="w-3 h-3 text-gray-400" />}
                            {col.type === 'phone' && <Phone className="w-3 h-3 text-gray-400" />}
                            {col.type === 'select' && <List className="w-3 h-3 text-gray-400" />}
                            {col.type === 'text' && <Type className="w-3 h-3 text-gray-400" />}
                            <span>{col.title}</span>
                        </div>
                        {col.removable && (
                          <button
                            onClick={() => handleDeleteColumnConfirmation(col.id, col.title)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {isLastColumn && draggingColumnId && dropTargetIndex === sortedColumns.length && (
                         <div className="absolute top-0 bottom-0 -right-0.5 w-1 bg-blue-500 rounded-full z-50" />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                 <React.Fragment key={customer.id}>
                    <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.8, type: "spring", bounce: 0.2 }}
                        className={`${STATUS_CONFIG[customer.status].row} transition-colors relative`}
                        style={{ zIndex: expandedRowId === customer.id ? 20 : 1 }}
                    >
                    <td className={`px-2 py-2 lg:px-4 lg:py-2 whitespace-nowrap sticky left-0 z-20 border-r border-black/5 will-change-transform ${STATUS_CONFIG[customer.status].bg}`}>
                        <div className="flex flex-row items-center space-x-2">
                            <button
                                onClick={() => setExpandedRowId(expandedRowId === customer.id ? null : customer.id)}
                                className={`w-28 text-center text-[10px] p-1 rounded-full border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between ${STATUS_CONFIG[customer.status].badge}`}
                            >
                                <span>{customer.status}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${expandedRowId === customer.id ? 'rotate-180' : ''}`} />
                            </button>
                        <span className="text-sm font-bold text-gray-900 truncate">{customer.name}</span>
                        </div>
                    </td>
                    {sortedColumns.map(col => {
                        const isEditing = editingCell?.customerId === customer.id && editingCell?.field === col.id;
                        const valueToShow = isEditing ? editingCell.value : (customer.data[col.id] ?? '');
                        const isLocationEmpty = col.id === 'location' && !valueToShow;

                        return (
                        <td key={col.id} className="px-2 py-2 lg:px-4 lg:py-2 whitespace-nowrap text-sm text-gray-600">
                            {col.type === 'currency' ? (
                            <CurrencyInput
                                value={valueToShow}
                                onChange={(e) => handleCellValueChange(e.target.value)}
                                onFocus={() => handleCellFocus(customer.id, col.id)}
                                onBlur={handleCellBlur}
                            />
                            ) : col.type === 'date' ? (
                            <button
                                onClick={() => setCalendarState({ 
                                    customerId: customer.id, 
                                    field: col.id, 
                                    initialDate: customer.data[col.id] ?? null 
                                })}
                                className="w-full text-left bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-sm"
                            >
                                {(customer.data[col.id] ?? '') || <span className="text-gray-400">日付未設定</span>}
                            </button>
                            ) : col.type === 'person' ? (
                                <div className="flex items-center space-x-2">
                                <MiniAvatar config={employees.find(e => e.name === valueToShow)?.avatar} />
                                <select
                                    value={valueToShow}
                                    onFocus={() => handleCellFocus(customer.id, col.id)}
                                    onChange={(e) => handleDiscreteChange(customer.id, col.id, e.target.value)}
                                    className="w-full bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-sm"
                                >
                                    <option value="">-</option>
                                    {getEmployeeOptions(col.id).map(emp => (
                                        <option key={emp.id} value={emp.name}>{emp.name}</option>
                                    ))}
                                </select>
                                </div>
                            ) : col.type === 'select' ? (
                                <select
                                value={valueToShow}
                                onFocus={() => handleCellFocus(customer.id, col.id)}
                                onChange={(e) => {
                                    if (e.target.value === '__ADD_NEW__') {
                                        setAddOptionModal({ 
                                            customerId: customer.id, 
                                            columnId: col.id,
                                            columnTitle: col.title
                                        });
                                        setNewOptionValue('');
                                        // Reset focus or blur to prevent dropdown issues
                                        e.target.blur();
                                    } else {
                                        handleDiscreteChange(customer.id, col.id, e.target.value);
                                    }
                                }}
                                className="w-full bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-sm"
                                >
                                    <option value="">-</option>
                                    {col.options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    <option value="__ADD_NEW__" className="text-blue-600 font-bold bg-blue-50">+ 選択肢を追加...</option>
                                </select>
                            ) : col.type === 'phone' ? (
                                <input
                                type="tel"
                                className="w-full bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-sm"
                                value={valueToShow}
                                onFocus={() => handleCellFocus(customer.id, col.id)}
                                onChange={(e) => handleCellValueChange(e.target.value)}
                                onBlur={handleCellBlur}
                                placeholder="090-0000-0000"
                            />
                            ) : (
                            <input
                                type="text"
                                className={`w-full bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-1 border-transparent border hover:border-black/10 text-sm ${isLocationEmpty ? 'blink-warning-bg' : ''}`}
                                value={valueToShow}
                                onFocus={() => handleCellFocus(customer.id, col.id)}
                                onChange={(e) => handleCellValueChange(e.target.value)}
                                onBlur={handleCellBlur}
                            />
                            )}
                        </td>
                        )
                    })}
                    </motion.tr>
                    <AnimatePresence>
                        {expandedRowId === customer.id && (
                        <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-white"
                        >
                            <td colSpan={columns.length + 1} className="p-0">
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 bg-slate-50 border-x border-b border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-600 mb-2">ステータスを変更</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.values(CustomerStatus).map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChangeRequest(customer, status)}
                                                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                                        customer.status === status
                                                        ? `${STATUS_CONFIG[status].badge} font-bold ring-2 ring-offset-1 ${STATUS_CONFIG[status].border}`
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400'
                                                    }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="border-t my-3 border-slate-200"></div>
                                        <button 
                                            onClick={() => handleDeleteCustomerRequest(customer)}
                                            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 font-medium rounded-md flex items-center space-x-2 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>この顧客を削除する</span>
                                        </button>
                                    </div>
                                </motion.div>
                            </td>
                        </motion.tr>
                        )}
                    </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmationModal && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                      <h3 className="font-bold text-lg text-gray-800">{confirmationModal.title || '確認'}</h3>
                      {confirmationModal.content}
                  </div>
                  <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
                      <button
                          onClick={confirmationModal.onCancel}
                          className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                      >
                          キャンセル
                      </button>
                      <button
                          onClick={confirmationModal.onConfirm}
                          className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${confirmationModal.confirmButtonClass || 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                          {confirmationModal.confirmButtonText || 'OK'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Add Option Modal */}
      {addOptionModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">新しい選択肢を追加</h3>
                    <button onClick={() => setAddOptionModal(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <label className="block text-sm text-gray-600 mb-2">
                        「{addOptionModal.columnTitle}」に追加する選択肢:
                    </label>
                    <input 
                        type="text" 
                        value={newOptionValue}
                        onChange={e => setNewOptionValue(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        placeholder="入力してください"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleAddOptionSubmit();
                            }
                        }}
                    />
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
                    <button 
                        onClick={() => setAddOptionModal(null)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button 
                        onClick={handleAddOptionSubmit}
                        disabled={!newOptionValue.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        追加
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div 
          className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">新規顧客登録</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">顧客名 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  placeholder="例: 山田 太郎"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">営業担当</label>
                <select
                  value={newCustomerRep}
                  onChange={e => setNewCustomerRep(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">担当者を選択</option>
                  {employees.filter(e => e.role === '営業').map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステイタス</label>
                <select 
                  value={newCustomerStatus}
                  onChange={e => setNewCustomerStatus(e.target.value as CustomerStatus)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {Object.values(CustomerStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleAddCustomer}
                disabled={!newCustomerName}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                登録する
              </button>
            </div>
          </div>
        </div>
      )}
      <CalendarModal
        isOpen={!!calendarState}
        onClose={() => setCalendarState(null)}
        initialDate={calendarState?.initialDate}
        onSelectDate={(date) => {
          if (calendarState) {
            handleDiscreteChange(calendarState.customerId, calendarState.field, date || '');
          }
          setCalendarState(null);
        }}
      />
    </div>
  );
};

export default CustomerSheet;