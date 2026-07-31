export const metadata = {
  title: "Termos de Uso — MarkSeg Studio",
  description: "Termos de uso da ferramenta interna MarkSeg Studio.",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-ink">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted">MarkSeg Studio — studio.markseg.com.br</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/90">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. Aceitação</h2>
          <p className="mt-2">
            Ao usar o MarkSeg Studio, você concorda com estes termos. A ferramenta é de uso interno
            da agência MarkSeg e de clientes que autorizam a gestão de suas redes sociais.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Finalidade</h2>
          <p className="mt-2">
            O MarkSeg Studio permite publicar, agendar e analisar conteúdos orgânicos em redes
            sociais (TikTok, Instagram, Facebook e LinkedIn) por meio das APIs oficiais de cada
            plataforma, respeitando suas regras e limites.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Contas conectadas</h2>
          <p className="mt-2">
            A conexão de cada conta é feita pelo login oficial da plataforma. O usuário é responsável
            por garantir que tem autorização para gerenciar as contas que conecta. Não nos
            responsabilizamos por uso não autorizado de contas de terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Conteúdo</h2>
          <p className="mt-2">
            Todo o conteúdo publicado é de responsabilidade do usuário que o cria e agenda. O usuário
            se compromete a respeitar as diretrizes de comunidade e os termos de cada rede social.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. Disponibilidade</h2>
          <p className="mt-2">
            A ferramenta é fornecida &quot;como está&quot;. Podemos atualizar ou suspender recursos a
            qualquer momento para manutenção ou melhorias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Contato</h2>
          <p className="mt-2">
            Dúvidas: <strong>contato@markseg.com.br</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
