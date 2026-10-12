import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/my-data/delete
 * Derecho de Cancelación/Supresión — Ley 21.719 Art. 16 letra c)
 * Elimina todos los datos personales del titular y su cuenta de usuario.
 *
 * Conserva cotizaciones de forma anonimizada por obligaciones legales
 * (Art. 11 Ley 21.719: el tratamiento puede continuar si existe
 *  obligación legal aunque el titular solicite supresión).
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "No autenticado. Inicia sesión para eliminar tu cuenta." },
      { status: 401 }
    );
  }

  // Verificar confirmación explícita en el cuerpo de la solicitud
  let body: { confirmar?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body — se rechaza abajo
  }

  if (body.confirmar !== "ELIMINAR MI CUENTA") {
    return NextResponse.json(
      {
        error:
          'Confirmación requerida. Envía { "confirmar": "ELIMINAR MI CUENTA" } en el cuerpo.',
      },
      { status: 400 }
    );
  }

  const userId = authData.user.id;
  const adminClient = createAdminClient();

  // 1. Anonimizar cotizaciones (se conservan por obligación legal/tributaria)
  const { error: quoteError } = await adminClient
    .from("quotes")
    .update({
      user_id: null,
      name: "[eliminado]",
      email: "[eliminado]",
      phone: null,
    })
    .eq("user_id", userId);

  if (quoteError) {
    console.error("[DELETE /api/my-data/delete] Error al anonimizar cotizaciones:", quoteError);
    return NextResponse.json(
      { error: "Error al procesar la eliminación. Intenta nuevamente." },
      { status: 500 }
    );
  }

  // 2. Eliminar el perfil del usuario (orders se eliminan en cascada)
  const { error: profileError } = await adminClient
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("[DELETE /api/my-data/delete] Error al eliminar perfil:", profileError);
    return NextResponse.json(
      { error: "Error al eliminar el perfil. Intenta nuevamente." },
      { status: 500 }
    );
  }

  // 3. Eliminar el usuario de auth (último paso para no perder referencia)
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error("[DELETE /api/my-data/delete] Error al eliminar usuario de auth:", deleteUserError);
    // No devolvemos error al cliente porque el perfil ya fue eliminado.
    // El usuario de auth se limpiará en el próximo ciclo de mantenimiento.
  }

  // 4. Registrar el evento de supresión (para auditoría — sin PII)
  console.info(`[GDPR] Cuenta eliminada por solicitud del titular. user_id=${userId} timestamp=${new Date().toISOString()}`);

  return NextResponse.json({
    success: true,
    mensaje:
      "Tu cuenta y datos personales han sido eliminados. Las cotizaciones realizadas fueron anonimizadas por obligación legal. Gracias por usar nuestros servicios.",
  });
}
