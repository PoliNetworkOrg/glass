const unsplash = (id: string, width: number, height?: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}${height ? `&h=${height}&fit=crop` : ""}&q=75`

export const photos = {
  couch: (w: number, h?: number) => unsplash("1518791841217-8f162f1e1131", w, h),
  garden: (w: number, h?: number) => unsplash("1517331156700-3c241d2b4d83", w, h),
  sunglasses: (w: number, h?: number) => unsplash("1533738363-b7f9aef128ce", w, h),
  bandana: (w: number, h?: number) => unsplash("1543852786-1cf6624b9987", w, h),
  rolling: (w: number, h?: number) => unsplash("1511044568932-338cba0ad803", w, h),
}

export const gallery = [
  { id: "1570018144715-43110363d70a", title: "Three of a kind", tag: "Kittens", count: 24 },
  { id: "1573865526739-10659fec78a5", title: "Golden hour", tag: "Ginger", count: 18 },
  { id: "1494256997604-768d1f608cac", title: "Blanket fort", tag: "Sleepy", count: 31 },
  { id: "1514888286974-6c03e2ca1dba", title: "Tuxedo at the ledge", tag: "Silly", count: 12 },
  { id: "1526336024174-e58f5cdd8e13", title: "A butterfly friend", tag: "Fluffy", count: 9 },
  { id: "1491485880348-85d48a9e5312", title: "Chair inspector", tag: "Tabby", count: 27 },
  { id: "1561948955-570b270e7c36", title: "Plot twist", tag: "Silly", count: 15 },
  { id: "1555685812-4b943f1cb0eb", title: "Sofa explorer", tag: "Kittens", count: 22 },
  { id: "1472491235688-bdc81a63246e", title: "Blue eyes", tag: "Fluffy", count: 19 },
].map((photo) => ({ ...photo, src: unsplash(photo.id, 640, 480) }))

export const moods = ["Kittens", "Tabby", "Ginger", "Fluffy", "Sleepy", "Silly"] as const
