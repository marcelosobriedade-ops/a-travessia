export const QUOTES = [
  "A felicidade da sua vida depende da qualidade dos seus pensamentos. — Marco Aurélio",
  "Não são as coisas que perturbam os homens, mas as opiniões que têm sobre elas. — Epiteto",
  "Só há uma coisa que nos faz sonhar e isso é o amanhã. — Marco Aurélio",
  "Aceita as coisas que não podes mudar, muda o que podes. — Epiteto",
  "Temos dois ouvidos e uma boca para escutar o dobro do que falamos. — Epiteto",
  "Perde o menor tempo possível nos pensamentos dos outros. — Marco Aurélio",
  "Não te preocupes com o que os outros pensam de ti, mas com o que tu pensas de ti. — Sêneca",
  "A vida é longa, se souberes como usá-la. — Sêneca",
  "Não é que tenhamos pouco tempo, mas que desperdiçamos muito. — Sêneca",
  "Toda mudança contém a semente de uma oportunidade. — Marco Aurélio",
  "Sofre agora e vive o resto da tua vida como um campeão. — Sêneca",
  "A sabedoria começa quando paramos de tentar controlar o incontrolável. — Epiteto",
  "Cuida do teu caráter e o teu destino cuidará de si mesmo. — Epicteto",
  "O momento presente é tudo o que tens. Usa-o bem. — Marco Aurélio",
];

export function getQuoteOfDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      1000 /
      60 /
      60 /
      24
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

export function getCurrentDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFormattedDate(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}
