'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, medicinesApi } from '../../../../lib/apiClient';
import { 
  Plus, Trash2, Search, Pill, Layout, ChevronDown, ChevronUp,
  Activity, Check, Clock, AlertTriangle, ShieldAlert, ShieldCheck,
  Zap, BookOpen, Copy, Info, XCircle
} from 'lucide-react';

// ── Quick Template Starters ────────────────────────────────────────────────────
const QUICK_STARTERS = [
  { label: 'Viral Fever', diagnosis: 'Viral fever / Pyrexia', medicines: ['Paracetamol', 'Cetirizine', 'Vitamin C'], advice: 'Bed rest, plenty of fluids, avoid cold drinks.' },
  { label: 'Common Cold', diagnosis: 'Upper respiratory tract infection', medicines: ['Cetirizine', 'Phenylephrine', 'Bromhexine'], advice: 'Steam inhalation, warm fluids, avoid exposure to cold.' },
  { label: 'Gastritis', diagnosis: 'Acute gastritis / Indigestion', medicines: ['Pantoprazole', 'Domperidone', 'Sucralfate'], advice: 'Avoid spicy food, eat small frequent meals.' },
  { label: 'Hypertension', diagnosis: 'Essential hypertension', medicines: ['Amlodipine', 'Losartan', 'Atenolol'], advice: 'Low salt diet, regular BP monitoring, avoid stress.' },
  { label: 'Type 2 DM', diagnosis: 'Type 2 Diabetes Mellitus', medicines: ['Metformin', 'Glimepiride'], advice: 'Low sugar diet, regular blood glucose monitoring, exercise.' },
  { label: 'UTI', diagnosis: 'Urinary Tract Infection', medicines: ['Ciprofloxacin', 'Phenazopyridine', 'Cranberry extract'], advice: 'Drink plenty of water, complete full antibiotic course.' },
];

const SEVERITY_CONFIG = {
  HIGH:     { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-800',    icon: XCircle,       label: '⚠ CRITICAL' },
  MODERATE: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800', icon: AlertTriangle,  label: '⚡ MODERATE' },
  LOW:      { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800',   icon: Info,           label: '💡 MINOR' },
};

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preloadedStarter, setPreloadedStarter] = useState<typeof QUICK_STARTERS[0] | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['doctor-templates'],
    queryFn: () => doctorApi.getTemplates().then(res => res.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-templates'] }),
  });

  const handleUseStarter = (starter: typeof QUICK_STARTERS[0]) => {
    setPreloadedStarter(starter);
    setShowAdd(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Prescription Templates</h1>
          <p className="text-gray-500 text-sm mt-1">One-click bundles with real-time drug interaction safety checks.</p>
        </div>
        <button 
          onClick={() => { setPreloadedStarter(null); setShowAdd(true); }}
          className="bg-fuchsia-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-all shadow-lg shadow-fuchsia-500/20"
        >
          <Plus className="w-5 h-5" /> Create Bundle
        </button>
      </div>

      {/* ── Quick Starters ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[2rem] p-6 border border-violet-100">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-violet-600" />
          <h2 className="font-black text-gray-900 text-lg">Quick Starters</h2>
          <span className="text-xs text-violet-500 font-bold ml-2 bg-violet-100 px-2 py-0.5 rounded-full">One-click templates</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_STARTERS.map(s => (
            <button 
              key={s.label}
              onClick={() => handleUseStarter(s)}
              className="group flex flex-col items-center gap-2 p-4 bg-white border border-violet-100 rounded-2xl hover:border-violet-400 hover:shadow-md hover:shadow-violet-100 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                <BookOpen className="w-5 h-5 text-violet-600" />
              </div>
              <span className="text-xs font-black text-gray-700 text-center leading-tight">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Template Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-[2rem] animate-pulse" />)
        ) : templates.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Layout className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400">No bundles yet. Use a Quick Starter above!</h3>
          </div>
        ) : (
          templates.map((t: any) => (
            <TemplateCard 
              key={t.id} template={t}
              isExpanded={expandedId === t.id}
              onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
              onDelete={() => { if (confirm('Delete this bundle?')) deleteMutation.mutate(t.id); }}
            />
          ))
        )}
      </div>

      {showAdd && <AddTemplateModal onClose={() => { setShowAdd(false); setPreloadedStarter(null); }} preloaded={preloadedStarter} />}
    </div>
  );
}

// ── Template Card ──────────────────────────────────────────────────────────────
function TemplateCard({ template, isExpanded, onToggle, onDelete }: any) {
  return (
    <div className={`bg-white rounded-[2rem] border transition-all duration-300 ${isExpanded ? 'border-fuchsia-200 shadow-xl shadow-fuchsia-500/5 ring-1 ring-fuchsia-100' : 'border-gray-100 shadow-sm'}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-600">
            <Pill className="w-6 h-6" />
          </div>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors p-2">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight mb-1">{template.template_name}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{template.diagnosis || 'General'}</p>
        
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[11px] font-black bg-gray-50 text-gray-400 px-2.5 py-1 rounded-lg">
            {template.items?.length || 0} MEDICINES
          </span>
          <button onClick={onToggle} className="text-fuchsia-600 font-black text-xs flex items-center gap-1 hover:underline">
            {isExpanded ? 'Show Less' : 'View Items'} 
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pt-2 space-y-4 animate-in slide-in-from-top-2">
          <div className="h-px bg-gray-50 mb-4" />
          {template.items?.map((item: any, idx: number) => (
            <div key={idx} className="flex gap-3">
              <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{item.medicine_name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                     <Clock className="w-3 h-3 opacity-50" /> {item.dosage}
                   </span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase">{item.frequency}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase">{item.duration}</span>
                </div>
              </div>
            </div>
          ))}
          {template.advice && (
            <div className="bg-gray-50 rounded-2xl p-4 mt-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Clinic Advice</p>
              <p className="text-xs text-gray-600 font-medium italic">"{template.advice}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Drug Interaction Panel ─────────────────────────────────────────────────────
function DrugInteractionPanel({ medicineNames }: { medicineNames: string[] }) {
  const [result, setResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const validNames = medicineNames.filter(Boolean);
    if (validNames.length < 2) { setResult(null); return; }
    setChecking(true);
    try {
      const res = await medicinesApi.checkInteractions(validNames);
      setResult(res.data.data);
    } catch { /* silent */ }
    finally { setChecking(false); }
  }, [medicineNames]);

  useEffect(() => {
    const t = setTimeout(check, 600);
    return () => clearTimeout(t);
  }, [check]);

  if (medicineNames.filter(Boolean).length < 2) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-violet-500" />
        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Drug Safety Check</span>
        {checking && <span className="text-[10px] text-violet-400 animate-pulse font-bold">Checking…</span>}
      </div>

      {result && !checking && (
        <>
          {result.safe ? (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">No Known Interactions</p>
                <p className="text-xs text-emerald-600">Selected medicines appear safe to co-prescribe.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2">
                <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs font-black text-red-700">{result.interactions.length} interaction(s) detected — review before prescribing</p>
              </div>
              {result.interactions.map((ix: any, i: number) => {
                const cfg = SEVERITY_CONFIG[ix.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.LOW;
                const SevIcon = cfg.icon;
                return (
                  <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-1`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SevIcon className={`w-4 h-4 ${cfg.text} flex-shrink-0`} />
                        <span className="text-xs font-black text-gray-900">
                          {ix.medicine_a} ↔ {ix.medicine_b}
                        </span>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className={`text-xs ${cfg.text} font-medium leading-relaxed pl-6`}>{ix.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {result.schedule_h_medicines?.length > 0 && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-orange-800">Schedule H Drugs Detected</p>
                <p className="text-xs text-orange-600 font-medium mt-0.5">
                  {result.schedule_h_medicines.join(', ')} — valid prescription required for dispensing.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Add Template Modal ─────────────────────────────────────────────────────────
function AddTemplateModal({ onClose, preloaded }: { onClose: () => void; preloaded?: typeof QUICK_STARTERS[0] | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState(preloaded?.label ?? '');
  const [diagnosis, setDiagnosis] = useState(preloaded?.diagnosis ?? '');
  const [advice, setAdvice] = useState(preloaded?.advice ?? '');
  const [items, setItems] = useState<any[]>(
    preloaded?.medicines.map(m => ({ medicine_name: m, dosage: '1 tab', frequency: 'Twice daily', duration: '5 days' })) ?? []
  );
  const [vitals, setVitals] = useState({ bp: '', pulse: '', spo2: '', temp: '', weight: '', height: '' });

  // Calculate BMI and Growth Indicator
  const calculateBMI = () => {
    if (!vitals.weight || !vitals.height) return null;
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100; // cm to m
    const bmi = w / (h * h);
    return bmi.toFixed(1);
  };
  const bmiVal = calculateBMI();

  const [searchQ, setSearchQ] = useState('');

  const { data: searchResults = [] } = useQuery({
    queryKey: ['medicine-search', searchQ],
    queryFn: () => medicinesApi.search(searchQ).then(res => res.data.data),
    enabled: searchQ.length > 2
  });

  const mutation = useMutation({
    mutationFn: (data: any) => doctorApi.createTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-templates'] }); onClose(); }
  });

  const addItem = (med: any) => {
    setItems([...items, { medicine_id: med.id, medicine_name: med.name, dosage: '1 tab', frequency: 'Twice daily', duration: '5 days' }]);
    setSearchQ('');
  };

  const medicineNames = items.map(i => i.medicine_name).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {preloaded ? `Quick Start: ${preloaded.label}` : 'Create Medicine Bundle'}
            </h2>
            {preloaded && (
              <p className="text-xs text-violet-500 font-bold mt-1 flex items-center gap-1">
                <Copy className="w-3 h-3" /> Pre-filled — review and save
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">✕</button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Bundle Name *</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Mild Fever Pack"
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Common Diagnosis *</label>
              <input 
                value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                placeholder="e.g. Viral Fever"
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Elite Vitals Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-500" />
                Patient Clinical Vitals
              </h3>
              {bmiVal && (
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">BMI Analysis</span>
                  <span className={`text-sm font-black ${Number(bmiVal) > 25 ? 'text-rose-600' : 'text-emerald-600'}`}>{bmiVal} <span className="text-[10px] opacity-60">kg/m²</span></span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { id: 'bp', label: 'BP (mmHg)', placeholder: '120/80', icon: '💓' },
                { id: 'pulse', label: 'Pulse (bpm)', placeholder: '72', icon: '⏱️' },
                { id: 'spo2', label: 'SpO2 (%)', placeholder: '98', icon: '🌬️' },
                { id: 'temp', label: 'Temp (ºF)', placeholder: '98.4', icon: '🌡️' },
                { id: 'weight', label: 'Weight (kg)', placeholder: '70', icon: '⚖️' },
                { id: 'height', label: 'Height (cm)', placeholder: '170', icon: '📏' },
              ].map(v => (
                <div key={v.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-300 transition-all group">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1 group-focus-within:text-rose-500 transition-colors">{v.label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm group-focus-within:scale-125 transition-transform duration-300">{v.icon}</span>
                    <input 
                      type="text" 
                      value={(vitals as any)[v.id]} 
                      onChange={(e) => setVitals({...vitals, [v.id]: e.target.value})}
                      className="w-full text-base font-black text-slate-700 outline-none placeholder:text-slate-200"
                      placeholder={v.placeholder}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Medicine Search + List */}
          <div className="space-y-4">
             <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Medicines *</label>
             <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search and add medicine..."
                  className="w-full bg-gray-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none shadow-inner"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-2xl mt-2 shadow-2xl z-10 overflow-hidden">
                    {searchResults.map((med: any) => (
                      <button 
                        key={med.id} onClick={() => addItem(med)}
                        className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between group"
                      >
                        <div>
                          <p>{med.name}</p>
                          {med.generic_name && <p className="text-[10px] text-gray-400 font-normal">{med.generic_name}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {med.is_schedule_h && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black">Sch-H</span>}
                          <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
             </div>

             <div className="space-y-3">
               {items.map((item, idx) => (
                 <div key={idx} className="bg-gray-50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                   <div className="flex-1">
                     <p className="text-sm font-black text-gray-900">{item.medicine_name}</p>
                   </div>
                   <div className="flex items-center gap-2 flex-wrap">
                     <input 
                       value={item.dosage} placeholder="Dosage"
                       onChange={e => { const n = [...items]; n[idx].dosage = e.target.value; setItems(n); }}
                       className="w-20 bg-white rounded-lg px-2 py-1.5 text-xs font-bold border border-gray-200 outline-none"
                     />
                     <input 
                       value={item.frequency} placeholder="Frequency"
                       onChange={e => { const n = [...items]; n[idx].frequency = e.target.value; setItems(n); }}
                       className="w-28 bg-white rounded-lg px-2 py-1.5 text-xs font-bold border border-gray-200 outline-none"
                     />
                     <input 
                       value={item.duration} placeholder="Duration"
                       onChange={e => { const n = [...items]; n[idx].duration = e.target.value; setItems(n); }}
                       className="w-20 bg-white rounded-lg px-2 py-1.5 text-xs font-bold border border-gray-200 outline-none"
                     />
                     <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 p-2 hover:bg-white rounded-xl transition-colors">
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>

          {/* ── Drug Interaction Check ─────────────────────────────────── */}
          <DrugInteractionPanel medicineNames={medicineNames} />

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Common Advice (Optional)</label>
            <textarea 
              value={advice} onChange={e => setAdvice(e.target.value)}
              placeholder="e.g. Bed rest, avoid cold drinks..."
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none resize-none h-24"
            />
          </div>
        </div>

        <div className="p-8 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button 
            disabled={!name || !diagnosis || items.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate({ template_name: name, diagnosis, advice, items })}
            className="bg-fuchsia-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : <><Check className="w-4 h-4" /> Save Bundle</>}
          </button>
        </div>
      </div>
    </div>
  );
}
