-- ============================================================
-- migration_gdpr.sql
-- Soporte para Ley N° 21.719 — Protección de Datos Personales
-- Derechos ARCOP: Acceso, Rectificación, Cancelación/Supresión,
--                 Oposición, Portabilidad
-- ============================================================

-- 1. Tabla de registro de solicitudes ARCOP
--    Permite auditar cuándo ejerció cada titular sus derechos.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   text        NOT NULL,
  request_type text        NOT NULL CHECK (request_type IN ('acceso', 'rectificacion', 'supresion', 'oposicion', 'portabilidad', 'bloqueo')),
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- El titular puede ver sus propias solicitudes
DROP POLICY IF EXISTS "Users read own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users read own privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- El titular puede insertar nuevas solicitudes
DROP POLICY IF EXISTS "Users insert own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users insert own privacy requests"
  ON public.privacy_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Admins pueden gestionar todas las solicitudes
DROP POLICY IF EXISTS "Admins manage privacy requests" ON public.privacy_requests;
CREATE POLICY "Admins manage privacy requests"
  ON public.privacy_requests
  FOR ALL
  USING (is_admin());

-- 2. Función de supresión de datos del usuario
--    Invocada por el endpoint DELETE /api/my-data/delete
--    (El endpoint usa el admin client directamente, pero esta función
--     puede usarse desde el panel de Supabase para operaciones manuales)
CREATE OR REPLACE FUNCTION public.anonymize_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anonimizar cotizaciones (se conservan por obligación tributaria/legal)
  UPDATE public.quotes
  SET
    user_id = NULL,
    name    = '[eliminado]',
    email   = '[eliminado]',
    phone   = NULL
  WHERE user_id = p_user_id;

  -- Registrar evento de supresión en privacy_requests
  INSERT INTO public.privacy_requests (user_id, user_email, request_type, status, completed_at)
  VALUES (p_user_id, '[suprimido]', 'supresion', 'completed', now())
  ON CONFLICT DO NOTHING;
END;
$$;

-- Revocar ejecución pública (solo el backend con service_role puede llamarla)
REVOKE EXECUTE ON FUNCTION public.anonymize_user_data(uuid) FROM PUBLIC;

-- 3. Tabla de registro de incidentes de seguridad (brechas)
--    Obligatorio por Ley 21.719 para notificación a la APDP en 72 horas
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at      timestamptz NOT NULL DEFAULT now(),
  reported_at      timestamptz,                          -- fecha de notificación a la APDP
  description      text        NOT NULL,
  affected_records integer,
  severity         text        NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'closed')),
  apdp_notified    boolean     NOT NULL DEFAULT false,
  users_notified   boolean     NOT NULL DEFAULT false,
  resolution_notes text
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden gestionar incidentes
DROP POLICY IF EXISTS "Admins manage security incidents" ON public.security_incidents;
CREATE POLICY "Admins manage security incidents"
  ON public.security_incidents
  FOR ALL
  USING (is_admin());

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_id ON public.privacy_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON public.privacy_requests(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON public.security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON public.security_incidents(detected_at DESC);
