"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import type { Teacher } from "@/types/database";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", document: "", email: "", phone: "", role: "profesor", hire_date: new Date().toISOString().split("T")[0], status: "active" as "active" | "inactive" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const snap = await getDocs(query(collection(getFirebaseDb(), "teachers"), orderBy("first_name")));
    setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)));
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ first_name: "", last_name: "", document: "", email: "", phone: "", role: "profesor", hire_date: new Date().toISOString().split("T")[0], status: "active" });
    setShowModal(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setForm({ first_name: t.first_name, last_name: t.last_name, document: t.document || "", email: t.email || "", phone: t.phone || "", role: t.role, hire_date: t.hire_date, status: t.status });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.document.trim()) {
        toast.error("Nombres, Apellidos y Documento son obligatorios");
        return;
      }
      const dupSnap = await getDocs(query(collection(getFirebaseDb(), "teachers"), where("document", "==", form.document.trim())));
      const dup = dupSnap.docs.find((d) => !editing || d.id !== editing.id);
      if (dup) { toast.error("Este documento ya esta registrado"); return; }
      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "teachers", editing.id), { ...form, document: form.document.trim() });
        await logAction("update", "teachers", editing.id, form);
        toast.success("Profesor actualizado");
      } else {
        await addDoc(collection(getFirebaseDb(), "teachers"), { ...form, document: form.document.trim(), created_at: new Date().toISOString() });
        await logAction("create", "teachers", null, form);
        toast.success("Profesor registrado");
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "teachers", id));
      await logAction("delete", "teachers", id, null);
      toast.success("Profesor eliminado");
      setDeleteConfirm(null);
      loadData();
    } catch { toast.error("Error al eliminar"); }
  }

  const filtered = teachers.filter((t) => `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cargando profesores...</span></div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-success flex items-center justify-center shadow-md"><AcademicCapIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Profesores</h1><p className="text-sm text-gray-500 dark:text-gray-400">{teachers.length} registros</p></div>
        </div>
        <button onClick={openCreate} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Registrar Profesor</button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-success flex items-center justify-center text-white text-sm font-bold shadow-sm">{t.first_name.charAt(0)}{t.last_name.charAt(0)}</div>
                  <div><h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{t.first_name} {t.last_name}</h3><p className="text-[12px] text-gray-500 dark:text-gray-400">{t.role}</p></div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"><PencilIcon className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(t.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px]"><span className="text-gray-500 dark:text-gray-400">Correo:</span><span className="font-medium text-gray-900 dark:text-white truncate">{t.email || "Sin correo"}</span></div>
                <div className="flex items-center gap-2 text-[13px]"><span className="text-gray-500 dark:text-gray-400">Telefono:</span><span className="font-medium text-gray-900 dark:text-white">{t.phone || "Sin telefono"}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${t.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}><span className={`w-2 h-2 rounded-full ${t.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />{t.status === "active" ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><AcademicCapIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" /><p className="text-gray-700 dark:text-gray-300 font-medium">No se encontraron profesores</p><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{search ? "Intenta con otro termino" : "Registra el primer profesor"}</p></div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Profesor" : "Registrar Profesor"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input label="Nombres *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /><Input label="Apellidos *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Documento *" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} required /><Input label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input label="Cargo" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha de ingreso" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
            <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Estado</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">{editing ? "Actualizar" : "Registrar"}</button></div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminacion">
        <p className="text-gray-600 dark:text-gray-300">Estas seguro de eliminar este profesor?</p>
        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md">Eliminar</button></div>
      </Modal>
    </div>
  );
}
