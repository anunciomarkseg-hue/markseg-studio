#!/usr/bin/env python3
"""Gera o guia do MarkSeg Studio em PDF, em linguagem simples."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, PageBreak, ListFlowable, ListItem, KeepTogether,
)

AZUL = colors.HexColor("#1c6fce")
AZUL_CLARO = colors.HexColor("#eaf2fc")
LARANJA = colors.HexColor("#f07a1f")
LARANJA_CLARO = colors.HexColor("#fdf0e4")
CINZA = colors.HexColor("#5b6472")
CINZA_CLARO = colors.HexColor("#f4f6f8")
VERMELHO = colors.HexColor("#c2384a")
VERM_CLARO = colors.HexColor("#fdeef0")
VERDE = colors.HexColor("#1e7d53")
VERDE_CLARO = colors.HexColor("#e9f6ef")
TINTA = colors.HexColor("#1a2230")

ss = getSampleStyleSheet()

def S(name, **kw):
    base = dict(fontName="Helvetica", fontSize=10.5, leading=15.5,
                textColor=TINTA, alignment=TA_LEFT, spaceAfter=7)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_titulo   = S("titulo", fontName="Helvetica-Bold", fontSize=26, leading=30,
                textColor=AZUL, spaceAfter=6)
st_sub      = S("sub", fontSize=12.5, leading=17, textColor=CINZA, spaceAfter=20)
st_h1       = S("h1", fontName="Helvetica-Bold", fontSize=16, leading=20,
                textColor=AZUL, spaceBefore=20, spaceAfter=9)
st_h2       = S("h2", fontName="Helvetica-Bold", fontSize=12.5, leading=16,
                textColor=TINTA, spaceBefore=13, spaceAfter=5)
st_corpo    = S("corpo")
st_peq      = S("peq", fontSize=9.5, leading=13.5, textColor=CINZA)
st_celula   = S("celula", fontSize=9.5, leading=13)
st_celula_b = S("celula_b", fontSize=9.5, leading=13, fontName="Helvetica-Bold")
st_cab      = S("cab", fontSize=9.5, leading=13, fontName="Helvetica-Bold",
                textColor=colors.white)
st_aviso    = S("aviso", fontSize=10, leading=14.5, textColor=TINTA)


def caixa(texto, cor_fundo, cor_borda, titulo=None):
    """Bloco destacado (aviso / dica)."""
    linhas = []
    if titulo:
        linhas.append([Paragraph(f"<b>{titulo}</b>", st_aviso)])
    linhas.append([Paragraph(texto, st_aviso)])
    t = Table(linhas, colWidths=[16.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), cor_fundo),
        ("LINEABOVE", (0, 0), (-1, 0), 0.1, cor_borda),
        ("LINEBELOW", (0, -1), (-1, -1), 0.1, cor_borda),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, cor_borda),
        ("LINEAFTER", (-1, 0), (-1, -1), 0.1, cor_borda),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def tabela(cabecalho, linhas, larguras):
    dados = [[Paragraph(c, st_cab) for c in cabecalho]]
    for ln in linhas:
        dados.append([Paragraph(ln[0], st_celula_b)] +
                     [Paragraph(c, st_celula) for c in ln[1:]])
    t = Table(dados, colWidths=larguras, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CINZA_CLARO]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dde3ea")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def lista(itens):
    return ListFlowable(
        [ListItem(Paragraph(i, st_corpo), leftIndent=14) for i in itens],
        bulletType="bullet", bulletColor=AZUL, bulletFontSize=7,
        leftIndent=13, spaceAfter=8,
    )


def rodape(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(CINZA)
    canvas.drawString(2.5 * cm, 1.35 * cm, "MarkSeg Studio — Guia de Entrega")
    canvas.drawRightString(A4[0] - 2.5 * cm, 1.35 * cm, f"Página {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#dde3ea"))
    canvas.setLineWidth(0.4)
    canvas.line(2.5 * cm, 1.8 * cm, A4[0] - 2.5 * cm, 1.8 * cm)
    canvas.restoreState()


def build(caminho):
    doc = BaseDocTemplate(
        caminho, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.2 * cm, bottomMargin=2.3 * cm,
        title="MarkSeg Studio — Guia de Entrega",
        author="MarkSeg",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="n")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=rodape)])

    s = []
    A = s.append

    # ---------------- CAPA ----------------
    A(Spacer(1, 2.6 * cm))
    A(Paragraph("MarkSeg Studio", st_titulo))
    A(Paragraph("Guia de Entrega — explicado em linguagem simples", st_sub))
    A(caixa(
        "Este documento é para <b>qualquer pessoa</b> que vai cuidar do sistema — "
        "mesmo quem não entende de programação. Ele explica o que o sistema faz, "
        "quais acessos pedir, como resolver os problemas do dia a dia e, "
        "principalmente, <b>o que nunca fazer</b>.",
        AZUL_CLARO, AZUL))
    A(Spacer(1, 0.8 * cm))
    A(Paragraph("O que você vai encontrar", st_h2))
    A(tabela(["Parte", "Assunto"], [
        ["1", "O que é o MarkSeg Studio"],
        ["2", "As 6 chaves que você precisa pedir"],
        ["3", "Como o sistema funciona por dentro"],
        ["4", "Os 3 avisos mais importantes"],
        ["5", "Resolvendo problemas do dia a dia"],
        ["6", "Manutenção: o que checar de vez em quando"],
        ["7", "Regras de ouro (o que nunca fazer)"],
        ["8", "Perguntas para fazer ao dono antes de assumir"],
    ], [2.0 * cm, 14.0 * cm]))
    A(PageBreak())

    # ---------------- 1 ----------------
    A(Paragraph("1. O que é o MarkSeg Studio", st_h1))
    A(Paragraph(
        "Pense nele como uma <b>central de comando das redes sociais</b> dos clientes "
        "da agência. Antes, alguém precisava abrir o Instagram de cada cliente, "
        "um por um, e postar na mão. O Studio junta tudo num lugar só.", st_corpo))
    A(Paragraph("O que ele faz", st_h2))
    A(tabela(["Área", "Para que serve"], [
        ["Publicar", "Posta no Instagram, Facebook, LinkedIn e TikTok — na hora ou agendado"],
        ["Pauta", "Planeja o mês. O cliente aprova por um link, sem precisar de senha"],
        ["Calendário", "Mostra o mês inteiro de cada cliente"],
        ["Publicações", "Histórico: o que saiu, o que falhou, o que está agendado"],
        ["Analytics", "Relatórios de desempenho (alcance, curtidas, seguidores)"],
        ["Mural e Conversas", "Recados e bate-papo interno da equipe"],
        ["Cofre", "Guarda as senhas dos clientes com segurança"],
        ["Atendimento", "Junta os e-mails de várias contas num painel só"],
        ["Equipe", "Convida pessoas e define o que cada uma pode fazer"],
    ], [3.6 * cm, 12.4 * cm]))
    A(Spacer(1, 0.35 * cm))
    A(Paragraph("Quem usa", st_h2))
    A(Paragraph(
        "A <b>equipe da agência</b> usa o sistema todo. Os <b>clientes</b> só recebem "
        "links: um para aprovar a pauta e outro para ver o relatório. Eles não têm "
        "login e não veem nada além do que é deles.", st_corpo))

    A(Paragraph("Os três níveis de acesso", st_h2))
    A(tabela(["Nível", "O que a pessoa pode fazer"], [
        ["Admin", "Tudo: convidar gente, conectar contas, abrir o Cofre, publicar"],
        ["Editor", "Publicar e agendar posts, mexer na pauta e no calendário"],
        ["Visualização", "Só olhar (relatórios, calendário, pauta). Pode postar aviso no Mural"],
    ], [3.6 * cm, 12.4 * cm]))
    A(Spacer(1, 0.3 * cm))
    A(caixa(
        "Exemplo prático: alguém do <b>financeiro</b> que só precisa ver relatórios deve "
        "entrar como <b>Visualização</b>. Assim ela nunca publica sem querer na conta "
        "de um cliente.", VERDE_CLARO, VERDE, "Dica"))
    A(PageBreak())

    # ---------------- 2 ----------------
    A(Paragraph("2. As 6 chaves que você precisa pedir", st_h1))
    A(Paragraph(
        "O sistema é montado com peças de empresas diferentes. Você precisa de acesso "
        "às <b>6</b>. Sem alguma delas, você trava em algum momento. Peça todas de uma "
        "vez ao dono, antes de começar.", st_corpo))

    A(tabela(["Serviço", "O que guarda", "Como pedir"], [
        ["GitHub", "O código do sistema", "Pedir para ser adicionado como colaborador do repositório"],
        ["Vercel", "Onde o site fica no ar e todas as senhas do sistema", "Pedir convite para o projeto"],
        ["Supabase", "O banco de dados e os logins das pessoas", "Pedir convite para o projeto"],
        ["Meta", "Ligação com Instagram e Facebook", "Pedir para ser administrador do aplicativo"],
        ["Cloudflare", "Onde ficam as fotos e vídeos", "Pedir acesso à conta"],
        ["Domínio", "O endereço studio.markseg.com.br", "Perguntar onde está registrado"],
    ], [2.9 * cm, 6.0 * cm, 7.1 * cm]))
    A(Spacer(1, 0.4 * cm))

    A(Paragraph("Entendendo cada uma (em palavras simples)", st_h2))
    A(lista([
        "<b>GitHub</b> — é o arquivo onde mora o código. Toda mudança fica registrada ali, "
        "com data e autor. Se algo der errado, dá para voltar atrás.",
        "<b>Vercel</b> — é quem coloca o site no ar. Quando alguém salva uma mudança no "
        "GitHub, a Vercel publica sozinha em poucos minutos. É também onde ficam guardadas "
        "todas as senhas que o sistema usa.",
        "<b>Supabase</b> — é o banco de dados: a memória do sistema. Guarda os posts, as "
        "pautas, os usuários e as senhas do Cofre.",
        "<b>Meta</b> — é a Ferramenta do Facebook que dá permissão para o sistema publicar "
        "no Instagram e no Facebook dos clientes.",
        "<b>Cloudflare</b> — é o depósito das fotos e vídeos. Quando você envia uma imagem, "
        "ela vai para lá antes de ir para a rede social.",
        "<b>Domínio</b> — é o endereço que as pessoas digitam para entrar.",
    ]))
    A(Spacer(1, 0.2 * cm))
    A(caixa(
        "Guarde os acessos num <b>gerenciador de senhas</b> da agência, não num papel ou "
        "bloco de notas. E confira se mais de uma pessoa tem acesso — se só uma pessoa "
        "tiver, a agência fica refém dela.",
        LARANJA_CLARO, LARANJA, "Cuidado"))
    A(PageBreak())

    # ---------------- 3 ----------------
    A(Paragraph("3. Como o sistema funciona por dentro", st_h1))
    A(Paragraph(
        "Você não precisa saber programar para entender o caminho que um post faz. "
        "Ele é simples:", st_corpo))

    A(Paragraph("Quando você publica um post", st_h2))
    A(tabela(["Passo", "O que acontece"], [
        ["1", "Você escolhe o cliente, envia a foto ou vídeo e escreve a legenda"],
        ["2", "A mídia sobe para o depósito (Cloudflare) — não passa pelo site, por isso é rápido"],
        ["3", "O post é guardado no banco de dados"],
        ["4", "O sistema conversa com o Instagram/Facebook e manda publicar"],
        ["5", "Deu certo: guarda o endereço do post. Deu errado: guarda o motivo"],
    ], [1.8 * cm, 14.2 * cm]))
    A(Spacer(1, 0.35 * cm))

    A(caixa(
        "<b>Por que um Reel às vezes demora?</b> Porque o Instagram precisa processar o "
        "vídeo antes de publicar — igual quando você posta pelo celular e aparece "
        "“enviando”. O sistema espera um pouco, e se demorar demais ele avisa "
        "“ainda finalizando” e conclui sozinho depois. <b>Não publique de novo</b> nesse "
        "caso: você criaria um post duplicado.",
        AZUL_CLARO, AZUL, "Entenda"))
    A(Spacer(1, 0.35 * cm))

    A(Paragraph("Quando o post é agendado", st_h2))
    A(Paragraph(
        "O post fica guardado esperando a hora. Um <b>despertador automático</b> (um "
        "serviço de fora) acorda o sistema de tempos em tempos e pergunta: “tem post na "
        "hora de sair?”. Se tiver, ele publica.", st_corpo))
    A(caixa(
        "Esse despertador é <b>externo</b> ao sistema. Se ele parar de funcionar, "
        "<b>nenhum post agendado sai — e ninguém é avisado</b>. Descubra com o dono qual "
        "é o serviço e quem tem a conta. Confira uma vez por mês.",
        VERM_CLARO, VERMELHO, "Atenção"))
    A(Spacer(1, 0.3 * cm))

    A(Paragraph("Quando o cliente aprova a pauta", st_h2))
    A(Paragraph(
        "Você gera um link na tela de Pauta e manda para o cliente. Ele abre no celular, "
        "sem senha, e aprova ou pede ajuste. O retorno dele aparece como um "
        "<b>número vermelho</b> no menu da equipe.", st_corpo))
    A(PageBreak())

    # ---------------- 4 ----------------
    A(Paragraph("4. Os 3 avisos mais importantes", st_h1))
    A(Paragraph(
        "Se você ler só uma página deste guia, que seja esta.", st_corpo))

    A(caixa(
        "Existe uma senha-mestra chamada <b>VAULT_SECRET</b>, guardada na Vercel. É ela "
        "que abre o Cofre onde ficam as senhas dos clientes.<br/><br/>"
        "Se essa chave for <b>trocada ou perdida</b>, todo o conteúdo do Cofre fica "
        "embaralhado <b>para sempre</b>. Não existe recuperação, nem suporte que resolva.<br/><br/>"
        "<b>O que fazer:</b> guarde uma cópia dela no gerenciador de senhas da agência, "
        "fora da Vercel. E nunca mexa nessa variável “para testar”.",
        VERM_CLARO, VERMELHO, "1. A chave do Cofre não pode ser perdida"))
    A(Spacer(1, 0.4 * cm))

    A(caixa(
        "O despertador que publica os posts agendados <b>não faz parte do sistema</b> — "
        "é um serviço contratado à parte.<br/><br/>"
        "Se ele parar, os posts simplesmente não saem e <b>nada avisa</b>. O cliente "
        "descobre antes de você.<br/><br/>"
        "<b>O que fazer:</b> descubra qual é o serviço, quem tem a conta e ative o alerta "
        "de falha dentro dele. Confira uma vez por mês.",
        VERM_CLARO, VERMELHO, "2. O despertador é externo"))
    A(Spacer(1, 0.4 * cm))

    A(caixa(
        "De tempos em tempos o Facebook corta a ligação do sistema com as contas — "
        "acontece quando alguém troca a senha do Facebook ou por decisão de segurança "
        "deles.<br/><br/>"
        "<b>Isso não é defeito.</b> As contas aparecem com uma etiqueta vermelha "
        "<b>“Reconecte”</b> na tela de Contas.<br/><br/>"
        "<b>O que fazer:</b> entrar em <b>Contas</b> e clicar em <b>Reconectar</b>. "
        "Renova todas de uma vez, em segundos.",
        LARANJA_CLARO, LARANJA, "3. A ligação com o Facebook cai sozinha"))
    A(PageBreak())

    # ---------------- 5 ----------------
    A(Paragraph("5. Resolvendo problemas do dia a dia", st_h1))
    A(Paragraph("Os quatro problemas mais comuns e o que fazer em cada um.", st_corpo))

    A(Paragraph("“O post não saiu”", st_h2))
    A(tabela(["Passo", "O que fazer"], [
        ["1", "Abrir <b>Publicações</b> e olhar o status do post"],
        ["2", "Se estiver “Falhou”, a mensagem já diz o motivo"],
        ["3", "Corrigir o motivo (veja a tabela abaixo)"],
        ["4", "Clicar em <b>Republicar</b> — ele reenvia só o que não saiu, sem duplicar"],
    ], [1.8 * cm, 14.2 * cm]))
    A(Spacer(1, 0.3 * cm))
    A(tabela(["Mensagem que aparece", "O que significa", "Solução"], [
        ["Token inválido ou expirado", "A ligação com o Facebook caiu",
         "Contas → Reconectar"],
        ["O Instagram rejeitou o vídeo", "O vídeo está fora do padrão",
         "Usar MP4 na vertical, entre 3 segundos e 15 minutos"],
        ["Seu nível não permite", "A pessoa está como Visualização",
         "Um admin muda o nível dela em Equipe"],
        ["Ainda finalizando", "O Instagram está processando o vídeo",
         "Esperar. Não publicar de novo"],
    ], [4.6 * cm, 5.4 * cm, 6.0 * cm]))
    A(Spacer(1, 0.4 * cm))

    A(Paragraph("“Alguém não consegue entrar”", st_h2))
    A(lista([
        "O convite não chegou → reenviar em <b>Equipe</b> (digitar o e-mail de novo).",
        "O link do convite dá erro → é a configuração de endereços no Supabase. "
        "Peça ajuda técnica.",
        "Esqueceu a senha → usar “esqueci a senha” na tela de entrada.",
    ]))

    A(Paragraph("“Está tudo lento ou travando”", st_h2))
    A(lista([
        "Primeiro: recarregue a página (F5). Muita coisa se resolve aí.",
        "Se continuar, veja se é só uma tela ou o sistema todo — isso ajuda quem for "
        "consertar a achar a causa.",
        "Onde olhar o erro de verdade: <b>Vercel → Logs</b>. Ali aparece o motivo técnico, "
        "com data e hora.",
    ]))

    A(Paragraph("“Publiquei no cliente errado”", st_h2))
    A(Paragraph(
        "O sistema hoje mostra uma <b>confirmação com o nome do cliente</b> antes de "
        "publicar, e avisa em vermelho se você misturar contas de clientes diferentes. "
        "Leia essa confirmação — ela existe justamente para evitar esse erro.", st_corpo))
    A(caixa(
        "Se o post já saiu: no Facebook e no LinkedIn dá para apagar pelo próprio sistema. "
        "No <b>Instagram e TikTok não dá</b> — essas redes não permitem apagar por fora, "
        "então é preciso remover pelo aplicativo.",
        LARANJA_CLARO, LARANJA, "Importante"))
    A(PageBreak())

    # ---------------- 6 ----------------
    A(Paragraph("6. Manutenção: o que checar de vez em quando", st_h1))
    A(tabela(["Quando", "O que fazer", "Por quê"], [
        ["Quando aparecer etiqueta vermelha “Reconecte”",
         "Contas → Reconectar",
         "A ligação com o Facebook caiu; sem isso nada publica"],
        ["Uma vez por mês",
         "Conferir se o despertador externo está rodando",
         "Se parou, os posts agendados não saem e ninguém avisa"],
        ["Uma vez por ano",
         "Atualizar a versão da ligação com o LinkedIn",
         "O LinkedIn desativa versões antigas"],
        ["A cada dois anos, mais ou menos",
         "Atualizar a versão da ligação com a Meta",
         "O Facebook desativa versões antigas e o sistema para"],
        ["Sempre que alguém entrar ou sair da equipe",
         "Ajustar em Equipe",
         "Quem saiu não deve continuar com acesso"],
    ], [4.6 * cm, 5.4 * cm, 6.0 * cm]))
    A(Spacer(1, 0.4 * cm))

    A(caixa(
        "As duas últimas linhas da tabela são as que <b>mais pegam gente de surpresa</b>. "
        "Elas não avisam antes: um dia o sistema simplesmente para de publicar. Anote as "
        "datas na agenda da agência.",
        AZUL_CLARO, AZUL, "Dica"))
    A(Spacer(1, 0.5 * cm))

    A(Paragraph("Quem faz o quê", st_h2))
    A(tabela(["Tarefa", "Precisa de programador?"], [
        ["Reconectar contas", "Não — é um botão na tela"],
        ["Convidar pessoa e definir nível", "Não — é a tela Equipe"],
        ["Republicar um post que falhou", "Não — é um botão em Publicações"],
        ["Conferir o despertador externo", "Não — é entrar no serviço e olhar"],
        ["Atualizar versão da Meta ou LinkedIn", "Sim — mexe em configuração"],
        ["Mudar algo no funcionamento do sistema", "Sim"],
    ], [8.6 * cm, 7.4 * cm]))
    A(PageBreak())

    # ---------------- 7 ----------------
    A(Paragraph("7. Regras de ouro", st_h1))
    A(Paragraph(
        "Estas regras existem porque cada uma delas já causou (ou quase causou) um "
        "problema real. Vale para você e para quem for mexer no código.", st_corpo))

    A(tabela(["Nunca", "Por quê"], [
        ["Trocar ou apagar a VAULT_SECRET",
         "Todo o Cofre de senhas fica ilegível para sempre"],
        ["Mexer nas variáveis da Vercel “para testar”",
         "Elas são as chaves do sistema; uma errada derruba tudo"],
        ["Testar publicação numa conta de cliente",
         "O post vai ao ar de verdade, no perfil real"],
        ["Publicar de novo quando aparece “ainda finalizando”",
         "Cria post duplicado no perfil do cliente"],
        ["Deixar só uma pessoa com os acessos",
         "A agência fica travada se essa pessoa sair ou ficar doente"],
        ["Mandar mudança direto para produção sem testar",
         "Todo salvamento publica no ar em minutos"],
    ], [6.8 * cm, 9.2 * cm]))
    A(Spacer(1, 0.45 * cm))

    A(Paragraph("Se você for mexer no código (ou pedir para alguém mexer)", st_h2))
    A(lista([
        "Trabalhe sempre numa <b>cópia</b> (chamada “branch”), nunca direto no principal.",
        "A Vercel cria um <b>endereço de teste</b> para essa cópia — teste ali antes.",
        "Só depois de validar, junte no principal, que publica no ar.",
        "Antes de enviar, rode as duas checagens automáticas do projeto. Elas pegam a "
        "maioria dos erros antes de o cliente ver.",
    ]))
    A(Spacer(1, 0.2 * cm))
    A(caixa(
        "O projeto tem um documento técnico chamado <b>MANUAL.md</b>, dentro do próprio "
        "código. Ele traz o passo a passo detalhado para quem programa. Este PDF é a "
        "versão para quem não programa — os dois se completam.",
        VERDE_CLARO, VERDE, "Onde está o material técnico"))
    A(PageBreak())

    # ---------------- 8 ----------------
    A(Paragraph("8. Perguntas para fazer ao dono antes de assumir", st_h1))
    A(Paragraph(
        "Estas respostas <b>não estão no sistema nem no código</b>. Elas só existem na "
        "cabeça de quem está saindo. Se você não perguntar agora, vai precisar delas "
        "justamente no dia em que algo der errado.", st_corpo))

    A(tabela(["#", "Pergunta"], [
        ["1", "Qual serviço acorda o sistema para publicar os agendados, e quem tem a conta dele?"],
        ["2", "Onde está guardada a cópia de segurança da chave do Cofre (VAULT_SECRET)?"],
        ["3", "Quem é o dono das contas: Vercel, Supabase, Cloudflare, Meta e domínio?"],
        ["4", "Existe cópia de segurança do banco de dados? De quanto em quanto tempo?"],
        ["5", "Quais clientes usam quais redes? Algum está só em teste?"],
        ["6", "Existe combinado com cliente sobre horário de publicação?"],
        ["7", "Quem deve continuar como administrador depois da transição?"],
        ["8", "Tem alguém de plantão técnico se o sistema cair fora do horário?"],
        ["9", "Onde ficam registradas as senhas dos clientes além do Cofre?"],
        ["10", "Algum cliente tem exigência especial (aprovação, marca d'água, formato)?"],
    ], [1.3 * cm, 14.7 * cm]))
    A(Spacer(1, 0.5 * cm))

    A(caixa(
        "Marque cada pergunta conforme for respondida e guarde este documento preenchido "
        "junto com os acessos. <b>Este é o item que mais trava uma transição</b> — não "
        "porque é difícil, mas porque ninguém lembra de perguntar antes.",
        AZUL_CLARO, AZUL, "Como usar esta lista"))
    A(Spacer(1, 0.7 * cm))

    A(Paragraph("Resumo em uma frase", st_h2))
    A(caixa(
        "O MarkSeg Studio publica sozinho, mas <b>não se cuida sozinho</b>: precisa que "
        "alguém reconecte as contas quando o Facebook derruba, confira o despertador uma "
        "vez por mês e guarde bem a chave do Cofre. Fora isso, o dia a dia é clicar em "
        "botões nas telas.",
        VERDE_CLARO, VERDE))

    doc.build(s)
    print(f"PDF gerado: {caminho}")


if __name__ == "__main__":
    build("/workspace/markseg-studio/docs/MarkSeg-Studio-Guia-de-Entrega.pdf")
