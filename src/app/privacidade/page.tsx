export const metadata = {
  title: "Política de Privacidade — MarkSeg Studio",
  description: "Como o MarkSeg Studio trata os dados das contas conectadas.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-ink">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">MarkSeg Studio — studio.markseg.com.br</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/90">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. Quem somos</h2>
          <p className="mt-2">
            O MarkSeg Studio é uma ferramenta interna da agência MarkSeg, usada pela própria equipe
            para publicar, agendar e analisar conteúdos nas redes sociais dos clientes que nos
            autorizam a gerenciar suas contas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Dados que coletamos</h2>
          <p className="mt-2">
            Quando uma conta de rede social (TikTok, Instagram, Facebook ou LinkedIn) é conectada via
            login oficial da plataforma, armazenamos apenas: o identificador público da conta, o nome
            de exibição/usuário e um token de acesso (e, quando aplicável, um token de renovação)
            fornecido pela própria plataforma. <strong>Nunca temos acesso à sua senha.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Como usamos os dados</h2>
          <p className="mt-2">
            Os tokens são usados exclusivamente para executar as ações que você solicita dentro da
            ferramenta — publicar e agendar vídeos e imagens, e ler métricas de desempenho orgânico
            (alcance, visualizações, interações). Não vendemos, alugamos nem compartilhamos esses
            dados com terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Armazenamento e segurança</h2>
          <p className="mt-2">
            Os dados ficam armazenados em banco de dados protegido (Supabase) com acesso restrito à
            equipe autorizada. A comunicação é feita por conexão criptografada (HTTPS).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. Revogação e exclusão</h2>
          <p className="mt-2">
            Você pode revogar o acesso a qualquer momento nas configurações da própria rede social
            (TikTok, Meta, LinkedIn) ou solicitando à MarkSeg a desconexão da conta — o que remove os
            tokens armazenados. Para excluir seus dados, entre em contato pelo e-mail abaixo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Contato</h2>
          <p className="mt-2">
            Dúvidas sobre privacidade: <strong>contato@markseg.com.br</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
