import { ARMORY } from "./world.js?v=16";
import { CAPTAIN_SKILLS, learnSkill, skillAtRank } from "./skills.js?v=16";

export const TRADERS = {
  skills: {
    name: "Руна", title: "Лавка умений", greeting: "Как насчёт нового трюка, капитан?",
    replies: [
      "Ох, вот теперь за тобой и шторму не угнаться!",
      "И это всё, что от меня нужно? Какой скромный капитан.",
      "Дублоны звенят, глаза горят. Обожаю удачные сделки!",
      "Попробуй при случае. Только не вздумай сказать, что сам придумал!",
      "С таким трюком и в родном порту не узнают.",
      "Знаешь, ты хватаешь на лету. Вернёшься — покажу ещё кое-что.",
      "Запомнил? А если забудешь, придётся зайти снова.",
      "Улыбнись! Удача любит тех, кто успел заплатить.",
    ],
  },
  arms: {
    name: "Бранн", title: "Кузница", greeting: "Покажи оружие.", replies: ["Готово.", "Держи крепче.", "Проверено.", "Сделано."],
  },
  chests: {
    name: "Шкив", title: "Сундуки Шкива", greeting: "У-у? А-а!", replies: ["Ук-ук! А-а!", "И-и! У-у-у!", "А-ак! У-ук!", "У-у! Хи-и!"],
  },
};

const INTRO_STOCK = new Set(["gear-0", "gear-3", "leech", "parry"]);
const ARM_PRICES = [22, 36, 55];
const SKILL_PRICES = [16, 23, 34];

function availableSkills(player) {
  const ranks = new Map(player.skills.map(skill => [skill.id, skill.rank]));
  return CAPTAIN_SKILLS.map(skill => skillAtRank(skill, (ranks.get(skill.id) ?? 0) + 1)).filter(Boolean);
}

export function offers(player, vendor) {
  if (vendor === "arms") {
    return [...player.arsenal].map(weapon => {
      const rank = (player.weaponRanks[weapon] ?? 0) + 1;
      const effect = weapon === "blade" ? "дальность удара +" + rank * 7 + "%" : "время перезарядки −" + rank * 7 + "%";
      return { id: weapon, title: ARMORY[weapon].name, rank, maxRank: ARM_PRICES.length,
        icon: weapon, price: ARM_PRICES[rank - 1], detail: "Урон +" + rank * 13 + "% · " + effect };
    });
  }
  if (vendor === "skills") {
    return availableSkills(player).filter(skill => skill.rank > 1 || INTRO_STOCK.has(skill.id))
      .sort((a, b) => b.rank - a.rank)
      .map(skill => ({ id: skill.id, title: skill.name, detail: skill.effect, rank: skill.rank, maxRank: skill.maxRank,
        skill, price: SKILL_PRICES[skill.rank - 1] }));
  }
  if (vendor === "chests") {
    return [{ id: "chest", title: "Запертый сундук", icon: "chest",
      detail: "Случайное новое умение или следующий ранг. После покупки цена вырастет на 8 дублонов.",
      price: availableSkills(player).length ? 14 + player.boxes * 8 : undefined }];
  }
  return [];
}

export function purchase(world, vendor, id) {
  if (world.map.key !== "port" || world.status !== "play") return null;
  const p = world.player;
  const offer = offers(p, vendor).find(option => option.id === id);
  if (!offer?.price || p.coins < offer.price) return null;
  let skill = offer.skill;
  if (vendor === "chests") {
    const pool = availableSkills(p);
    skill = pool[Math.floor(world.lootRandom() * pool.length)];
    if (!skill) return null;
  }
  if (skill && !learnSkill(p, skill)) return null;
  if (vendor === "arms") p.weaponRanks[id] = offer.rank;
  if (vendor === "chests") p.boxes++;
  p.coins -= offer.price;
  world.lastReveal = -1;
  const rank = skill?.rank ?? offer.rank;
  const label = skill?.name ?? offer.title;
  return { label: label + (rank > 1 || vendor === "arms" ? " · " + ["I", "II", "III"][rank - 1] : ""),
    detail: skill?.effect ?? offer.detail };
}
