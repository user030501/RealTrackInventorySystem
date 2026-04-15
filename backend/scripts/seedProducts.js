import { productsCollection, timestamp } from "../firebase.js";

function productThumbnail(label, category, accentFrom, accentTo) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeCategory = category
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accentFrom}" />
          <stop offset="100%" stop-color="${accentTo}" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="36" fill="url(#bg)" />
      <circle cx="186" cy="54" r="34" fill="rgba(255,255,255,0.14)" />
      <rect x="34" y="38" width="72" height="20" rx="10" fill="rgba(255,255,255,0.18)" />
      <rect x="34" y="82" width="172" height="96" rx="24" fill="rgba(7,12,27,0.24)" />
      <text x="34" y="198" fill="#ffffff" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${safeLabel}</text>
      <text x="34" y="220" fill="rgba(255,255,255,0.78)" font-size="14" font-family="Segoe UI, Arial, sans-serif">${safeCategory}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const sampleProducts = [
  {
    id: "sardines-555",
    productName: "555 Sardines",
    category: "Canned Goods",
    imageUrl: "/images/555Sardines.png",
    stockLevel: 36
  },
  {
    id: "lucky-me-pancit-canton",
    productName: "Lucky Me Pancit Canton",
    category: "Instant Noodles",
    imageUrl: "/images/LuckyMePancitCanton.png",
    stockLevel: 48
  },
  {
    id: "nissin-cup-noodles",
    productName: "Nissin Cup Noodles",
    category: "Instant Noodles",
    imageUrl: "/images/NissinCupNoodles.png",
    stockLevel: 20
  },
  {
    id: "purefoods-corned-beef",
    productName: "Purefoods Corned Beef",
    category: "Canned Goods",
    imageUrl: "/images/PurefoodsCornedBeef.png",
    stockLevel: 22
  },
  {
    id: "milo-sachet",
    productName: "Milo Sachet",
    category: "Coffee and Milk",
    imageUrl: "/images/MiloSachet.png",
    stockLevel: 75
  },
  {
    id: "nescafe-classic-sachet",
    productName: "Nescafe Classic Sachet",
    category: "Coffee and Milk",
    imageUrl: "/images/NescafeClassicSachet.png",
    stockLevel: 64
  },
  {
    id: "bear-brand-powdered-milk",
    productName: "Bear Brand Powdered Milk",
    category: "Coffee and Milk",
    imageUrl: "/images/BearBrandPowderedMilk.png",
    stockLevel: 28
  },
  {
    id: "coke-mismo",
    productName: "Coke Mismo",
    category: "Beverages",
    imageUrl: "/images/coke.png",
    stockLevel: 30
  },
  {
    id: "royal-tru-orange-can",
    productName: "Royal Tru-Orange Can",
    category: "Beverages",
    imageUrl: "/images/RoyalTru-OrangeCan.png",
    stockLevel: 20
  },
  {
    id: "nature-spring-water",
    productName: "Nature Spring Water",
    category: "Beverages",
    imageUrl: "/images/naturespringwater.png",
    stockLevel: 40
  },
  {
    id: "skyflakes-crackers",
    productName: "SkyFlakes Crackers",
    category: "Snacks and Biscuits",
    imageUrl: "/images/SkyFlakesCrackers.png",
    stockLevel: 31
  },
  {
    id: "fudgee-bar",
    productName: "Fudgee Bar",
    category: "Snacks and Biscuits",
    imageUrl: "/images/FudgeeBar.png",
    stockLevel: 52
  },
  {
    id: "piattos-cheese",
    productName: "Piattos Cheese",
    category: "Snacks and Biscuits",
    imageUrl: "/images/PiattosCheese.png",
    stockLevel: 18
  },
  {
    id: "rebisco-crackers",
    productName: "Rebisco Crackers",
    category: "Snacks and Biscuits",
    imageUrl: "/images/RebiscoCrackers.png",
    stockLevel: 27
  },
  {
    id: "surf-detergent-sachet",
    productName: "Surf Detergent Sachet",
    category: "Household Essentials",
    imageUrl: "/images/SurfDetergentSachet.png",
    stockLevel: 46
  },
  {
    id: "downy-fabric-conditioner-sachet",
    productName: "Downy Fabric Conditioner Sachet",
    category: "Household Essentials",
    imageUrl: "/images/DownyFabricConditionerSachet.png",
    stockLevel: 33
  },
  {
    id: "joy-dishwashing-liquid",
    productName: "Joy Dishwashing Liquid",
    category: "Household Essentials",
    imageUrl: "/images/JoyDishwashingLiquid.png",
    stockLevel: 14
  },
  {
    id: "safeguard-soap",
    productName: "Safeguard Soap",
    category: "Personal Care",
    imageUrl: "/images/SafeguardSoap.png",
    stockLevel: 26
  },
  {
    id: "colgate-toothpaste-small",
    productName: "Colgate Toothpaste Small",
    category: "Personal Care",
    imageUrl: "/images/ColgateToothpasteSmall.png",
    stockLevel: 19
  },
  {
    id: "palmolive-shampoo-sachet",
    productName: "Palmolive Shampoo Sachet",
    category: "Personal Care",
    imageUrl: "/images/PalmoliveShampooSachet.png",
    stockLevel: 58
  },
  {
    id: "champorado-mix",
    productName: "Champorado Mix",
    category: "Cooking Staples",
    imageUrl: "/images/ChamporadoMix.png",
    stockLevel: 11
  },
  {
    id: "rice-1kg",
    productName: "Rice 1kg",
    category: "Cooking Staples",
    imageUrl: "/images/Rice1kg.png",
    stockLevel: 16
  },
  {
    id: "brown-sugar-500g",
    productName: "Brown Sugar 500g",
    category: "Cooking Staples",
    imageUrl: "/images/BrownSugar500g.png",
    stockLevel: 13
  },
  {
    id: "soy-sauce-small",
    productName: "Soy Sauce Small",
    category: "Cooking Staples",
    imageUrl: "/images/SoySauceSmall.png",
    stockLevel: 21
  },
  {
    id: "vinegar-small",
    productName: "Vinegar Small",
    category: "Cooking Staples",
    imageUrl: "/images/VinegarSmall.png",
    stockLevel: 9
  }
];

async function seedProducts() {
  const batch = productsCollection.firestore.batch();
  const existingProducts = await productsCollection.get();

  for (const doc of existingProducts.docs) {
    batch.delete(doc.ref);
  }

  for (const product of sampleProducts) {
    const docRef = productsCollection.doc(product.id);

    batch.set(docRef, {
      category: product.category,
      imageUrl: product.imageUrl,
      productName: product.productName,
      stockLevel: product.stockLevel,
      lastUpdated: timestamp()
    });
  }

  await batch.commit();

  console.log(
    `Reset products collection and seeded ${sampleProducts.length} products into Firestore.`
  );
}

seedProducts().catch((error) => {
  console.error("Failed to seed products:", error.message);
  process.exitCode = 1;
});
