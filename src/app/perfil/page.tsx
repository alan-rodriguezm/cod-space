"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/user-context";
import { regions } from "@/lib/chilean-regions";
import { validateChileanRut, formatRut } from "@/lib/rut";
import { toast } from "sonner";
import { User as UserIcon, MapPin, Shield, CheckCircle, AlertCircle, Lock, Download, Trash2 } from "lucide-react";

export default function PerfilPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    rut: "",
    address_street: "",
    address_city: "",
    address_region: "",
    address_zip: "",
  });
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [rutError, setRutError] = useState<string | null>(null);
  const [rutTouched, setRutTouched] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/perfil");
      return;
    }

    async function fetchProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, rut, address_street, address_city, address_region, address_zip, privacy_accepted_at")
        .eq("id", user!.id)
        .single();

      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          rut: data.rut ?? "",
          address_street: data.address_street ?? "",
          address_city: data.address_city ?? "",
          address_region: data.address_region ?? "",
          address_zip: data.address_zip ?? "",
        });
        setPrivacyAcceptedAt(data.privacy_accepted_at);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [user, userLoading, router, supabase]);

  function handleRutChange(value: string) {
    const digits = value.replace(/[^0-9Kk]/g, "").toUpperCase();
    setForm((prev) => ({ ...prev, rut: digits }));
    if (rutTouched) {
      setRutError(validateChileanRut(digits));
    }
  }

  function handleRutBlur() {
    setRutTouched(true);
    const error = validateChileanRut(form.rut);
    setRutError(error);
    if (!error && form.rut) {
      setForm((prev) => ({ ...prev, rut: formatRut(form.rut) }));
    }
  }

  function handleZipChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 7);
    setForm((prev) => ({ ...prev, address_zip: digits }));
  }

  const availableCities = regions.find((r) => r.name === form.address_region)?.cities ?? [];

  const privacyAccepted = !!privacyAcceptedAt;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!privacyAccepted) {
      toast.error("Debes aceptar la política de privacidad para continuar.");
      return;
    }

    const rutErr = validateChileanRut(form.rut);
    if (form.rut && rutErr) {
      setRutTouched(true);
      setRutError(rutErr);
      toast.error("Corrige el RUT antes de guardar.");
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        updateData[key] = value || null;
      }
      if (!privacyAcceptedAt) {
        updateData.privacy_accepted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      console.error("Error al guardar perfil:", e.message, e.code, e.details, e.hint);
      toast.error("Error al guardar el perfil. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Cargando perfil...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Mi Perfil</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserIcon className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Datos Personales</h2>
            </div>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" value={user.email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="Juan Pérez"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+56 9 1234 5678"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rut">RUT</Label>
                <Input
                  id="rut"
                  name="rut"
                  placeholder="12.345.678-9"
                  value={form.rut}
                  onChange={(e) => handleRutChange(e.target.value)}
                  onBlur={handleRutBlur}
                  inputMode="text"
                  aria-invalid={rutTouched && !!rutError}
                  aria-describedby={rutError ? "rut-error" : undefined}
                />
                {rutTouched && rutError && (
                  <p id="rut-error" className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {rutError}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Dirección de Envío</h2>
            </div>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="address_street">Calle y número</Label>
              <Input
                id="address_street"
                name="address_street"
                placeholder="Av. Libertador 1234, Depto 56"
                value={form.address_street}
                onChange={(e) => setForm((prev) => ({ ...prev, address_street: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_region">Región</Label>
                <Select
                  value={form.address_region}
                  onValueChange={(val) => {
                    const region = val ?? "";
                    setForm((prev) => ({
                      ...prev,
                      address_region: region,
                      address_city: region !== prev.address_region ? "" : prev.address_city,
                    }));
                  }}
                >
                  <SelectTrigger id="address_region" className="w-full">
                    <SelectValue placeholder="Seleccionar región" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_city">Ciudad</Label>
                <Select
                  value={form.address_city}
                  onValueChange={(val) => {
                    setForm((prev) => ({ ...prev, address_city: val ?? "" }));
                  }}
                  disabled={!form.address_region}
                >
                  <SelectTrigger id="address_city" className="w-full">
                    <SelectValue placeholder={form.address_region ? "Seleccionar ciudad" : "Elige región primero"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="w-1/2">
              <div className="space-y-2">
                <Label htmlFor="address_zip">Código postal</Label>
                <Input
                  id="address_zip"
                  name="address_zip"
                  placeholder="8320000"
                  value={form.address_zip}
                  onChange={(e) => handleZipChange(e.target.value)}
                  inputMode="numeric"
                  maxLength={7}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Privacidad</h2>
            </div>
            <Separator />

            {privacyAccepted ? (
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Privacidad aceptada
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aceptaste la{" "}
                    <Link href="/privacidad" className="text-primary underline hover:no-underline" target="_blank">
                      Política de Privacidad
                    </Link>{" "}
                    el{" "}
                    {new Date(privacyAcceptedAt).toLocaleDateString("es-CL", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    .
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para continuar, debes aceptar nuestra política de privacidad y tratamiento de datos personales.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPrivacyAcceptedAt(new Date().toISOString());
                      } else {
                        setPrivacyAcceptedAt(null);
                      }
                    }}
                  />
                  <span className="text-sm leading-relaxed">
                    He leído y acepto la{" "}
                    <Link href="/privacidad" className="text-primary underline hover:no-underline" target="_blank">
                      Política de Privacidad y Tratamiento de Datos Personales
                    </Link>
                    .
                  </span>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Guardando..." : "Guardar Perfil"}
        </Button>
      </form>

      {/* ── Sección ARCOP — Ley 21.719 ── */}
      <Card className="mt-6 border-muted">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Mis Datos y Privacidad</h2>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            De acuerdo con la{" "}
            <Link href="/privacidad" className="text-primary underline hover:no-underline" target="_blank">
              Ley N° 21.719
            </Link>
            {" "}tienes derecho a acceder, rectificar, suprimir y portar tus datos personales.
          </p>

          {/* Portabilidad */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const res = await fetch("/api/my-data/export");
                  if (!res.ok) throw new Error("Error al exportar");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `mis-datos-${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Datos exportados correctamente.");
                } catch {
                  toast.error("No se pudo exportar tus datos. Intenta nuevamente.");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Preparando..." : "Descargar mis datos"}
            </Button>
          </div>

          {/* Supresión */}
          <Separator />
          {!deleteConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                También puedes solicitar la eliminación de tu cuenta y todos tus datos personales.
                Esta acción es irreversible.
              </p>
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar mi cuenta
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-destructive">
                ¿Estás seguro? Esta acción eliminará permanentemente tu perfil, pedidos y datos
                personales. Las cotizaciones quedarán anonimizadas por obligación legal.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  className="cursor-pointer"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const res = await fetch("/api/my-data/delete", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ confirmar: "ELIMINAR MI CUENTA" }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Error al eliminar");
                      }
                      toast.success("Tu cuenta ha sido eliminada.");
                      router.push("/");
                    } catch (err) {
                      const e = err as { message?: string };
                      toast.error(e.message || "Error al eliminar la cuenta.");
                      setDeleting(false);
                      setDeleteConfirm(false);
                    }
                  }}
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar definitivamente"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
