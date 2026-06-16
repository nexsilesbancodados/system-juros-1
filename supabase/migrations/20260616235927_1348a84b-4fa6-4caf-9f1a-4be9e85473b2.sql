-- Restringe Realtime: cada usuário só pode subscrever tópicos do próprio tenant
-- ou canais públicos de chat. Tópicos privados devem usar prefixo
-- 'tenant:<auth.uid()>:'. Chat/presence ficam acessíveis a autenticados.

DROP POLICY IF EXISTS authenticated_realtime_read ON realtime.messages;

CREATE POLICY "scoped_realtime_read" ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Tópico privado do próprio usuário
    realtime.topic() LIKE ('tenant:' || auth.uid()::text || ':%')
    -- Chat compartilhado entre tenants (canais e DMs já têm RLS nas próprias tabelas)
    OR realtime.topic() LIKE 'chat:%'
    OR realtime.topic() = 'chat-presence'
    OR realtime.topic() LIKE 'chat-msgs-%'
    OR realtime.topic() = 'chat-membership-rt'
  );

-- Bloqueia broadcasts arbitrários — só do próprio tenant ou chat
DROP POLICY IF EXISTS authenticated_realtime_write ON realtime.messages;

CREATE POLICY "scoped_realtime_write" ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('tenant:' || auth.uid()::text || ':%')
    OR realtime.topic() LIKE 'chat:%'
    OR realtime.topic() = 'chat-presence'
    OR realtime.topic() LIKE 'chat-msgs-%'
    OR realtime.topic() = 'chat-membership-rt'
  );