import { useState, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { products } from '../utils/products';
import { Plus, GripVertical, MousePointer, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MagazineGrid = ({ onPageClick, pages: customPages, isPublic = false }) => {
  const { t, language } = useLanguage();
  const { pages: contextPages, loading: contextLoading, reorderPage } = useDatabase();
  const pages = customPages || contextPages;
  const loading = customPages ? false : contextLoading;

  // --- Drag & Drop State ---
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedPageNum, setDraggedPageNum] = useState(null);
  const [dropTargetNum, setDropTargetNum] = useState(null);
  const [swapStatus, setSwapStatus] = useState(null); // { type: 'success'|'error', message: string }
  const swapStatusTimer = useRef(null);

  // A page is "locked" if it's an editorial page (legacy customer_id) and has no real reservation
  // OR if it's one of the two back covers (last 2 page numbers)
  const sortedPageNums = pages
    ? pages.map(p => p.page_number).filter(n => typeof n === 'number').sort((a, b) => a - b)
    : [];
  const backCoverNums = new Set(
    sortedPageNums.length >= 2
      ? [sortedPageNums[sortedPageNums.length - 2], sortedPageNums[sortedPageNums.length - 1]]
      : []
  );

  const isPageLocked = (page) => {
    // Only the two back-cover pages (portada interior & contraportada) remain fixed.
    // All other pages — including editorial red spots and customer-reserved pages — can be reordered.
    return backCoverNums.has(page.page_number);
  };

  const getStatusColor = (page) => {
    let classes = '';
    if (isPublic && backCoverNums.has(page.page_number)) {
      return 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-60';
    }
    if (page.ads && page.ads.length > 0) {
      classes += ' border-red-700 text-white';
    } else if (backCoverNums.has(page.page_number)) {
      classes += ' border-orange-500 text-white';
    } else {
      switch (page.status) {
        case 'Locked': classes += ' border-red-300 text-red-800 cursor-not-allowed'; break;
        case 'Reserved': classes += ' border-red-700 text-white'; break;
        default: classes += ' hover:bg-gray-200 border-gray-300 text-gray-800'; break;
      }
    }

    if (!page.ads || page.ads.length === 0) {
      if (backCoverNums.has(page.page_number)) classes += ' bg-orange-400 hover:bg-orange-500';
      else if (page.status === 'Locked') classes += ' bg-red-100';
      else if (page.status === 'Reserved') classes += ' bg-red-500 hover:bg-red-600';
      else classes += ' bg-gray-100';
    }

    return classes;
  };

  const getPageSlots = (page) => {
    if (!page.ads || page.ads.length === 0) {
      return { top: null, middle: null, bottom: null };
    }
    const filledSlots = new Set();
    const slotToAdMap = { top: null, middle: null, bottom: null };
    let hasAny1 = false;

    page.ads.forEach(ad => {
      const prod = products.find(p => p.name === ad.ad_type);
      if (prod) {
        prod.requiredSlots.forEach(slot => {
          if (slot === 'any_1') { hasAny1 = true; slotToAdMap['any_1'] = ad; }
          else { filledSlots.add(slot); slotToAdMap[slot] = ad; }
        });
      } else {
        filledSlots.add('top'); filledSlots.add('middle'); filledSlots.add('bottom');
        slotToAdMap['top'] = ad; slotToAdMap['middle'] = ad; slotToAdMap['bottom'] = ad;
      }
    });

    if (hasAny1) {
      const ad = slotToAdMap['any_1'];
      if (!filledSlots.has('top')) { filledSlots.add('top'); slotToAdMap['top'] = ad; }
      else if (!filledSlots.has('middle')) { filledSlots.add('middle'); slotToAdMap['middle'] = ad; }
      else if (!filledSlots.has('bottom')) { filledSlots.add('bottom'); slotToAdMap['bottom'] = ad; }
    }

    return {
      top: slotToAdMap['top'] || null,
      middle: slotToAdMap['middle'] || null,
      bottom: slotToAdMap['bottom'] || null
    };
  };

  const getBackgroundStyle = (page) => {
    if (!page.ads || page.ads.length === 0) return {};
    const { top: adTop, middle: adMid, bottom: adBot } = getPageSlots(page);
    const red = '#ef4444';
    const white = '#f3f4f6';

    const getAdColor = (ad) => {
      if (!ad) return white;
      if (ad.isFake) return '#93c5fd'; // Light blue for fake reservations
      if (ad.isPaid) return '#22c55e';
      if (ad.isPreReserved) return '#f97316';
      if (ad.isNew) return '#3b82f6';
      return red;
    };

    const top = getAdColor(adTop);
    const mid = getAdColor(adMid);
    const bot = getAdColor(adBot);

    if (top === mid && mid === bot && top !== white) return { background: top };
    return {
      background: `linear-gradient(to bottom, ${top} 0%, ${top} 33.33%, ${mid} 33.33%, ${mid} 66.66%, ${bot} 66.66%, ${bot} 100%)`
    };
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e, pageNum) => {
    setDraggedPageNum(pageNum);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(pageNum));
  };

  const handleDragOver = (e, pageNum) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (pageNum !== draggedPageNum) {
      setDropTargetNum(pageNum);
    }
  };

  const handleDragLeave = (e) => {
    // Only clear drop target if we're leaving the cell (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTargetNum(null);
    }
  };

  const handleDrop = async (e, targetPageNum) => {
    e.preventDefault();
    setDropTargetNum(null);

    const sourcePageNum = draggedPageNum;
    setDraggedPageNum(null);

    if (!sourcePageNum || sourcePageNum === targetPageNum) return;

    // Validate target is not locked
    const targetPage = pages.find(p => p.page_number === targetPageNum);
    if (!targetPage || isPageLocked(targetPage)) {
      showSwapStatus('error', t('magazine_swap_locked'));
      return;
    }

    try {
      await reorderPage(sourcePageNum, targetPageNum);
      const msg = t('magazine_swap_success')
        .replace('{a}', sourcePageNum)
        .replace('{b}', targetPageNum);
      showSwapStatus('success', msg);
    } catch (err) {
      console.error('Failed to reorder pages:', err);
      showSwapStatus('error', t('magazine_swap_error'));
    }
  };

  const handleDragEnd = () => {
    setDraggedPageNum(null);
    setDropTargetNum(null);
  };

  const showSwapStatus = (type, message) => {
    if (swapStatusTimer.current) clearTimeout(swapStatusTimer.current);
    setSwapStatus({ type, message });
    swapStatusTimer.current = setTimeout(() => setSwapStatus(null), 4000);
  };

  if (loading) {
    return <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 h-64 flex items-center justify-center">{t('loading_pages')}</div>;
  }

  const totalPages = pages ? pages.filter(p => typeof p.page_number === 'number').length : 0;

  return (
    <div className="p-2.5 sm:p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">
            {t('magazine_layout').replace('92', String(totalPages))}
          </h2>
        </div>
        {!isPublic && (
          <button
            onClick={() => onPageClick({ page_number: 'Unassigned', status: 'Available', ads: [] })}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t('new_unassigned')}
          </button>
        )}
      </div>

      {/* Edit Mode Toggle */}
      {!isPublic && (
        <button
          onClick={() => {
            setIsDragMode(prev => !prev);
            setDraggedPageNum(null);
            setDropTargetNum(null);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${
            isDragMode
              ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-200'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200'
          }`}
        >
          {isDragMode ? <GripVertical size={16} /> : <MousePointer size={16} />}
          {isDragMode ? t('magazine_edit_mode') : t('magazine_normal_mode')}
        </button>
      )}

      {/* Drag mode hint bar */}
      {isDragMode && (
        <div className="mb-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700 flex items-center gap-2">
          <GripVertical size={13} className="shrink-0" />
          {t('magazine_drag_hint')}
          <span className="ml-auto text-violet-400 text-[10px] font-medium">
            🔒 {t('magazine_swap_locked')}
          </span>
        </div>
      )}

      {/* Swap Status Banner */}
      {swapStatus && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
          swapStatus.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {swapStatus.type === 'success' ? <Check size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}
          {swapStatus.message}
        </div>
      )}

      {/* Page Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {pages.map((page) => {
          const locked = isPageLocked(page);
          const isDragging = isDragMode && draggedPageNum === page.page_number;
          const isDropTarget = isDragMode && dropTargetNum === page.page_number && draggedPageNum !== page.page_number;
          const canDrag = isDragMode && !locked;

          // Tooltip content
          let tooltipContent = null;
          if (page.ads && page.ads.length > 0) {
            tooltipContent = (
              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none z-50 flex flex-col gap-1">
                <div className="font-bold border-b border-gray-700 pb-1">{t('page')} {page.page_number}</div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('status')}</span>
                  <span className="font-medium text-blue-300">{page.status === 'Reserved' ? t('status_reserved') : (page.status === 'Available' ? t('po_available') : page.status)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-gray-400">{t('occupants')}</span>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {page.ads.map((ad, idx) => {
                      const c = fallbackCustomers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
                      const cName = isPublic
                        ? (ad.isFake ? 'No disponible' : (language === 'es' ? 'Reservado' : 'Reserved'))
                        : (c ? (c.commercial_name || c.fiscal_name) : ad.customer_name);
                      return (
                        <li key={idx} className="truncate">
                          {cName} ({ad.ad_type})
                          {ad.isPreReserved ? ` ${t('pre_reserved')}` : ''}
                          {ad.isPaid ? ` ${t('paid')}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          }

          const hasExpired = page.ads && page.ads.some(ad => ad.isPreReserved && ad.expires_at && new Date() > new Date(ad.expires_at));

          // Generate blocks for the visual slots
          const { top: adTop, middle: adMid, bottom: adBot } = getPageSlots(page);
          const blocks = [];

          if (adTop && adTop === adMid && adMid === adBot) {
            blocks.push({ height: '100%', ad: adTop });
          } else if (adTop && adTop === adMid) {
            blocks.push({ height: '66.667%', ad: adTop });
            blocks.push({ height: '33.333%', ad: adBot });
          } else if (adMid && adMid === adBot) {
            blocks.push({ height: '33.333%', ad: adTop });
            blocks.push({ height: '66.667%', ad: adMid });
          } else {
            blocks.push({ height: '33.333%', ad: adTop });
            blocks.push({ height: '33.333%', ad: adMid });
            blocks.push({ height: '33.333%', ad: adBot });
          }

          return (
            <button
              key={page.page_number}
              disabled={page.status === 'Locked' || (isDragMode && !canDrag && !locked) || (isPublic && backCoverNums.has(page.page_number))}
              draggable={canDrag}
              onClick={() => {
                if (!isDragMode) {
                  onPageClick(page);
                }
              }}
              onDragStart={canDrag ? (e) => handleDragStart(e, page.page_number) : undefined}
              onDragOver={isDragMode && !locked ? (e) => handleDragOver(e, page.page_number) : undefined}
              onDragLeave={isDragMode ? handleDragLeave : undefined}
              onDrop={isDragMode && !locked ? (e) => handleDrop(e, page.page_number) : undefined}
              onDragEnd={isDragMode ? handleDragEnd : undefined}
              className={`
                group relative aspect-[3/4] rounded-md border-2 flex flex-col items-center justify-center
                transition-all duration-200 ease-in-out font-medium p-1 text-center
                ${getStatusColor(page)}
                ${isDragging ? 'brightness-75 saturate-50 scale-95 ring-2 ring-dashed ring-violet-400' : ''}
                ${isDropTarget ? 'ring-4 ring-blue-500 ring-offset-1 scale-105 brightness-110 z-10' : ''}
                ${canDrag && !isDragging ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-violet-300' : ''}
                ${locked && isDragMode ? 'opacity-60 cursor-not-allowed' : ''}
              `}
              style={getBackgroundStyle(page)}
            >
              {/* Drag mode lock indicator */}
              {locked && isDragMode && (
                <span className="absolute top-0.5 right-0.5 text-[8px] leading-none opacity-60">🔒</span>
              )}

              {/* Drop target indicator: show insertion arrow */}
              {isDropTarget && (
                <div className="absolute inset-0 rounded-md border-2 border-blue-500 bg-blue-500/10 flex items-center justify-center pointer-events-none">
                  <span className="text-blue-600 text-lg font-black">
                    {draggedPageNum && draggedPageNum < page.page_number ? '↓' : '↑'}
                  </span>
                </div>
              )}

              {/* Page Number: Centered watermark when occupied, normal layout when empty */}
              <span className={`
                pointer-events-none select-none transition-all duration-200
                ${page.ads && page.ads.length > 0 
                  ? 'absolute text-2xl font-black z-0 opacity-15' 
                  : 'text-lg font-bold z-10'
                } 
                ${isDragging ? '' : 'mix-blend-multiply'}`}
              >
                {page.page_number}
              </span>

              {hasExpired && (
                <div className="absolute -top-2 -right-2 bg-yellow-100 rounded-full shadow-lg border border-yellow-300 z-50">
                  <span className="text-xl leading-none block p-0.5">⚠️</span>
                </div>
              )}

              {/* Specific Slot Overlay for Customer Names */}
              {page.ads && page.ads.length > 0 && (
                <div className="absolute inset-0 flex flex-col z-10 pointer-events-none w-full h-full">
                  {blocks.map((block, idx) => {
                    if (!block.ad) {
                      return <div key={idx} style={{ height: block.height }} className="w-full" />;
                    }

                    let cName = '';
                    if (isPublic) {
                      cName = block.ad.isFake ? 'No disponible' : (t('status_reserved') || 'Reservado');
                    } else {
                      cName = block.ad.customer_name;
                      if (!cName && block.ad.customer_id !== 'legacy') {
                        const c = fallbackCustomers.find(cust => cust.id === block.ad.customer_id || cust.nif === block.ad.customer_id);
                        cName = c ? (c.commercial_name || c.fiscal_name) : 'Unknown';
                      } else if (!cName) {
                        cName = t('status_reserved');
                      }
                    }

                    return (
                      <div 
                        key={idx} 
                        style={{ height: block.height }} 
                        className="w-full flex flex-col justify-center items-center px-1 overflow-hidden border-b border-black/5 last:border-b-0"
                      >
                        <span className="font-extrabold truncate w-full text-[8px] sm:text-[9px] leading-tight text-black select-none mix-blend-multiply">
                          {cName}
                        </span>
                        <span className="truncate w-full text-[7px] sm:text-[8px] leading-none opacity-80 text-black/85 select-none mix-blend-multiply mt-0.5">
                          {block.ad.ad_type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {tooltipContent}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MagazineGrid;
