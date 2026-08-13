"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PhotoUpload, AvatarFallback } from "@/components/ui/PhotoUpload";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { Child, Group } from "@/types/database";

export default function ChildrenPage() {
  const [children, setChildren] = useState<(Child & { group: Group | null })[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", document: "", age: "", group_id: "", shift: "manana", status: "active" as "active" | "inactive", observations: "", photo_url: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const nextChildCode = useMemo(() => {
    if (children.length === 0) return "CT001";
    const maxNum = children.reduce((max, c) => {
      const match = c.child_id_code?.match(/^CT(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `CT${String(maxNum + 1).padStart(3, "0")}`;
  }, [children]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [childrenSnap, groupsSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "children"), orderBy("first_name"))),
      getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name"))),
    ]);
    const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(groupsList);
    setChildren(childrenSnap.docs.map((d) => {
      const childData = { id: d.id, ...d.data() } as Child;
      return { ...childData, group: groupsList.find((g) => g.id === childData.group_id) || null };
    }));
    setLoading(false);
  }

  function openCreate() {
    setEditingChild(null);
    setForm({ first_name: "", last_name: "", document: "", age: "", group_id: "", shift: "manana", status: "active", observations: "", photo_url: "" });
    setShowModal(true);
  }

  function openEdit(child: Child) {
    setEditingChild(child);
    setForm({
      first_name: child.first_name, last_name: child.last_name, document: child.document || "",
      age: child.age ? String(child.age) : "", group_id: child.group_id || "", shift: child.shift,
      status: child.status, observations: child.observations || "", photo_url: child.photo_url || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Nombres y Apellidos son obligatorios");
      return;
    }
    const payload = { ...form, age: form.age ? Number(form.age) : null, group_id: form.group_id || null, photo_url: form.photo_url || null };
    try {
      if (editingChild) {
        await updateDoc(doc(getFirebaseDb(), "children", editingChild.id), payload);
        await logAction("update", "children", editingChild.id, payload);
        toast.success("Nino actualizado");
      } else {
        await addDoc(collection(getFirebaseDb(), "children"), {
          ...payload,
          child_id_code: nextChildCode,
          created_at: new Date().toISOString(),
        });
        await logAction("create", "children", null, { ...payload, child_id_code: nextChildCode });
        toast.success(`Nino registrado con ID ${nextChildCode}`);
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "children", id));
      await logAction("delete", "children", id, null);
      toast.success("Nino eliminado");
      setDeleteConfirm(null);
      loadData();
    } catch { toast.error("Error al eliminar"); }
  }

  const filtered = children.filter((c) => {
    const term = search.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const code = c.child_id_code?.toLowerCase() || "";
    return fullName.includes(term) || code.includes(term);
  });

  if (loading) return <LoadingSpinner label="Cargando ninos..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><UserGroupIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Ninos</h1><p className="text-sm text-gray-500 dark:text-gray-400">{children.length} registros activos</p></div>
        </div>
        <button onClick={openCreate} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" />Registrar Nino</button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input type="text" placeholder="Buscar por nombre o ID (CT001...)..." aria-label="Buscar ninos" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((child) => (
            <div key={child.id} className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                {child.photo_url ? (
                  <img src={child.photo_url} alt={`${child.first_name} ${child.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback name={`${child.first_name} ${child.last_name}`} size="lg" />
                )}
                {child.child_id_code && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 dark:bg-gray-900/90 text-primary shadow-sm">{child.child_id_code}</span>
                )}
                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(child)} aria-label="Editar nino" className="w-7 h-7 rounded-lg bg-white/90 dark:bg-gray-900/90 flex items-center justify-center text-gray-600 hover:text-primary shadow-sm transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteConfirm(child.id)} aria-label="Eliminar nino" className="w-7 h-7 rounded-lg bg-white/90 dark:bg-gray-900/90 flex items-center justify-center text-gray-600 hover:text-red-500 shadow-sm transition-colors"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{child.first_name} {child.last_name}</h3>
                <p className="text-[11px] text-gray-400 mt-1">{child.age} anos · {child.shift === "completa" ? "J. Completa" : child.shift === "manana" ? "Manana" : "Tarde"}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {child.group?.name && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary">{child.group.name}</span>}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${child.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{child.status === "active" ? "Activo" : "Inactivo"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">No se encontraron ninos</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{search ? "Intenta con otro termino de busqueda" : "Comienza registrando un nino nuevo"}</p>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingChild ? "Editar Nino" : "Registrar Nino"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <PhotoUpload
              currentPhoto={form.photo_url || null}
              onPhotoUploaded={(url) => setForm({ ...form, photo_url: url })}
              onPhotoRemoved={() => setForm({ ...form, photo_url: "" })}
              collection="children"
              entityId={editingChild?.id || "new"}
              size="lg"
            />
            <p className="text-xs text-gray-400">Foto opcional (max 5MB)</p>
          </div>
          {!editingChild && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">ID del Nino:</span>
              <span className="px-3 py-1 rounded-lg bg-primary text-white text-sm font-bold">{nextChildCode}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombres" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required placeholder="Ej: Juan" />
            <Input label="Apellidos" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required placeholder="Ej: Perez" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="Ej: 1234567890" />
            <Input label="Edad" type="number" min="0" max="18" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Ej: 5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Grupo" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} options={[{ value: "", label: "Sin grupo" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
            <Select label="Jornada" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} options={[{ value: "manana", label: "Manana" }, { value: "tarde", label: "Tarde" }, { value: "completa", label: "Jornada Completa" }]} />
          </div>
          <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} options={[{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]} />
          <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Observaciones</label><textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" placeholder="Notas adicionales..." /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">{editingChild ? "Actualizar" : "Registrar"}</button></div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminacion">
        <p className="text-gray-600 dark:text-gray-300">Estas seguro de eliminar este nino? Esta accion no se puede deshacer.</p>
        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md">Eliminar</button></div>
      </Modal>
    </div>
  );
}
