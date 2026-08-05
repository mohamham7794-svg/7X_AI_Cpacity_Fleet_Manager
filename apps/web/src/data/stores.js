// store_id values are deliberately identical to apps/web/src/App.jsx's
// STORES list, so once real events flow into the backend, an order placed
// here and the driver-requirement/hiring-plan shown on the ops console are
// talking about the exact same store.

// Real food photography, swapped in for the placeholder emoji icons.
// Only stores with a genuine matching photo get `image` — the rest keep
// their emoji `icon` as a fallback (components check for `image` first).
import grillIcon from "../assets/icons/grill.png";
import croissantIcon from "../assets/icons/croissant.png";
import juiceIcon from "../assets/icons/juice.png";
import burgerIcon from "../assets/icons/burger.png";

export const STORES = [
  {
    store_id: "AUH-014",
    name: "Mussafah Grill House",
    area: "Abu Dhabi · Mussafah",
    cuisine: "Grills & Shawarma",
    rating: 4.6,
    etaMinutes: [20, 30],
    icon: "🔥",
    image: grillIcon,
    tint: "#FFF1EC",
    menu: [
      { id: "m1", name: "Mixed Grill Platter", desc: "Lamb, chicken, kofta, rice", price: 42, icon: "🍢" },
      { id: "m2", name: "Chicken Shawarma Wrap", desc: "Garlic sauce, pickles", price: 14, icon: "🌯" },
      { id: "m3", name: "Hummus & Grilled Bread", desc: "Olive oil, sumac", price: 11, icon: "🥙" },
      { id: "m4", name: "Charcoal Kofta Skewers", desc: "3 skewers, chili sauce", price: 26, icon: "🍡" },
      { id: "m5", name: "Fresh Mint Lemonade", desc: "500ml, no sugar option", price: 9, icon: "🥤" },
    ],
  },
  {
    store_id: "DXB-002",
    name: "Al Quoz Noodle Bar",
    area: "Dubai · Al Quoz",
    cuisine: "Asian · Noodles",
    rating: 4.8,
    etaMinutes: [18, 26],
    icon: "🍜",
    tint: "#E9FBF4",
    menu: [
      { id: "n1", name: "Spicy Dan Dan Noodles", desc: "Peanut chili oil", price: 32, icon: "🍜" },
      { id: "n2", name: "Chicken Gyoza (6pc)", desc: "Pan-fried, ponzu", price: 24, icon: "🥟" },
      { id: "n3", name: "Beef Pad See Ew", desc: "Wide rice noodles", price: 36, icon: "🍝" },
      { id: "n4", name: "Miso Soup", desc: "Tofu, scallion", price: 12, icon: "🍲" },
      { id: "n5", name: "Iced Thai Tea", desc: "Condensed milk", price: 13, icon: "🧋" },
    ],
  },
  {
    store_id: "SHJ-007",
    name: "Industrial 6 Bakery",
    area: "Sharjah · Industrial 6",
    cuisine: "Bakery & Breakfast",
    rating: 4.5,
    etaMinutes: [15, 22],
    icon: "🥐",
    image: croissantIcon,
    tint: "#FFF6E5",
    menu: [
      { id: "b1", name: "Cheese Manakish", desc: "Fresh from the oven", price: 8, icon: "🫓" },
      { id: "b2", name: "Croissant Duo", desc: "Butter + almond", price: 16, icon: "🥐" },
      { id: "b3", name: "Shakshuka Box", desc: "Two eggs, side bread", price: 24, icon: "🍳" },
      { id: "b4", name: "Karak Chai (2x)", desc: "Extra strong", price: 10, icon: "☕" },
      { id: "b5", name: "Date & Walnut Loaf", desc: "Sliced, 300g", price: 19, icon: "🍞" },
    ],
  },
  {
    store_id: "AUH-021",
    name: "Khalifa City Deli",
    area: "Abu Dhabi · Khalifa City",
    cuisine: "Sandwiches & Salads",
    rating: 4.4,
    etaMinutes: [22, 32],
    icon: "🥪",
    image: burgerIcon,
    tint: "#FFF1EC",
    menu: [
      { id: "d1", name: "Roast Turkey Club", desc: "Sourdough, bacon", price: 29, icon: "🥪" },
      { id: "d2", name: "Halloumi Salad Bowl", desc: "Pomegranate dressing", price: 27, icon: "🥗" },
      { id: "d3", name: "Soup of the Day", desc: "Ask about today's", price: 17, icon: "🍵" },
      { id: "d4", name: "Cold Brew Coffee", desc: "350ml, oat milk +2", price: 14, icon: "🧊" },
      { id: "d5", name: "Chocolate Brownie", desc: "Warm, single slice", price: 12, icon: "🍫" },
    ],
  },
  {
    store_id: "AJM-003",
    name: "Al Jurf Juice & Wraps",
    area: "Ajman · Al Jurf",
    cuisine: "Juice & Light Bites",
    rating: 4.7,
    etaMinutes: [16, 24],
    icon: "🧃",
    image: juiceIcon,
    tint: "#E9FBF4",
    menu: [
      { id: "j1", name: "Avocado Power Wrap", desc: "Grilled chicken", price: 25, icon: "🌯" },
      { id: "j2", name: "Mango Passion Juice", desc: "Fresh pressed, 500ml", price: 15, icon: "🥭" },
      { id: "j3", name: "Falafel Bowl", desc: "Tahini, tabbouleh", price: 22, icon: "🧆" },
      { id: "j4", name: "Green Detox Smoothie", desc: "Spinach, apple, ginger", price: 17, icon: "🥬" },
      { id: "j5", name: "Protein Energy Balls", desc: "Box of 4", price: 13, icon: "🍬" },
    ],
  },
];

export function findStore(storeId) {
  return STORES.find((s) => s.store_id === storeId);
}
