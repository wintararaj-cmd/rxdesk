'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, medicinesApi } from '../../../../lib/apiClient';
import { 
  Plus, 
  Trash2, 
  Search, 
  Pill, 
  Layout, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Check
} from 'lucide-react';

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['doctor-templates'],
    queryFn: () => doctorApi.getTemplates().then(res => res.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-templates'] }),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Medicine Bundles</h1>
          <p className="text-gray-500 text-sm mt-1">Manage prescription templates for high-speed clinical workflow.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-fuchsia-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-all shadow-lg shadow-fuchsia-500/20"
        >
          <Plus className="w-5 h-5" /> Create Bundle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-[2rem] animate-pulse" />)
        ) : templates.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Layout className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400">No bundles created yet.</h3>
          </div>
        ) : (
          templates.map((t: any) => (
            <TemplateCard 
              key={t.id} 
              template={t} 
              isExpanded={expandedId === t.id}
              onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
              onDelete={() => {
                if (confirm('Delete this bundle?')) deleteMutation.mutate(t.id);
              }}
            />
          ))
        )}
      </div>

      {showAdd && <AddTemplateModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

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
                   <span className="text-[10px] font-bold text-gray-400 uppercase">
                     {item.frequency}
                   </span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase">
                     {item.duration}
                   </span>
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

function AddTemplateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');

  const { data: searchResults = [] } = useQuery({
    queryKey: ['medicine-search', searchQ],
    queryFn: () => medicinesApi.search(searchQ).then(res => res.data.data),
    enabled: searchQ.length > 2
  });

  const mutation = useMutation({
    mutationFn: (data: any) => doctorApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-templates'] });
      onClose();
    }
  });

  const addItem = (med: any) => {
    setItems([...items, { medicine_id: med.id, medicine_name: med.name, dosage: '1 tab', frequency: 'Twice daily', duration: '5 days' }]);
    setSearchQ('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Create Medicine Bundle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">✕</button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Bundle Name</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Mild Fever Pack"
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Common Diagnosis</label>
              <input 
                value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                placeholder="e.g. Viral Fever"
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
             <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Select Medicines</label>
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
                        key={med.id} 
                        onClick={() => addItem(med)}
                        className="w-full text-left px-6 py-4 text-sm font-bold hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between group"
                      >
                        {med.name}
                        <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100" />
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
                   <div className="flex items-center gap-2">
                     <input 
                       value={item.dosage} 
                       onChange={e => {
                         const n = [...items];
                         n[idx].dosage = e.target.value;
                         setItems(n);
                       }}
                       className="w-20 bg-white rounded-lg px-2 py-1.5 text-xs font-bold border border-gray-200 outline-none"
                     />
                     <input 
                       value={item.frequency} 
                       onChange={e => {
                         const n = [...items];
                         n[idx].frequency = e.target.value;
                         setItems(n);
                       }}
                       className="w-28 bg-white rounded-lg px-2 py-1.5 text-xs font-bold border border-gray-200 outline-none"
                     />
                     <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 p-2 hover:bg-white rounded-xl transition-colors">
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>

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
            disabled={!name || items.length === 0 || mutation.isPending}
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
