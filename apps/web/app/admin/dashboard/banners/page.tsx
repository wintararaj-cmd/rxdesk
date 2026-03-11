'use client';

import { useEffect, useState, useRef } from 'react';
import { bannerApi } from '../../../../lib/apiClient';

type Banner = {
    id: string;
    title: string | null;
    image_url: string;
    link_url: string | null;
    is_active: boolean;
    sort_order: number;
};

export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [is_active, setIsActive] = useState(true);
    const [sortOrder, setSortOrder] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const res = await bannerApi.getAll(true);
            setBanners(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const resetForm = () => {
        setEditingBanner(null);
        setTitle('');
        setLinkUrl('');
        setIsActive(true);
        setSortOrder(0);
        setSelectedFile(null);
        setPreviewUrl('');
        setError('');
    };

    const openAddModal = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEditModal = (banner: Banner) => {
        setEditingBanner(banner);
        setTitle(banner.title || '');
        setLinkUrl(banner.link_url || '');
        setIsActive(banner.is_active);
        setSortOrder(banner.sort_order);
        setSelectedFile(null);
        setPreviewUrl(banner.image_url);
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('link_url', linkUrl);
            formData.append('is_active', is_active.toString());
            formData.append('sort_order', sortOrder.toString());

            if (selectedFile) {
                formData.append('image', selectedFile);
            } else if (!editingBanner) {
                setError('Please select an image');
                setFormLoading(false);
                return;
            }

            if (editingBanner) {
                await bannerApi.update(editingBanner.id, formData);
            } else {
                await bannerApi.create(formData);
            }

            setModalOpen(false);
            fetchBanners();
        } catch (err: any) {
            setError(err?.response?.data?.error?.message ?? 'Failed to save banner');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this banner?')) return;
        try {
            await bannerApi.delete(id);
            fetchBanners();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">App Banners</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage promotional banners and advertisements</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-[0.98]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add New Banner
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="aspect-video bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : banners.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-16 text-center">
                    <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                    </div>
                    <h3 className="text-white font-semibold">No banners found</h3>
                    <p className="text-gray-500 text-sm mt-1 mb-6">Create your first banner to show on the mobile apps</p>
                    <button onClick={openAddModal} className="text-rose-400 font-semibold text-sm hover:underline underline-offset-4">Create Banner</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners.map((banner) => (
                        <div key={banner.id} className="group relative bg-[#080b10] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-rose-500/30 transition-all shadow-xl">
                            <div className="aspect-[16/7] relative overflow-hidden bg-gray-900">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={banner.image_url} alt={banner.title || 'Banner'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                {!banner.is_active && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                                        <span className="text-xs font-bold text-white bg-gray-800 px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">Inactive</span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <button
                                        onClick={() => openEditModal(banner)}
                                        className="p-2 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(banner.id)}
                                        className="p-2 bg-red-500/20 backdrop-blur-md hover:bg-red-500/40 text-red-400 rounded-lg transition-colors border border-red-500/20"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-bold text-white truncate pr-4">{banner.title || 'Untitled Banner'}</h4>
                                    <span className="text-[10px] font-mono text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">#{banner.sort_order}</span>
                                </div>
                                <p className="text-[11px] text-gray-500 truncate mb-3 font-mono">{banner.link_url || 'No redirect URL'}</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-tighter">{banner.is_active ? 'Active' : 'Offline'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-[#080b10]/80 backdrop-blur-sm animate-in fade-in" onClick={() => !formLoading && setModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-[#0d1117] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white pr-4">{editingBanner ? 'Edit Banner' : 'Create New Banner'}</h2>
                            <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Image Upload Area */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-400 mb-3">Banner Image</label>
                                <div
                                    className={`aspect-[16/7] relative rounded-2xl border-2 border-dashed transition-all group overflow-hidden ${previewUrl ? 'border-transparent' : 'border-white/[0.08] hover:border-rose-500/40 bg-white/[0.02]'}`}
                                >
                                    {previewUrl ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-semibold border border-white/20 text-white transition-all transform translate-y-2 group-hover:translate-y-0"
                                                >
                                                    Change
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedFile(null); setPreviewUrl(''); }}
                                                    className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/20 text-red-400 transition-all transform translate-y-2 group-hover:translate-y-0"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-rose-400 transition-colors"
                                        >
                                            <div className="w-12 h-12 bg-white/[0.05] rounded-xl flex items-center justify-center group-hover:bg-rose-500/10">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm font-medium">Click to upload 16:7 banner image</span>
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-400 mb-2">Display Title (optional)</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white outline-none focus:border-rose-500/50 transition-all placeholder:text-gray-600"
                                        placeholder="e.g. Summer Health Camp"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-400 mb-2">Target Link (optional)</label>
                                    <input
                                        type="url"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white outline-none focus:border-rose-500/50 transition-all placeholder:text-gray-600 font-mono text-sm"
                                        placeholder="https://rxdesk.in/promo/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-400 mb-2">Display Order</label>
                                    <input
                                        type="number"
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(parseInt(e.target.value || '0'))}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white outline-none focus:border-rose-500/50 transition-all font-mono"
                                        min={0}
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={is_active}
                                                onChange={(e) => setIsActive(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-5 rounded-full transition-colors ${is_active ? 'bg-rose-600' : 'bg-white/10'}`} />
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${is_active ? 'translate-x-5' : ''}`} />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-400 group-hover:text-gray-300">Visible to users</span>
                                    </label>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl text-sm border border-red-500/20">
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={formLoading}
                                    className="flex-1 px-4 py-3 border border-white/[0.08] text-white font-semibold rounded-xl hover:bg-white/[0.04] transition-colors disabled:opacity-50 text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 px-4 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                >
                                    {formLoading && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {editingBanner ? 'Update Banner' : 'Publish Banner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
