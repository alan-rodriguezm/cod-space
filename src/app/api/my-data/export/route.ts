import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/my-data/export
 * Derecho de Portabilidad — Ley 21.719 Art. 16 letra d)
 * Permite al titular descargar todos sus datos personales en formato JSON.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "No autenticado. Inicia sesión para exportar tus datos." },
      { status: 401 }
    );
  }

  const userId = authData.user.id;

  // Recopilar todos los datos personales del usuario
  const [profileResult, ordersResult, quotesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, rut, address_street, address_city, address_region, address_zip, privacy_accepted_at, created_at, updated_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("orders")
      .select("id, status, total, payment_method, delivery_method, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, name, email, phone, message, status, items, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const exportData = {
    exportado_en: new Date().toISOString(),
    ley_aplicable: "Ley N° 21.719 — Protección de Datos Personales, Chile",
    responsable_del_tratamiento: "Spartaco Repuestos",
    titular: {
      id: userId,
      email: authData.user.email,
      fecha_registro: authData.user.created_at,
    },
    perfil: profileResult.data ?? null,
    pedidos: ordersResult.data ?? [],
    cotizaciones: quotesResult.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mis-datos-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
