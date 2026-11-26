import { ARMORY } from "./world.js?v=17";
import { CAPTAIN_SKILLS, drawSkills, learnSkill, skillAtRank } from "./skills.js?v=17";

export const TRADERS = {
  skills: {
    name: "Руна", title: "Лавка умений", greeting: "Решётка осталась в форте. Теперь я сама назначаю цену за уроки.",
    replies: [
      "Ловко схватил! В темнице я учила этому крысу, у неё ушла целая неделя.",
      "Если попробуешь это у Крюка, расскажи потом, какое у него было лицо.",
      "Монета чистая, урок честный. В этом порту это почти чудо.",
      "Держи. И да, я беру плату за то, что ты стал опаснее.",
      "У тебя неплохой вкус. Надеюсь, осталась монета на ужин.",
      "Попробуй при луне. Почти всё получается лучше, когда никто не видит.",
      "На волне этот трюк смотрится особенно хорошо. Главное, не выпусти саблю.",
      "Вот теперь я бы сама на тебя поставила. Пару дублонов, для начала.",
    ],
  },
  arms: {
    name: "Бранн", title: "Кузница", greeting: "Ствол на стол.", replies: ["Сталь держит.", "Теперь ровно.", "Бери.", "Подогнал."],
  },
  chests: {
    name: "Шкив", title: "Сундуки Шкива", greeting: "И-и? Ук-а!", replies: ["А-а! У-ук!", "Ик-ик! У-у!", "Ки-и! А-ак!", "У-у! И-и!"],
  },
};

const INTRO_STOCK = new Set(["gear-0", "gear-3", "parry", "brine-ward", "undertow", "left-pocket", "damp-flint"]);
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
        skill, price: SKILL_PRICES[skill.rank - 1] + skill.rarity * 3 }));
  }
  if (vendor === "chests") {
    return [{ id: "chest", title: "Запертый сундук", icon: "chest",
      detail: "Случайное новое умение или следующий ранг. После покупки цена вырастет на 8 дублонов.",
      price: availableSkills(player).length ? 14 + player.boxes * 8 : undefined }];
  }
  return [];
}

export function purchase(world, vendor, id) {
  if (world.map.key !== "port" || world.status !== "play" || !world.merchants.some(merchant => merchant.id === vendor)) return null;
  const p = world.player;
  const offer = offers(p, vendor).find(option => option.id === id);
  if (!offer?.price || p.coins < offer.price) return null;
  let skill = offer.skill;
  if (vendor === "chests") {
    const pool = availableSkills(p);
    [skill] = drawSkills(pool, world.lootRandom, 1);
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
