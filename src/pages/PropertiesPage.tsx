import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Building2, Download, Upload, X, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
  createTenantDoc,
  softDeleteTenantDoc,
  subscribeTenantCollection,
  updateTenantDoc,
  uploadCompanyFile,
} from '../firebase/firestoreService';
import { Project, Property, PropertyStatus, PropertyType, TransactionType } from '../types/crm';
import { formatINR, formatINRCompact, INDIAN_STATES, sqFtToSqM } from '../utils/india';
import { exportToCsv, exportToExcel } from '../utils/export';

export function PropertiesPage() {
  const { activeCompanyId, activeRole, company } = useAuth();
  const { showToast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'properties' | 'projects'>('properties');
  const [areaUnit, setAreaUnit] = useState<'sqft' | 'sqm'>('sqft');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [showPropModal, setShowPropModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);

  // Property form
  const [title, setTitle] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('residential');
  const [transactionType, setTransactionType] = useState<TransactionType>('sale');
  const [priceInr, setPriceInr] = useState('18500000');
  const [areaSqFt, setAreaSqFt] = useState('1450');
  const [bhk, setBhk] = useState('3 BHK');
  const [reraId, setReraId] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [stateName, setStateName] = useState('Maharashtra');
  const [locality, setLocality] = useState('');
  const [floor, setFloor] = useState('8th Floor');
  const [facing, setFacing] = useState('East');
  const [amenitiesStr, setAmenitiesStr] = useState('Clubhouse, EV Charging, Security');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Project form
  const [projName, setProjName] = useState('');
  const [projRera, setProjRera] = useState('');
  const [projCity, setProjCity] = useState('Pune');
  const [projState, setProjState] = useState('Maharashtra');
  const [projLocality, setProjLocality] = useState('');
  const [projUnits, setProjUnits] = useState('120');
  const [projPossession, setProjPossession] = useState('Dec 2027');

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    const u1 = subscribeTenantCollection<Property>(
      activeCompanyId,
      'properties',
      (items) => {
        setProperties(items);
        setLoading(false);
      },
      [],
      () => setLoading(false)
    );
    const u2 = subscribeTenantCollection<Project>(activeCompanyId, 'projects', setProjects, [], () => {});
    return () => {
      u1();
      u2();
    };
  }, [activeCompanyId]);

  const filteredProps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.propertyType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.locality || '').toLowerCase().includes(q) ||
        (p.reraId || '').toLowerCase().includes(q)
      );
    });
  }, [properties, search, statusFilter, typeFilter]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeCompanyId) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        try {
          const url = await uploadCompanyFile(activeCompanyId, 'properties', file);
          urls.push(url);
        } catch {
          urls.push('/src/assets/images/property_luxury_apartment_1795006021918.jpg');
        }
      }
      setImageUrls((prev) => [...prev, ...urls]);
      showToast(`${urls.length} image(s) attached.`, 'success');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (company && properties.length >= company.propertyLimit) {
      showToast(`Property limit (${company.propertyLimit}) reached on ${company.planId} plan. Upgrade in Billing.`, 'error');
      return;
    }

    await createTenantDoc(activeCompanyId, 'properties', {
      title: title.trim(),
      propertyType,
      transactionType,
      priceInr: Number(priceInr || 0),
      areaSqFt: Number(areaSqFt || 0),
      bhk: bhk.trim(),
      reraId: reraId.trim().toUpperCase(),
      city: city.trim(),
      state: stateName,
      locality: locality.trim(),
      floor: floor.trim(),
      facing: facing.trim(),
      status: 'available',
      amenities: amenitiesStr.split(',').map((s) => s.trim()).filter(Boolean),
      imageUrls: imageUrls.length > 0 ? imageUrls : ['/src/assets/images/property_luxury_apartment_1795006021918.jpg'],
    });
    showToast('Property added to inventory.', 'success');
    setShowPropModal(false);
    setTitle('');
    setImageUrls([]);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    const total = Number(projUnits || 60);
    await createTenantDoc(activeCompanyId, 'projects', {
      name: projName.trim(),
      developerName: company?.name || '',
      reraId: projRera.trim().toUpperCase(),
      city: projCity.trim(),
      state: projState,
      locality: projLocality.trim(),
      possessionDate: projPossession.trim(),
      totalUnits: total,
      towers: [
        { name: 'Tower A', floors: 15, unitsPerFloor: 4, availableUnits: Math.round(total * 0.6), bookedUnits: Math.round(total * 0.4) },
      ],
    });
    showToast('Builder project created.', 'success');
    setShowProjModal(false);
    setProjName('');
  };

  const canManage = activeRole === 'company_admin' || activeRole === 'sales_manager' || activeRole === 'super_admin';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Properties & Builder Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            RERA-tagged listings · INR Lakh/Cr formatting · {properties.length}/{company?.propertyLimit || '∞'} quota used
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAreaUnit((u) => (u === 'sqft' ? 'sqm' : 'sqft'))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            Unit: {areaUnit === 'sqft' ? 'sq ft' : 'sq m'}
          </button>
          <button
            type="button"
            onClick={() => {
              const rows = filteredProps.map((p) => ({
                Title: p.title,
                Type: p.propertyType,
                Transaction: p.transactionType,
                PriceINR: p.priceInr,
                AreaSqFt: p.areaSqFt,
                RERA: p.reraId || '',
                City: p.city || '',
                Status: p.status,
              }));
              exportToCsv('nivaasos-properties.csv', rows);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const rows = filteredProps.map((p) => ({
                Title: p.title,
                Type: p.propertyType,
                PriceINR: p.priceInr,
                AreaSqFt: p.areaSqFt,
                Status: p.status,
              }));
              exportToExcel('nivaasos-properties.xlsx', 'Inventory', rows);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            Excel
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => (tab === 'properties' ? setShowPropModal(true) : setShowProjModal(true))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500"
            >
              <Plus className="h-4 w-4" />
              {tab === 'properties' ? 'Add Property' : 'Add Project'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('properties')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium ${
              tab === 'properties' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Listings ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('projects')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium ${
              tab === 'projects' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Projects & Towers ({projects.length})
          </button>
        </div>

        {tab === 'properties' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, locality, RERA..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="all">All Types</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="plot">Plot</option>
              <option value="villa">Villa</option>
              <option value="farmhouse">Farmhouse</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="hold">Hold</option>
              <option value="booked">Booked</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : tab === 'properties' ? (
        filteredProps.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
            <Building2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            No properties match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProps.map((prop) => (
              <div
                key={prop.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <img
                      src={prop.imageUrls?.[0] || '/src/assets/images/property_luxury_apartment_1795006021918.jpg'}
                      alt={prop.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {prop.propertyType} · {prop.transactionType} · {prop.bhk || 'Unit'}
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-1">
                      {prop.title}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      {prop.locality ? `${prop.locality}, ` : ''}{prop.city}, {prop.state}
                    </div>
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                          {formatINRCompact(prop.priceInr)}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {formatINR(prop.priceInr)}
                        </span>
                      </div>
                      <div className="text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                        {areaUnit === 'sqft'
                          ? `${prop.areaSqFt.toLocaleString('en-IN')} sq ft`
                          : `${sqFtToSqM(prop.areaSqFt)} sq m`}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                      <div>RERA: <span className="font-mono">{prop.reraId || 'Registered'}</span></div>
                      <div>{prop.floor || '—'} · Facing {prop.facing || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <select
                    disabled={!canManage}
                    value={prop.status}
                    onChange={(e) => updateTenantDoc(activeCompanyId!, 'properties', prop.id, { status: e.target.value as PropertyStatus })}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs capitalize font-medium"
                  >
                    <option value="available">Available</option>
                    <option value="hold">On Hold</option>
                    <option value="booked">Booked</option>
                    <option value="sold">Sold</option>
                  </select>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => softDeleteTenantDoc(activeCompanyId!, 'properties', prop.id, prop.title)}
                      className="text-rose-600 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
              No builder projects configured yet.
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <h3 className="font-display text-lg font-bold">{proj.name}</h3>
                    <div className="text-xs text-slate-500 mt-1">
                      {proj.locality}, {proj.city}, {proj.state} · Possession {proj.possessionDate} · RERA <span className="font-mono">{proj.reraId}</span>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold">{proj.totalUnits} Total Units</div>
                </div>

                {/* Tower Inventory Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(proj.towers || []).map((tower) => (
                    <div key={tower.name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between text-xs font-semibold mb-3">
                        <span>{tower.name}</span>
                        <span className="font-mono text-slate-500">
                          {tower.floors} Floors · {tower.availableUnits} Available / {tower.bookedUnits} Booked
                        </span>
                      </div>
                      <div className="grid grid-cols-8 gap-1.5">
                        {Array.from({ length: Math.min(24, tower.availableUnits + tower.bookedUnits) }).map((_, idx) => {
                          const isBooked = idx < Math.min(12, tower.bookedUnits);
                          return (
                            <div
                              key={idx}
                              title={isBooked ? 'Booked Unit' : 'Available Unit'}
                              className={`h-6 rounded text-[10px] font-mono flex items-center justify-center ${
                                isBooked
                                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  : 'bg-teal-600 text-white'
                              }`}
                            >
                              {101 + idx}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Property Modal */}
      {showPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateProperty}
            className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Add Property Listing</h2>
              <button type="button" onClick={() => setShowPropModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Property Title *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="3 BHK Sea View Residence - Unit 1204" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Property Type</label>
                <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="plot">Plot</option>
                  <option value="villa">Villa</option>
                  <option value="farmhouse">Farmhouse</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Transaction</label>
                <select value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                  <option value="lease">Lease</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Price (INR) *</label>
                <input type="number" required value={priceInr} onChange={(e) => setPriceInr(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Area (sq ft) *</label>
                <input type="number" required value={areaSqFt} onChange={(e) => setAreaSqFt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Config / BHK</label>
                <input type="text" value={bhk} onChange={(e) => setBhk(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Locality</label>
                <input type="text" value={locality} onChange={(e) => setLocality(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">RERA ID</label>
                <input type="text" value={reraId} onChange={(e) => setReraId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Floor</label>
                <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Facing</label>
                <input type="text" value={facing} onChange={(e) => setFacing(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Amenities (comma separated)</label>
              <input type="text" value={amenitiesStr} onChange={(e) => setAmenitiesStr(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Uploading...' : `Upload Images (${imageUrls.length} attached)`}
                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPropModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Save Property</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Project Modal */}
      {showProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={handleCreateProject} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Add Builder Project</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Project Name *</label>
              <input type="text" required value={projName} onChange={(e) => setProjName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">RERA Registration ID *</label>
              <input type="text" required value={projRera} onChange={(e) => setProjRera(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">City *</label>
                <input type="text" required value={projCity} onChange={(e) => setProjCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">State *</label>
                <select value={projState} onChange={(e) => setProjState(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                  {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Total Units</label>
                <input type="number" required value={projUnits} onChange={(e) => setProjUnits(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Possession</label>
                <input type="text" value={projPossession} onChange={(e) => setProjPossession(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Create Project</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
