const unsplash = (id: string, width: number, height?: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}${height ? `&h=${height}&fit=crop` : ""}&q=75`

export const photos = {
  clouds: (w: number, h?: number) => unsplash("1506905925346-21bda4d32df4", w, h),
  concert: (w: number, h?: number) => unsplash("1514525253161-7a46d19cd819", w, h),
  turntable: (w: number, h?: number) => unsplash("1470225620780-dba8ba36b745", w, h),
  crowd: (w: number, h?: number) => unsplash("1493225457124-a3eb161ffa5f", w, h),
  underwater: (w: number, h?: number) => unsplash("1511593358241-7eea1f3c84e5", w, h),
}

export const gallery = [
  { id: "1501785888041-af3ef285b470", title: "Turquoise lake", tag: "Water", count: 24 },
  { id: "1470071459604-3b5ec3a7fe05", title: "Green ridge", tag: "Mountains", count: 18 },
  { id: "1500530855697-b586d89ba3ee", title: "Canyon road", tag: "Desert", count: 31 },
  { id: "1507525428034-b723cf961d3e", title: "Golden shore", tag: "Coast", count: 12 },
  { id: "1519681393784-d120267933ba", title: "Night sky", tag: "Night", count: 9 },
  { id: "1433086966358-54859d0ed716", title: "Waterfall", tag: "Forest", count: 27 },
  { id: "1493246507139-91e8fad9978e", title: "Mirror lake", tag: "Water", count: 15 },
  { id: "1464822759023-fed622ff2c3b", title: "Glacier valley", tag: "Mountains", count: 22 },
  { id: "1441974231531-c6227db76b6e", title: "Old forest", tag: "Forest", count: 19 },
].map((photo) => ({ ...photo, src: unsplash(photo.id, 640, 480) }))

export const moods = ["Mountains", "Coast", "Forest", "Night", "Water", "Desert"] as const
