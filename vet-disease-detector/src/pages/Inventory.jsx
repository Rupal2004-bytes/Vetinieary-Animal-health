import React, { useState, useEffect } from 'react';
import { getInventory, upsertInventory, updateInventory, deleteInventory } from '../api/client.js';

export default function Inventory({ user, setActivePage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDistrict, setFilterDistrict] = useState(user?.district || 'All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isStaff = user?.role === 'vet' || user?.role === 'ngo' || user?.role === 'gov';

  const [form, setForm] = useState({
    id: 0,
    item_name: '',
    category: 'vaccine',
    quantity: 100,
    unit: 'vials',
    min_threshold: 20,
    expiry_date: '',
    status: 'in_stock'
  });

  useEffect(() => {
    loadInventory();
  }, [filterDistrict, filterCategory]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await getInventory(filterDistrict === 'All' ? '' : filterDistrict);
      setItems(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      id: 0,
      item_name: '',
      category: 'vaccine',
      quantity: 100,
      unit: 'vials',
      min_threshold: 20,
      expiry_date: '',
      status: 'in_stock'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      id: item.id || 0,
      item_name: item.item_name || '',
      category: item.category || 'vaccine',
      quantity: item.quantity || 0,
      unit: item.unit || 'vials',
      min_threshold: item.min_threshold || 20,
      expiry_date: item.expiry_date || '',
      status: item.status || 'in_stock'
    });
    setShowAddModal(true);
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to remove this stock record from the inventory?')) return;
    try {
      await deleteInventory(id);
      setItems(prev => prev.filter(it => it.id !== id));
      await loadInventory();
    } catch (err) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        id: form.id || 0,
        quantity: Number(form.quantity) || 0,
        min_threshold: Number(form.min_threshold) || 20,
        district: editingItem?.district || user?.district || 'Pune'
      };

      if (form.id > 0) {
        const res = await updateInventory(payload);
        setItems(prev => prev.map(it => it.id === form.id ? { ...it, ...payload, ...res } : it));
      } else {
        const res = await upsertInventory(payload);
        setItems(prev => [res, ...prev]);
      }

      setShowAddModal(false);
      setEditingItem(null);
      setForm({
        id: 0,
        item_name: '',
        category: 'vaccine',
        quantity: 100,
        unit: 'vials',
        min_threshold: 20,
        expiry_date: '',
        status: 'in_stock'
      });
      await loadInventory();
    } catch (err) {
      alert('Failed to save item: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => {
    if (filterCategory !== 'All' && i.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-teal-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-teal-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              📦 Essential Veterinary Supply Chain
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
            Medication, Vaccines & Tool Inventory
          </h1>
          <p className="text-xs text-teal-200 mt-1 max-w-2xl leading-relaxed">
            Real-time tracking and editing of vaccines (FMD, LSD, PPR, Rabies), broad-spectrum antibiotics, antiseptic wound care, and mobile clinic field kits across Maharashtra dispensaries.
          </p>
        </div>

        {isStaff && (
          <button
            onClick={handleOpenAdd}
            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>+</span> Add New Stock
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between text-xs">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="vaccine">Vaccines & Biologicals</option>
              <option value="antibiotic">Antibiotics & Antimicrobials</option>
              <option value="wound_care">Wound Sprays & Antiseptics</option>
              <option value="fluid">IV Fluids & Electrolytes</option>
              <option value="ppe_tool">Surgical Tools & PPE</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">District:</span>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none"
            >
              <option value="All">All Districts</option>
              <option value="Pune">Pune</option>
              <option value="Ahmednagar">Ahmednagar</option>
              <option value="Kolhapur">Kolhapur</option>
              <option value="Thane">Thane</option>
              <option value="Nagpur">Nagpur</option>
              <option value="Nashik">Nashik</option>
              <option value="Solapur">Solapur</option>
              <option value="Satara">Satara</option>
              <option value="Sangli">Sangli</option>
            </select>
          </div>
        </div>

        <span className="text-slate-400 font-semibold">{filteredItems.length} Monitored Items</span>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-[11px]">
                <th className="py-3.5 px-5">Medication / Tool Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Provider / Dispensary</th>
                <th className="py-3.5 px-4">District</th>
                <th className="py-3.5 px-4">Available Quantity</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4 text-center">Availability Status</th>
                {isStaff && <th className="py-3.5 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-5 font-bold text-slate-900">{item.item_name}</td>
                  <td className="py-4 px-4 text-slate-600 uppercase text-[10px] font-black">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">{item.category}</span>
                  </td>
                  <td className="py-4 px-4 text-slate-700 font-medium">{item.owner_name}</td>
                  <td className="py-4 px-4 text-slate-600 font-medium">📍 {item.district}</td>
                  <td className="py-4 px-4 font-black text-slate-900">{item.quantity} {item.unit}</td>
                  <td className="py-4 px-4 text-slate-500">{item.expiry_date || 'Standard Stock'}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                      item.status === 'in_stock'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'low_stock'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  {isStaff && (
                    <td className="py-3 px-4 text-right">
                      {(!item.user_id || item.user_id === user?.id) ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="bg-slate-100 hover:bg-teal-50 text-slate-800 hover:text-teal-800 font-bold px-3 py-1.5 rounded-lg mr-2 transition-colors border border-slate-200 hover:border-teal-300"
                            title="Edit stock quantity, threshold or status"
                          >
                            ✏️ Edit Stock
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete stock item"
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1">
                          <span>🔒</span> Managed by {item.owner_name || 'Other Provider'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Update Stock Modal for Clinic/NGO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {editingItem ? '✏️ Edit & Update Medical Supply' : '➕ Add New Medical Supply'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FMD Trivalent Oil Adjuvant Vaccine"
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="vaccine">Vaccine</option>
                    <option value="antibiotic">Antibiotic</option>
                    <option value="wound_care">Wound Spray</option>
                    <option value="fluid">IV Fluid</option>
                    <option value="ppe_tool">Tools / PPE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="vials / doses"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Min Alert</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="20"
                    value={form.min_threshold}
                    onChange={(e) => setForm({ ...form, min_threshold: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Adjustment Buttons when Editing */}
              {editingItem && (
                <div>
                  <label className="block font-bold text-slate-500 mb-1 text-[11px]">Quick Restock Adjustment:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, quantity: Number(form.quantity || 0) + 10 })}
                      className="bg-teal-50 text-teal-800 font-bold px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-100"
                    >
                      +10 Units
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, quantity: Number(form.quantity || 0) + 50 })}
                      className="bg-teal-50 text-teal-800 font-bold px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-100"
                    >
                      +50 Batch
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, quantity: Math.max(0, Number(form.quantity || 0) - 10) })}
                      className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-200"
                    >
                      -10 Dispensed
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors"
                >
                  {submitting ? 'Saving...' : editingItem ? 'Save Updates' : 'Add Stock Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
