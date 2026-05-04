const cache = new Map<string, HTMLImageElement>();

export function loadSprite(src: string): HTMLImageElement {
  if (cache.has(src)) return cache.get(src)!;
  const img = new Image();
  img.src = src;
  cache.set(src, img);
  return img;
}

export const ROLE_CHAR_SPRITE: Record<string, string> = {
  intake: '/sprites/characters/char_0.png',
  'wiki-curator': '/sprites/characters/char_1.png',
  pm: '/sprites/characters/char_2.png',
  builder: '/sprites/characters/char_3.png',
  qa: '/sprites/characters/char_4.png',
  designer: '/sprites/characters/char_5.png',
};

// Preload all sprites used by the office
export function preloadOfficeSprites(): void {
  const paths = [
    ...Object.values(ROLE_CHAR_SPRITE),
    '/sprites/floors/floor_0.png',
    '/sprites/floors/floor_2.png',
    '/sprites/floors/floor_3.png',
    '/sprites/floors/floor_4.png',
    '/sprites/floors/floor_5.png',
    '/sprites/furniture/DESK_FRONT.png',
    '/sprites/furniture/PC_FRONT_ON_1.png',
    '/sprites/furniture/PLANT.png',
    '/sprites/furniture/LARGE_PLANT.png',
    '/sprites/furniture/SOFA_BACK.png',
    '/sprites/furniture/SOFA_FRONT.png',
    '/sprites/furniture/BOOKSHELF.png',
    '/sprites/furniture/WHITEBOARD.png',
    '/sprites/furniture/COFFEE_TABLE.png',
    '/sprites/furniture/CACTUS.png',
    '/sprites/furniture/CLOCK.png',
  ];
  paths.forEach(loadSprite);
}
