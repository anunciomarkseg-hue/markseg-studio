/**
 * Limpeza de mensagens de erro antes de guardar/exibir.
 *
 * As redes ecoam o que receberam. A Meta, por exemplo, responde coisas como
 * "Malformed access token AAAAB3Nza..." — ou seja, a mensagem de erro carrega
 * o próprio token. Como agora essas mensagens aparecem na tela (Contas e
 * Publicações) e saem no payload de `GET /api/posts`, elas precisam passar por
 * aqui antes.
 */

/** Troca por [oculto] o que parece credencial dentro de uma mensagem. */
export function mascararSegredos(msg: string): string {
  if (!msg) return msg;
  return (
    msg
      // token em querystring (access_token=..., client_secret=...)
      .replace(/((?:access_token|client_secret|refresh_token|code)=)[^&\s"']+/gi, "$1[oculto]")
      // sequências longas soltas: tokens da Meta/LinkedIn/TikTok têm esse formato
      .replace(/\b[A-Za-z0-9_-]{28,}\b/g, (m) => `${m.slice(0, 4)}…[oculto]`)
  );
}
