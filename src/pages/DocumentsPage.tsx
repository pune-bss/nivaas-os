import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderLock,
  Upload,
  Search,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  uploadCompanyFile,
} from '../firebase/firestoreService';
import { DocumentRecord } from '../types/crm';

type DocCategory = DocumentRecord['category'];

const CATEGORY_LABELS: Record<DocCategory, string> = {
  agreement_template: 'Agreement / Allotment Template',
  receipt: 'Booking / Payment Receipt',
  rera_certificate: 'RERA Registration Certificate',
  kyc: 'Customer KYC Document',
  floor_plan: 'Floor Plan / Brochure',
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsPage() {
  const { activeCompanyId, activeRole } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocCategory>('all');
  const [sortBy, setSortBy] = useState<'title' | 'size'>('title');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('agreement_template');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const unsub = subscribeTenantCollection<DocumentRecord>(
      activeCompanyId,
      'documents',
      (items) => {
        setDocuments(items);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    return () => unsub();
  }, [activeCompanyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents
      .filter((doc) => {
        if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.fileName.toLowerCase().includes(q) ||
          CATEGORY_LABELS[doc.category].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        return a.title.localeCompare(b.title);
      });
  }, [documents, search, categoryFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const canDelete = activeRole === 'company_admin' || activeRole === 'super_admin';

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (!title.trim() || title.trim().length < 2) {
      showToast('Document title must be at least 2 characters.', 'error');
      return;
    }
    if (!selectedFile) {
      showToast('Please select a PDF or image file (max 10 MB).', 'error');
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadCompanyFile(activeCompanyId, 'documents', selectedFile);
      await createTenantDoc(activeCompanyId, 'documents', {
        title: title.trim(),
        category,
        fileName: selectedFile.name.slice(0, 200),
        fileUrl,
        mimeType: selectedFile.type || 'application/octet-stream',
        sizeBytes: selectedFile.size,
      });
      showToast('Document uploaded to encrypted vault.', 'success');
      setShowUpload(false);
      setTitle('');
      setSelectedFile(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Document upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docItem: DocumentRecord) => {
    if (!activeCompanyId || !canDelete) return;
    try {
      await softDeleteTenantDoc(activeCompanyId, 'documents', docItem.id, docItem.title);
      showToast('Document archived from vault.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to archive document.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Documents & Compliance Vault
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tenant-isolated storage for RERA certificates, booking receipts, floor plans & agreement templates (max 10 MB PDF/Image).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by document title or filename..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as 'all' | DocCategory);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort documents"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'size')}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="title">Sort: Title (A–Z)</option>
          <option value="size">Sort: File Size</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading document vault...</div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center">
            <FolderLock className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No documents match your current filters
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Upload RERA certificates, model allotment letters, or unit floor plans to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.map((item) => {
                  const isImage = item.mimeType?.startsWith('image/');
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {isImage ? (
                            <ImageIcon className="h-4 w-4 text-sky-600 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {CATEGORY_LABELS[item.category]}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 truncate max-w-[220px]">
                        {item.fileName}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {formatFileSize(item.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {item.fileUrl && (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open
                            </a>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              aria-label={`Archive ${item.title}`}
                              className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {totalPages} ({filtered.length} files)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Upload Vault Document</h2>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MahaRERA Certificate Tower B"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Select PDF or Image (max 10 MB)</label>
                <input
                  type="file"
                  required
                  accept="image/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Securely'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
