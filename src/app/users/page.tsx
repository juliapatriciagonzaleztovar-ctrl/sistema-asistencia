"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { PlusIcon, PencilIcon, TrashIcon, KeyIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { Profile } from "@/types/database";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "operator" as "super_admin" | "operator" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const snap = await getDocs(collection(getFirebaseDb(), "profiles"));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Profile)));
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm({ email: "", password: "", display_name: "", role: "operator" }); setShowModal(true); }
  function openEdit(u: Profile) { setEditing(u); setForm({ email: u.email, password: "", display_name: u.display_name, role: u.role }); setShowModal(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "profiles", editing.id), { display_name: form.display_name, role: form.role });
        await logAction("update", "profiles", editing.id, { display_name: form.display_name, role: form.role });
        toast.success("Usuario actualizado");
      } else {
        const idToken = await user?.getIdToken();
        if (!idToken) { toast.error("Sesion no valida"); return; }
        const res = await fetch("/api/users/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ email: form.email, password: form.password, display_name: form.display_name, role: form.role }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Error al crear usuario"); return; }
        await logAction("create", "profiles", null, { email: form.email, role: form.role });
        toast.success("Usuario creado");
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "profiles", id));
      await logAction("delete", "profiles", id, null);
      toast.success("Usuario eliminado");
      setDeleteConfirm(null);
      loadData();
    } catch { toast.error("Error al eliminar usuario"); }
  }

  async function handleResetPassword() {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), resetEmail);
      toast.success("Correo de restablecimiento enviado");
      setShowResetModal(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al restablecer"); }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cargando usuarios...</span></div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ShieldCheckIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Usuarios</h1><p className="text-sm text-gray-500 dark:text-gray-400">{users.length} usuarios registrados</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setResetEmail(""); setShowResetModal(true); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2"><KeyIcon className="w-4 h-4" /> Restablecer Contrasena</button>
          <button onClick={openCreate} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Crear Usuario</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800"><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Nombre</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Correo</th><th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Rol</th><th className="text-right px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Acciones</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">{u.display_name}</td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === "super_admin" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{u.role === "super_admin" ? "Super Admin" : "Operador"}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirm(u.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Usuario" : "Crear Usuario"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre completo" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
          {!editing && (<><Input label="Correo electronico" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><Input label="Contrasena" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></>)}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "super_admin" | "operator" })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
              <option value="operator">Operador</option>
              <option value="super_admin">Super Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>

      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Restablecer Contrasena">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Se enviara un correo al usuario para restablecer su contrasena.</p>
          <Input label="Correo electronico" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowResetModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button onClick={handleResetPassword} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">Enviar</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminacion">
        <p className="text-gray-600 dark:text-gray-300">Estas seguro de eliminar este usuario?</p>
        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md">Eliminar</button></div>
      </Modal>
    </div>
  );
}
