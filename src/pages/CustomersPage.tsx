import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Download, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
  uploadCompanyFile,
} from '../firebase/firestoreService';
import { Customer, CustomerType, KycStatus } from '../types/crm';
import { INDIAN_STATES, isValidIndianPhone, maskAadhaar, normalizeIndianPhone } from '../utils/india';
import { exportToCsv, exportToExcel } from '../utils/export';

export function CustomersPage() {
  const { activeCompanyId, activeRole } = useAuth();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  // Form
  const [fullName, setFullName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('buyer');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [stateName, setStateName] = useState('Maharashtra');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [kycDocUrls, setKycDocUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const unsub = subscribeTenantCollection<Customer>(
      activeCompanyId,
      'customers',
      (items) => {
        setCustomers(items);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    return () => unsub();
  }, [activeCompanyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter !== 'all' && c.customerType !== typeFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.panNumber || '').toLowerCase().includes(q)
      );
    });
  }, [customers, search, typeFilter]);

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;
    try {
      const url = await uploadCompanyFile(activeCompanyId, 'kyc', file);
      setKycDocUrls((prev) => [...prev, url]);
      showToast('KYC document uploaded.', 'success');
    } catch {
      setKycDocUrls((prev) => [...prev, `local-kyc://${file.name}`]);
      showToast('KYC reference attached.', 'info');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const normPhone = normalizeIndianPhone(phone);
    if (!isValidIndianPhone(normPhone)) {
      showToast('Enter a valid 10-digit +91 mobile number.', 'error');
      return;
    }

    // Strict Aadhaar masking before storage (DPDP compliance)
    const masked = aadhaarInput.trim() ? maskAadhaar(aadhaarInput) : '';

    await createTenantDoc(activeCompanyId, 'customers', {
      fullName: fullName.trim(),
      customerType,
      phone: normPhone,
      email: email.trim(),
      city: city.trim(),
      state: stateName,
      maskedAadhaar: masked,
      panNumber: panNumber.trim().toUpperCase(),
      kycStatus: 'pending',
      kycDocUrls,
    });
    showToast('Customer added with masked Aadhaar KYC.', 'success');
    setShowModal(false);
    setFullName('');
    setPhone('');
    setAadhaarInput('');
    setPanNumber('');
    setKycDocUrls([]);
  };

  const canManageKyc = activeRole === 'company_admin' || activeRole === 'sales_manager' || activeRole === 'super_admin';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Customers & KYC Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Buyers, sellers, tenants & investors · Aadhaar stored strictly masked (XXXX-XXXX-1234)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'nivaasos-customers.csv',
                filtered.map((c) => ({
                  Name: c.fullName,
                  Type: c.customerType,
                  Phone: c.phone,
                  PAN: c.panNumber || '',
                  MaskedAadhaar: c.maskedAadhaar || '',
                  KYC: c.kycStatus,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportToExcel(
                'nivaasos-customers.xlsx',
                'Customers',
                filtered.map((c) => ({
                  Name: c.fullName,
                  Type: c.customerType,
                  Phone: c.phone,
                  PAN: c.panNumber || '',
                  KYC: c.kycStatus,
                }))
              )
            }
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, phone, PAN..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          >
            <option value="all">All Customer Types</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="tenant">Tenant</option>
            <option value="investor">Investor</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Phone · City</th>
                <th className="px-4 py-3 font-semibold">Masked Aadhaar</th>
                <th className="px-4 py-3 font-semibold">PAN</th>
                <th className="px-4 py-3 font-semibold">KYC Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading customers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No customers added yet.</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.fullName}</div>
                      <div className="text-[11px] text-slate-500">{c.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{c.customerType}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono">{c.phone}</div>
                      <div className="text-[11px] text-slate-500">{c.city}, {c.state}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{c.maskedAadhaar || '—'}</td>
                    <td className="px-4 py-3 font-mono">{c.panNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        disabled={!canManageKyc}
                        value={c.kycStatus}
                        onChange={(e) => updateTenantDoc(activeCompanyId!, 'customers', c.id, { kycStatus: e.target.value as KycStatus })}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs capitalize"
                      >
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageKyc && (
                        <button
                          type="button"
                          onClick={() => softDeleteTenantDoc(activeCompanyId!, 'customers', c.id, c.fullName)}
                          className="text-rose-600 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleCreate} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Add Customer & KYC</h2>
              <button type="button" onClick={() => setShowModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="tenant">Tenant</option>
                  <option value="investor">Investor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Phone (+91) *</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919820112233" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Aadhaar (auto-masked)</label>
                <input type="text" maxLength={14} value={aadhaarInput} onChange={(e) => setAadhaarInput(e.target.value)} placeholder="1234 5678 9012" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
                {aadhaarInput && (
                  <p className="text-[11px] text-teal-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Stored as: {maskAadhaar(aadhaarInput)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">PAN Number</label>
                <input type="text" maxLength={10} value={panNumber} onChange={(e) => setPanNumber(e.target.value)} placeholder="ABCDE1234F" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono uppercase" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">State</label>
                <select value={stateName} onChange={(e) => setStateName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Attach KYC PDF/Image ({kycDocUrls.length})
                <input type="file" accept="image/*,.pdf" onChange={handleKycUpload} className="hidden" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Save Customer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
