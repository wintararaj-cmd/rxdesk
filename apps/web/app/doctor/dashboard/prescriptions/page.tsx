'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, appointmentApi, prescriptionApi } from '../../../../lib/apiClient';

interface PrescriptionItem {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

interface Prescription {
  id: string;
  diagnosis: string;
  created_at: string;
  items: PrescriptionItem[];
  patient?: { full_name?: string; age?: number; gender?: string };
  shop?: { shop_name: string; city: string };
  appointment?: { appointment_date: string; slot_start_time: string };
}

interface AppointmentOption {
  id: string;
  appointment_date: string;
  slot_start_time: string;
  patient?: { full_name?: string };
  chamber?: { shop?: { shop_name?: string; city?: string } };
}

const EMPTY_ITEM: PrescriptionItem = { medicine_name: '', dosage: '', frequency: '', duration: '', quantity: 1 };

export default function DoctorPrescriptionsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [apptId, setApptId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [complaint, setComplaint] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [advice, setAdvice] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [formError, setFormError] = useState('');

  const openModal = () => {
    setApptId('');
    setDiagnosis('');
    setComplaint('');
    setItems([{ ...EMPTY_ITEM }]);
    setAdvice('');
    setFollowUp('');
    setFormError('');
    setShowModal(true);
  };

  const { data: prescriptions = [], isLoading } = useQuery<Prescription[]>({
    queryKey: ['doctor-web-prescriptions'],
    queryFn: () => doctorApi.getMyPrescriptions().then((r) => r.data.data),
  });

  const { data: appointments = [] } = useQuery<AppointmentOption[]>({
    queryKey: ['doctor-web-appt-history-completed'],
    queryFn: () =>
      appointmentApi
        .getHistory({ status: 'completed', limit: 100 })
        .then((r) => r.data.data ?? []),
    enabled: showModal,
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => prescriptionApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-web-prescriptions'] });
      setShowModal(false);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error?.message ?? 'Failed to create prescription.'),
  });

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = () => {
    if (!apptId) { setFormError('Please select an appointment.'); return; }
    if (!diagnosis.trim()) { setFormError('Diagnosis is required.'); return; }
    const validItems = items.filter((it) => it.medicine_name.trim());
    if (validItems.length === 0) { setFormError('Add at least one medicine.'); return; }
    setFormError('');
    createMutation.mutate({
      appointment_id: apptId,
      diagnosis: diagnosis.trim(),
      chief_complaint: complaint.trim() || undefined,
      items: validItems,
      advice: advice.trim() || undefined,
      follow_up_date: followUp || undefined,
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescriptions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} issued
          </p>
        </div>
        <button
          onClick={openModal}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          + New Prescription
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-gray-500">No prescriptions issued yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{rx.diagnosis}</p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {rx.patient?.full_name ?? 'Unknown Patient'}
                    {rx.patient?.age ? ` · ${rx.patient.age}y` : ''}
                    {rx.patient?.gender ? ` · ${rx.patient.gender}` : ''}
                  </p>
                </div>
                <p className="text-gray-400 text-xs shrink-0 ml-4">
                  {new Date(rx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {(rx.shop || rx.appointment) && (
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 pb-3 border-b border-gray-50">
                  {rx.shop && <span>🏥 {rx.shop.shop_name}, {rx.shop.city}</span>}
                  {rx.appointment?.slot_start_time && <span>⏰ {rx.appointment.slot_start_time}</span>}
                </div>
              )}

              {rx.items.length > 0 && (
                <div className="space-y-1">
                  {rx.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-xs flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-800">{item.medicine_name}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500 text-xs">{item.dosage} · {item.frequency} · {item.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Prescription Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">New Prescription</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Appointment picker */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Appointment *</label>
                <select
                  value={apptId}
                  onChange={(e) => setApptId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">— Select completed appointment —</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.patient?.full_name ?? 'Patient'} · {a.appointment_date} {a.slot_start_time}
                      {a.chamber?.shop?.shop_name ? ` · ${a.chamber.shop.shop_name}` : ''}
                    </option>
                  ))}
                </select>
                {appointments.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No completed appointments found.</p>
                )}
              </div>

              {/* Diagnosis */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Diagnosis *</label>
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Viral fever, Hypertension…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Chief complaint */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                  Chief Complaint <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Headache and fever for 3 days"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Medicine items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Medicines *</label>
                  <button
                    onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                    className="text-xs text-emerald-600 font-semibold hover:text-emerald-700"
                  >
                    + Add Medicine
                  </button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-xl p-4 relative">
                      {items.length > 1 && (
                        <button
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-3 right-3 text-gray-300 hover:text-red-400 text-sm font-bold"
                        >✕</button>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-gray-400 mb-1 block">Medicine Name *</label>
                          <input
                            value={item.medicine_name}
                            onChange={(e) => updateItem(idx, 'medicine_name', e.target.value)}
                            placeholder="e.g. Paracetamol 500mg"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Dosage</label>
                          <input
                            value={item.dosage}
                            onChange={(e) => updateItem(idx, 'dosage', e.target.value)}
                            placeholder="e.g. 1 tablet"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Frequency</label>
                          <input
                            value={item.frequency}
                            onChange={(e) => updateItem(idx, 'frequency', e.target.value)}
                            placeholder="e.g. Twice daily"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Duration</label>
                          <input
                            value={item.duration}
                            onChange={(e) => updateItem(idx, 'duration', e.target.value)}
                            placeholder="e.g. 5 days"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Quantity</label>
                          <input
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            type="number"
                            min={1}
                            max={999}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advice */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                  Advice <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  placeholder="e.g. Rest well, avoid oily food, drink plenty of water"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Follow-up date */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                  Follow-up Date <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {formError && <p className="text-red-500 text-sm">{formError}</p>}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Issuing…' : 'Issue Prescription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
