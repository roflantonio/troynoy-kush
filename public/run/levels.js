export const WIDTH = 960;
export const HEIGHT = 480;
export const FLOOR = 393;
export const COLORS = ["#ffb55c", "#56e6d5", "#c49eff", "#ff82a6"];
const ground = (from, to, y = FLOOR, kind = "") => ({ x: from, y, w: to - from, h: 125, kind });
const ledge = (x, y, w, kind = "") => ({ x, y, w, h: 17, kind });

export const LEVELS = [
  {
    name: "Неоновые крыши", hint: "Разгоняйся перед провалами. Маяк посередине запомнит прогресс.",
    sky: ["#141b3a", "#41466e"], shade: "#283654", block: "#44567b", rim: "#6cb7ca", light: "#ffc982",
    length: 2870, flag: 2675, check: [1260, 367], decoration: "city",
    solids: [
      ground(0, 390), ground(508, 811, 376), ground(931, 1484, 367),
      ground(1609, 1880), ground(2010, 2270, 373), ground(2392, 2870, 360),
      ledge(232, 330, 89), ledge(622, 305, 91), ledge(1092, 312, 58),
      ledge(1730, 331, 82), ledge(2114, 304, 59), ledge(2480, 285, 73),
    ],
    traps: [{ x: 1390, y: 347, range: 53, rate: 3.5 }, { x: 2180, y: 353, range: 44, rate: 4 }],
    lifts: [],
  },
  {
    name: "Энергоканал", hint: "Синие ленты ускоряют, розовые тянут назад.",
    sky: ["#082c3d", "#2b6783"], shade: "#15536e", block: "#386783", rim: "#4bd9e6", light: "#62f0e0",
    length: 3100, flag: 2910, check: [1627, 383], decoration: "canal",
    solids: [
      ground(0, 250), ground(250, 536, FLOOR, "forward"), ground(671, 1065, 379, "reverse"),
      ground(1190, 1828, 383), ground(1970, 2254, 369, "forward"),
      ground(2400, 2668, 363, "reverse"), ground(2792, 3100, 378),
      ledge(300, 325, 101), ledge(871, 316, 110), ledge(1420, 322, 101),
      ledge(2073, 291, 87), ledge(2480, 302, 99),
    ],
    traps: [{ x: 1370, y: 365, range: 70, rate: 3 }, { x: 2508, y: 345, range: 61, rate: 4 }],
    lifts: [],
  },
  {
    name: "Сады на высоте", hint: "Золотые пружины подбрасывают выше обычного прыжка.",
    sky: ["#20384b", "#6aa890"], shade: "#296555", block: "#397568", rim: "#8be4a1", light: "#fbe785",
    length: 3100, flag: 2890, check: [1630, 363], decoration: "garden",
    solids: [
      ground(0, 264), ground(264, 383, FLOOR, "spring"), ground(543, 812, 291),
      ground(954, 1188, 350), ground(1188, 1390, 350, "spring"),
      ground(1470, 1890, 363), ground(1961, 2195, 325), ground(2195, 2293, 325, "spring"),
      ground(2468, 2755, 237), ground(2868, 3100, 287),
      ledge(638, 225, 105), ledge(1047, 287, 77), ledge(1732, 302, 61), ledge(2031, 263, 75), ledge(2576, 176, 89),
    ],
    traps: [{ x: 715, y: 274, range: 32, rate: 3 }, { x: 1748, y: 345, range: 41, rate: 4.1 }],
    lifts: [],
  },
  {
    name: "Башня маяка", hint: "Смотри на движущиеся платформы. После последнего портала — финиш.",
    sky: ["#242040", "#70567d"], shade: "#584566", block: "#6b547d", rim: "#df9dca", light: "#ffca9a",
    length: 3335, flag: 3125, check: [1666, 363], decoration: "tower",
    solids: [
      ground(0, 390), ground(505, 789, 363), ground(906, 1145, 348),
      ground(1296, 1900, 363), ground(2056, 2296, 330),
      ground(2440, 2685, 349), ground(2823, 3335, 329),
      ledge(239, 325, 72), ledge(612, 291, 75), ledge(981, 281, 63),
      ledge(1479, 300, 114), ledge(2184, 270, 76), ledge(2540, 286, 75), ledge(2981, 261, 68),
    ],
    traps: [
      { x: 692, y: 344, range: 25, rate: 4.2 }, { x: 1544, y: 344, range: 60, rate: 4.1 },
      { x: 2597, y: 330, range: 55, rate: 4.7 }, { x: 2960, y: 310, range: 47, rate: 4.4 },
    ],
    lifts: [{ x: 1172, y: 392, w: 82, h: 17, range: 43, rate: 2.7 },
      { x: 1932, y: 370, w: 97, h: 17, range: 42, rate: 3 }],
  },
];
