import { RARITIES, TREASURE_SKILLS } from "./captain-skills.js?v=17";
export { RARITIES };
export const MINIMAP_ID = "minimap";
const MINIMAP_CHANCE = .001;

const scale = (stat, direction = 1, inverse = false) => (player, before, after) => {
  const ratio = (1 + direction * after / 100) / (1 + direction * before / 100);
  player[stat] *= inverse ? 1 / ratio : ratio;
};
const health = (player, prior, total) => {
  const gained = Math.round(player.max * (100 + total) / (100 + prior)) - player.max;
  player.max += gained;
  player.hp += gained;
};

const legacy = [
  ["Чёрный порох", "Урон огнестрельного оружия +%d%", [10,18,26], scale("gunDamage")],
  ["Взведённая пружина", "Темп стрельбы +%d%", [10,18,26], scale("gunCadence", 1, true)],
  ["Попутный ветер", "Скорость ходьбы +%d%", [10,16,22], scale("moveScale")],
  ["Крепкий шов", "Максимум здоровья +%d%", [10,18,26], health],
  ["Дублёный бушлат", "Получаемый урон −%d%", [10,16,22], scale("damageTaken", -1)],
  ["Ловкие руки", "Время перезарядки −%d%", [10,18,26], scale("reloadScale", -1)],
  ["Печать прилива", "Время восстановления рывка −%d%", [10,17,24], scale("dashReset", -1)],
  ["Летучий якорь", "Дальность рывка +%d%", [10,20,30], scale("dashSpeed")],
  ["Двойная камора", "Мушкет вмещает на один заряд больше", null, p => { p.capacityBonus.musket++; }],
  ["Запасная камора", "Мушкетон вмещает на один заряд больше", null, p => { p.capacityBonus.scatter++; }],
  ["Верный кремень", "Пистолет вмещает на один заряд больше", null, p => { p.capacityBonus.pistol++; }],
  ["Патронташ боцмана", "Максимум запаса патронов +8", null, p => { p.ammoLimit += 8; }],
  ["Клык барракуды", "Урон саблей +%d%", [15,25,35], scale("bladeDamage")],
  ["Длинная гарда", "Дальность удара саблей +%d%", [10,20,30], scale("bladeReach")],
  ["Полевой бальзам", "Лечение из аптечек +%d%", [25,38,50], scale("healScale")],
];

const island = [
  ["leech", "Сердце хищника", "За победу над врагом восстанавливаешь 2 здоровья"],
  ["parry", "Стальная ладонь", "Взмах саблей сбивает снаряды прямо перед тобой"],
  ["dash-shot", "Ветер в спину", "Первая атака в течение 2 секунд после рывка наносит на %d% больше урона", [35,48,62]],
  ["dash-wave", "След кильватера", "Задевай врагов рывком, чтобы нанести 12 урона"],
  ["execute", "Последний довод", "По врагам с четвертью здоровья или меньше урон выше на %d%", [25,40,55]],
  ["salvage", "Сборщик гильз", "Каждая четвёртая победа из огнестрельного оружия возвращает 1 патрон"],
  ["reload-shot", "Свежий заряд", "Первый выстрел после перезарядки наносит на %d% больше урона", [25,37,50]],
  ["last-round", "Последний патрон", "Последний выстрел в магазине наносит на %d% больше урона", [25,40,55]],
  ["ward", "Оберег странника", "Первое попадание в каждом секторе наносит тебе на %d% меньше урона", [60,75,90]],
  ["revive", "Долг перед морем", "Один раз за весь поход переживаешь смертельный удар с запасом 24 здоровья"],
  ["riposte", "Ответный клинок", "После полученного удара сабля наносит на %d% больше урона в течение двух секунд", [35,50,65]],
  ["survey", "Глаз картографа", "Карта открывается на %d% дальше", [40,55,70]],
  ["dash-reset", "Вольный ход", "Победа над врагом сокращает ожидание рывка на 0,35 секунды"],
  ["relic-heal", "Компас лекаря", "Каждый новый осколок восстанавливает 9 здоровья"],
  ["thick-hide", "Кожа штормов", "Урон по тебе меньше на %d%, пока здоровье ниже трети", [30,42,54]],
];

export const UPGRADES = legacy.map(([name, description, steps, apply], icon) => ({
  name, description, steps, apply, id: "gear-" + icon, icon, rarity: icon % 4 === 0 ? 1 : 0,
}));
export const CAPTAIN_SKILLS = [...UPGRADES, ...island.map(([id, name, description, steps], i) => ({
  id, name, description, steps, icon: i + UPGRADES.length, rarity: id === "revive" ? 4 : i % 3 === 0 ? 3 : 2,
  apply: player => player.traits.add(id),
})), ...TREASURE_SKILLS, {
  id: MINIMAP_ID, name: "Миникарта", description: "Заменяет компас миникартой. Показывает открытые проходы, твоё положение и направление к цели",
  rarity: 5, icon: 0, atlas: "minimap", apply: player => player.traits.add(MINIMAP_ID),
}];

export function skillAtRank(skill, rank) {
  const maxRank = skill.steps?.length ?? 1;
  if (rank > maxRank) return null;
  const power = skill.steps?.[rank - 1] ?? 0;
  const prior = skill.steps?.[rank - 2] ?? 0;
  return {
    id: skill.id, name: skill.name, icon: skill.icon, atlas: skill.atlas, rank, maxRank, power,
    rarity: skill.rarity, key: skill.key, cooldown: skill.cooldown,
    effect: skill.description.replace("%d", power),
    apply: player => skill.apply(player, prior, power),
  };
}

export const skillPower = (player, id) => ((player.skillPowers ? player.skillPowers[id]
  : player.skills.find(skill => skill.id === id)?.power) ?? 0) / 100;

export function drawSkills(pool, random, count) {
  const groups = RARITIES.map(([, weight], rarity) => ({
    weight, entries: pool.filter(skill => skill.rarity === rarity && skill.id !== MINIMAP_ID),
  }));
  const drawn = [];
  while (drawn.length < count) {
    const available = groups.filter(group => group.entries.length);
    const total = available.reduce((sum, group) => sum + group.weight, 0);
    if (!total) break;
    let roll = random() * total;
    const group = available.find(entry => (roll -= entry.weight) < 0) ?? available.at(-1);
    drawn.push(group.entries.splice(Math.floor(random() * group.entries.length), 1)[0]);
  }
  const minimap = pool.find(skill => skill.id === MINIMAP_ID);
  if (count > 0 && minimap && random() < MINIMAP_CHANCE) {
    if (drawn.length === count) drawn.pop();
    drawn.push(minimap);
  }
  return drawn;
}

export function learnSkill(player, skill) {
  const index = player.skills.findIndex(entry => entry.id === skill.id);
  const current = player.skills[index]?.rank ?? 0;
  if (skill.rank !== current + 1 || skill.rank > skill.maxRank) return false;
  skill.apply(player);
  (player.skillPowers ??= {})[skill.id] = skill.power;
  if (index < 0) player.skills.push(skill);
  else player.skills[index] = skill;
  return true;
}
