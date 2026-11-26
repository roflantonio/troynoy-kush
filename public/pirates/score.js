export const SCORE = [
  { title: "Меню и локации", tracks: [
    ["menu", "Фортуна любит наглых"],
    ["dream", "Боцманский зуб"],
    ["fort", "Порох под колоколом"],
    ["island", "Тропы под барабаны"],
    ["sea", "Левый борт!"],
    ["port", "Шальные дублоны"],
    ["vault", "Золотая лихорадка"],
  ] },
  { title: "Мини-боссы", tracks: [
    ["jailer-fort", "Пляска ключей"],
    ["jailer-island", "Кость и бамбук"],
  ] },
  { title: "Боссы", tracks: [
    ["watcher", "Последний звон Смотрителя"],
    ["king", "Электрический трон"],
    ["kraken", "Восьмой вал"],
    ["rust", "Взыскатель долгов"],
  ] },
  { title: "Катсцены", tracks: [
    ["film-shore", "С огнём до рассвета"],
    ["film-dream-guard", "Урок боцмана"],
    ["film-dream-end", "Волна о борт"],
    ["film-fort", "Проснуться в форте"],
    ["film-rescue", "Три удара по решётке"],
    ["film-runa-free", "Серьги для крыс"],
    ["film-watcher", "Зов колокола"],
    ["film-island", "Берег за рифом"],
    ["film-brann-code", "Кузница за замком"],
    ["film-brann-free", "Молот снова в руках"],
    ["film-king", "Трон живых корней"],
    ["film-sea", "Курс на шторм"],
    ["film-helm", "Пушки к бою"],
    ["film-kraken", "Цепь под водой"],
    ["film-port", "Огни мошенников"],
    ["film-market", "Рынок под морской стеной"],
    ["film-vault", "Галерея восьми печатей"],
    ["film-rust", "Закрыть счёт"],
    ["film-vault-end", "Строка в счётной книге"],
  ] },
];

export const scoreUrl = key => new URL("./music/" + key + ".mp3?v=17", import.meta.url);
