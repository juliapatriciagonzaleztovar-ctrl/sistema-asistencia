"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { exportToExcel } from "@/lib/export";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { Cog6ToothIcon, DocumentArrowDownIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { Child, Group } from "@/types/database";

interface Setting { id: string; setting_key: string; setting_value: string | null; }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [downloadGroup, setDownloadGroup] = useState("all");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const [settingsSnap, groupsSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "system_settings"), orderBy("setting_key"))),
      getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name"))),
    ]);
    const data = settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Setting));
    setSettings(data);
    setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    const formMap: Record<string, string> = {};
    data.forEach((s) => { formMap[s.setting_key] = s.setting_value || ""; });
    setForm(formMap);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = settings.find((s) => s.setting_key === key);
        if (existing) { await updateDoc(doc(getFirebaseDb(), "system_settings", existing.id), { setting_value: value }); }
        else { await addDoc(collection(getFirebaseDb(), "system_settings"), { setting_key: key, setting_value: value }); }
      }
      await logAction("update", "system_settings", null, form);
      toast.success("Configuracion guardada");
      loadSettings();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
    setSaving(false);
  }

  async function handleDownloadChildren() {
    setDownloading(true);
    try {
      const q = downloadGroup === "all"
        ? query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))
        : query(collection(getFirebaseDb(), "children"), where("status", "==", "active"), where("group_id", "==", downloadGroup));
      const snap = await getDocs(q);
      const children = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));

      if (children.length === 0) {
        toast.error("No hay ninos para descargar");
        setDownloading(false);
        return;
      }

      const groupName = downloadGroup === "all" ? "Todos" : groups.find((g) => g.id === downloadGroup)?.name || "Sin grupo";

      exportToExcel(
        children.map((c) => ({
          "ID": c.child_id_code || "",
          "Nombre Completo": `${c.first_name} ${c.last_name}`,
          "Edad": c.age || "",
          "Grupo": groups.find((g) => g.id === c.group_id)?.name || "Sin grupo",
        })),
        `lista_ninos_${groupName.replace(/\s+/g, "_")}`
      );

      toast.success(`Lista de ${children.length} ninos descargada`);
      await logAction("export", "children", null, { group: groupName, count: children.length });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar");
    }
    setDownloading(false);
  }

  if (loading) return <LoadingSpinner label="Cargando configuracion..." />;

  const settingFields = [
    { key: "institution_name", label: "Nombre de la institucion", placeholder: "Ej: Instituto Infantil ABC" },
    { key: "institution_address", label: "Direccion", placeholder: "Ej: Calle 123 #456-789" },
    { key: "institution_phone", label: "Telefono", placeholder: "Ej: (601) 123-4567" },
    { key: "morning_start", label: "Hora inicio jornada manana", placeholder: "Ej: 07:00" },
    { key: "morning_end", label: "Hora fin jornada manana", placeholder: "Ej: 12:00" },
    { key: "afternoon_start", label: "Hora inicio jornada tarde", placeholder: "Ej: 13:00" },
    { key: "afternoon_end", label: "Hora fin jornada tarde", placeholder: "Ej: 17:00" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><Cog6ToothIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Configuracion</h1><p className="text-sm text-gray-500 dark:text-gray-400">Ajustes generales del sistema</p></div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><Cog6ToothIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Informacion General</h3>
        </div>
        <div className="space-y-4">
          {settingFields.map((s) => (
            <Input key={s.key} label={s.label} value={form[s.key] || ""} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} placeholder={s.placeholder} />
          ))}
        </div>
        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {saving ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>) : "Guardar Configuracion"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-success flex items-center justify-center"><DocumentArrowDownIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Descargar Lista de Ninos</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Descarga la lista de ninos registrados en formato Excel con su ID, nombre completo y edad.</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="download-group" className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Grupo</label>
            <select id="download-group" value={downloadGroup} onChange={(e) => setDownloadGroup(e.target.value)} aria-label="Filtrar grupo para descarga" className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
              <option value="all">Todos los grupos</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button onClick={handleDownloadChildren} disabled={downloading} className="px-5 py-2.5 gradient-success text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {downloading ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Descargando...</>) : (<><DocumentArrowDownIcon className="w-4 h-4" /> Descargar Excel</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
