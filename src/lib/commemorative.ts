/**
 * Datas comemorativas do Brasil (calendário de marketing/conteúdo).
 * Puro (sem deps) — pode ser usado no cliente. Datas móveis são calculadas por ano.
 */

// Datas FIXAS — "MM-DD": nome curto (foco em datas úteis pra conteúdo/social no BR)
const FIXED: Record<string, string> = {
  "01-01": "Ano Novo",
  "01-06": "Dia de Reis",
  "01-09": "Dia do Astronauta",
  "01-25": "Aniversário de São Paulo",
  "01-30": "Dia da Saudade",
  "01-31": "Dia do Mágico",

  "02-02": "Dia de Iemanjá",
  "02-09": "Dia da Pizza",
  "02-21": "Dia do Guia de Turismo",

  "03-08": "Dia da Mulher",
  "03-14": "Dia do Bibliotecário",
  "03-15": "Dia do Consumidor",
  "03-19": "Dia de São José / do Carpinteiro",
  "03-21": "Dia da Poesia",
  "03-22": "Dia Mundial da Água",
  "03-23": "Dia do Meteorologista",
  "03-27": "Dia do Circo",
  "03-31": "Dia da Saúde e Nutrição",

  "04-01": "Dia da Mentira",
  "04-07": "Dia Mundial da Saúde",
  "04-13": "Dia do Beijo",
  "04-15": "Dia da Conservação do Solo",
  "04-18": "Dia do Livro Infantil",
  "04-19": "Dia dos Povos Indígenas",
  "04-21": "Tiradentes",
  "04-22": "Descobrimento do Brasil",
  "04-23": "Dia de São Jorge / do Livro",
  "04-28": "Dia da Educação",

  "05-01": "Dia do Trabalho",
  "05-04": "Dia do Combate ao Incêndio",
  "05-13": "Abolição da Escravatura",
  "05-15": "Dia da Família",
  "05-25": "Dia do Trabalhador Rural",
  "05-28": "Dia do Hambúrguer",
  "05-31": "Dia sem Tabaco",

  "06-05": "Dia do Meio Ambiente",
  "06-12": "Dia dos Namorados",
  "06-13": "Dia de Santo Antônio",
  "06-24": "Dia de São João",
  "06-28": "Dia do Orgulho LGBT",
  "06-29": "Dia de São Pedro",

  "07-02": "Dia do Bombeiro",
  "07-09": "Revolução Constitucionalista (SP)",
  "07-13": "Dia Mundial do Rock",
  "07-20": "Dia do Amigo",
  "07-25": "Dia do Motorista",
  "07-26": "Dia dos Avós",
  "07-27": "Dia do Motociclista",

  "08-11": "Dia do Advogado / do Estudante",
  "08-12": "Dia dos Namorados (intern.) / Juventude",
  "08-15": "Dia da Informática",
  "08-19": "Dia da Fotografia",
  "08-22": "Dia do Folclore",
  "08-25": "Dia do Soldado",
  "08-27": "Dia do Psicólogo",
  "08-29": "Dia contra o Fumo",

  "09-05": "Dia da Amazônia",
  "09-07": "Independência do Brasil",
  "09-15": "Dia do Cliente",
  "09-21": "Dia da Árvore",
  "09-22": "Dia sem Carro",
  "09-27": "Dia do Turismo",
  "09-30": "Dia da Secretária",

  "10-01": "Dia do Idoso / do Vendedor",
  "10-04": "Dia dos Animais",
  "10-12": "Dia das Crianças / N. Sra. Aparecida",
  "10-15": "Dia do Professor",
  "10-16": "Dia da Alimentação",
  "10-18": "Dia do Médico",
  "10-28": "Dia do Servidor Público",
  "10-31": "Halloween",

  "11-02": "Finados",
  "11-14": "Dia Nacional da Alfabetização",
  "11-15": "Proclamação da República",
  "11-19": "Dia da Bandeira",
  "11-20": "Consciência Negra",

  "12-08": "N. Sra. da Conceição",
  "12-10": "Dia dos Direitos Humanos",
  "12-25": "Natal",
  "12-31": "Réveillon",
};

const key = (m: number, d: number) => `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Domingo N do mês (1-based). */
function nthSunday(year: number, month0: number, n: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (7 - first.getDay()) % 7; // dias até o 1º domingo
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

/** Páscoa (Computus — algoritmo gregoriano anônimo). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/** Retorna { "MM-DD": [nomes] } com fixas + móveis do ano. */
export function commemorativesForYear(year: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (k: string, name: string) => {
    (out[k] ??= []).push(name);
  };

  for (const [k, name] of Object.entries(FIXED)) add(k, name);

  // móveis
  const maes = nthSunday(year, 4, 2); // 2º domingo de maio
  add(key(maes.getMonth() + 1, maes.getDate()), "Dia das Mães");
  const pais = nthSunday(year, 7, 2); // 2º domingo de agosto
  add(key(pais.getMonth() + 1, pais.getDate()), "Dia dos Pais");

  const pascoa = easter(year);
  add(key(pascoa.getMonth() + 1, pascoa.getDate()), "Páscoa");
  const sextaSanta = addDays(pascoa, -2);
  add(key(sextaSanta.getMonth() + 1, sextaSanta.getDate()), "Sexta-feira Santa");
  const carnaval = addDays(pascoa, -47); // terça de carnaval
  add(key(carnaval.getMonth() + 1, carnaval.getDate()), "Carnaval");
  const corpus = addDays(pascoa, 60);
  add(key(corpus.getMonth() + 1, corpus.getDate()), "Corpus Christi");

  // Black Friday = dia seguinte à 4ª quinta de novembro
  const nov1 = new Date(year, 10, 1);
  const firstThu = (11 - nov1.getDay()) % 7; // dias até 1ª quinta (getDay: 4=quinta)
  const fourthThu = new Date(year, 10, 1 + firstThu + 21);
  const blackFriday = addDays(fourthThu, 1);
  add(key(blackFriday.getMonth() + 1, blackFriday.getDate()), "Black Friday");

  return out;
}

/** Comemorativas de uma data específica. */
export function commemorativesOn(map: Record<string, string[]>, date: Date): string[] {
  return map[key(date.getMonth() + 1, date.getDate())] ?? [];
}
