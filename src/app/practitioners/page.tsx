"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import type { Practitioner } from "@/types/database";

export default function PractitionersPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Practitioner | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", document: "", email: "", phone: "", role: "practicante", study: "", hire_date: new Date().toISOString().split("T")[0], status: "active" as "active" | "inactive" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const snap = await getDocs(query(collection(getFirebaseDb(), "practitioners"), orderBy("first_name")));
    setPractitioners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner)));
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm({ first_name: "", last_name: "", document: "", email: "", phone: "", role: "practicante", study: "", hire_date: new Date().toISOString().split("T")[0], status: "active" }); setShowModal(true); }
  function openEdit(p: Practitioner) { setEditing(p); setForm({ first_name: p.first_name, last_name: p.last_name, document: p.document || "", email: p.email || "", phone: p.phone || "", role: p.role, study: p.study || "", hire_date: p.hire_date, status: p.status }); setShowModal(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.document.trim()) { toast.error("Nombres, Apellidos y Documento son obligatorios"); return; }
      const dupSnap = await getDocs(query(collection(getFirebaseDb(), "practitioners"), where("document", "==", form.document.trim())));
      if (dupSnap.docs.find((d) => !editing || d.id !== editing.id)) { toast.error("Este documento ya esta registrado"); return; }
      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "practitioners", editing.id), { ...form, document: form.document.trim() });
        await logAction("update", "practitioners", editing.id, form);
        toast.success("Practicante actualizado");
      } else {
        await addDoc(collection(getFirebaseDb(), "practitioners"), { ...form, document: form.document.trim(), created_at: new Date().toISOString() });
        await logAction("create", "practitioners", null, form);
        toast.success("Practicante registrado");
      }
      setShowModal(false); loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "practitioners", id)); await logAction("delete", "practitioners", id, null);
      toast.success("Practicante eliminado"); setDeleteConfirm(null); loadData();
    } catch { toast.error("Error al eliminar"); }
  }

  const filtered = practitioners.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingSpinner label="Cargando practicantes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><BriefcaseIcon className="w-6 h-6 text-white" /></div><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Practicantes</h1><p className="text-sm text-gray-500 dark:text-gray-400">{practitioners.length} registros</p></div></div>
        <button onClick={openCreate} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" />Registrar Practicante</button>
      </div>
      <div className="relative"><MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="text" placeholder="Buscar por nombre..." aria-label="Buscar practicantes por nombre" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" /></div>
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold shadow-sm">{p.first_name.charAt(0)}{p.last_name.charAt(0)}</div><div><h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{p.first_name} {p.last_name}</h3><p className="text-[12px] text-gray-500 dark:text-gray-400">{p.email || "Sin email"}</p></div></div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEdit(p)} aria-label="Editar practicante" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"><PencilIcon className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(p.id)} aria-label="Eliminar practicante" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="w-4 h-4" /></button></div>
              </div>
              <div className="space-y-2"><div className="flex items-center gap-2 text-[13px]"><span className="text-gray-500 dark:text-gray-400">Documento:</span><span className="font-medium text-gray-900 dark:text-white">{p.document || "Sin documento"}</span></div><div className="flex items-center gap-2 text-[13px]"><span className="text-gray-500 dark:text-gray-400">Estudio:</span><span className="font-medium text-gray-900 dark:text-white">{p.study || "Sin especificar"}</span></div></div>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${p.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}><span className={`w-2 h-2 rounded-full ${p.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />{p.status === "active" ? "Activo" : "Inactivo"}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" /><p className="text-gray-700 dark:text-gray-300 font-medium">No se encontraron practicantes</p><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{search ? "Intenta con otro termino de busqueda" : "Comienza registrando un practicante nuevo"}</p></div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Practicante" : "Registrar Practicante"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input label="Nombres" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /><Input label="Apellidos" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} required /><Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Telefono" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input label="Estudio / Carrera" value={form.study} onChange={(e) => setForm({ ...form, study: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4"><Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={[{ value: "practicante", label: "Practicante" }, { value: "auxiliar", label: "Auxiliar" }]} /><Input label="Fecha de inicio" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
          <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} options={[{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]} />
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">{editing ? "Actualizar" : "Registrar"}</button></div>
        </form>
      </Modal>
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminacion"><p className="text-gray-600 dark:text-gray-300">Estas seguro de eliminar este practicante?</p><div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md">Eliminar</button></div></Modal>
    </div>
  );
}