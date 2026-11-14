import type { Service } from "./model";
export const demoCategories = [
  "Water adventure",
  "Air adventure",
  "Water adventure",
  "Mountain trek",
  "Air adventure",
  "Water adventure",
  "Camping & outdoors",
  "Land adventure",
  "Air adventure",
  "Mountain trek",
];
const corrections = [
  {
    id: "s6",
    name: "Camping by the Ganges",
    before: "Air adventure",
    after: "Camping & outdoors",
  },
  {
    id: "s7",
    name: "Rock Climbing",
    before: "Water adventure",
    after: "Land adventure",
  },
  {
    id: "s8",
    name: "Flying Fox",
    before: "Mountain trek",
    after: "Air adventure",
  },
  {
    id: "s9",
    name: "Valley Nature Walk",
    before: "Air adventure",
    after: "Mountain trek",
  },
];
export function correctDemoCategories(services: Service[]) {
  return services.map((service) => {
    const correction = corrections.find(
      (c) =>
        c.id === service.id &&
        c.name === service.name &&
        c.before === service.category,
    );
    return correction ? { ...service, category: correction.after } : service;
  });
}
export function categoryLabel(category: string) {
  if (category === "Water adventure") return "Water";
  if (category === "Air adventure") return "Air";
  if (category === "Mountain trek") return "Trek";
  if (category === "Land adventure") return "Land";
  if (category === "Camping & outdoors") return "Outdoors";
  return category;
}

const demoNames = [
  "River Rafting · 16 km",
  "Bungee Jumping",
  "Kayaking",
  "Kedarkantha Trek",
  "Zipline Adventure",
  "River Rafting · 24 km",
  "Camping by the Ganges",
  "Rock Climbing",
  "Flying Fox",
  "Valley Nature Walk",
];
export function addDemoServiceImages(services: Service[]) {
  return services.map((service) => {
    const index = demoNames.findIndex(
      (name, i) => service.id === `s${i}` && service.name === name,
    );
    return index >= 0 &&
      service.imageUrl === undefined &&
      service.thumbnailUrl === undefined
      ? {
          ...service,
          imageUrl: `/images/services/s${index}.svg`,
          thumbnailUrl: `/images/services/s${index}-thumb.svg`,
        }
      : service;
  });
}
