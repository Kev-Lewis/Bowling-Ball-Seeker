import type { ManufacturerBallInput } from "../types/catalog";

export const mockMotivCatalogs: Record<string, ManufacturerBallInput[]> = {
  baseline: [
    {
      id: "motiv-venom-shock",
      canonicalName: "Venom Shock",
      brand: "Motiv",
      manufacturer: "Motiv",
      coverstockName: "Turmoil MFS",
      coverstockType: "solid",
      coreName: "Gear APG",
      coreType: "symmetric",
      factoryFinish: "4000 Grit LSS",
      rg: 2.48,
      differential: 0.034,
      mbDifferential: 0,
      availableWeights: [12, 13, 14, 15, 16],
      officialUrl:
        "https://www.motivbowling.com/products/balls/light-medium-oil/venom-shock.html",
      imageUrl: "",
    },
  ],

  new: [
    {
      id: "motiv-venom-shock",
      canonicalName: "Venom Shock",
      brand: "Motiv",
      manufacturer: "Motiv",
      coverstockName: "Turmoil MFS",
      coverstockType: "solid",
      coreName: "Gear APG",
      coreType: "symmetric",
      factoryFinish: "4000 Grit LSS",
      rg: 2.48,
      differential: 0.034,
      mbDifferential: 0,
      availableWeights: [12, 13, 14, 15, 16],
      officialUrl:
        "https://www.motivbowling.com/products/balls/light-medium-oil/venom-shock.html",
      imageUrl: "",
    },
    {
      id: "motiv-example-new-ball",
      canonicalName: "Example New Ball",
      brand: "Motiv",
      manufacturer: "Motiv",
      coverstockName: "Example Reactive",
      coverstockType: "pearl",
      coreName: "Example Core",
      coreType: "symmetric",
      factoryFinish: "4000 Grit",
      rg: 2.5,
      differential: 0.04,
      mbDifferential: 0,
      availableWeights: [14, 15, 16],
      officialUrl: "",
      imageUrl: "",
    },
  ],

  changed: [
    {
      id: "motiv-venom-shock",
      canonicalName: "Venom Shock",
      brand: "Motiv",
      manufacturer: "Motiv",
      coverstockName: "Turmoil MFS",
      coverstockType: "solid",
      coreName: "Gear APG",
      coreType: "symmetric",
      factoryFinish: "3000 Grit LSS",
      rg: 2.48,
      differential: 0.034,
      mbDifferential: 0,
      availableWeights: [12, 13, 14, 15, 16],
      officialUrl:
        "https://www.motivbowling.com/products/balls/light-medium-oil/venom-shock.html",
      imageUrl: "",
    },
  ],

  removed: [],
};