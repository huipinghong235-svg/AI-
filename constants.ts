
import { StylePreset } from './types';

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    description: '霓虹灯光、机械零件和未来感光泽。',
    prompt: 're-imagined in high-tech cyberpunk style, glowing neon accents, mechanical detailing, futuristic dark metal textures, synthwave aesthetics.',
    previewUrl: 'https://picsum.photos/seed/cyber/200/200'
  },
  {
    id: '3d-render',
    name: '3D 皮克斯',
    description: '柔和光效、洁净表面和可爱的3D比例。',
    prompt: 'transformed into a high-quality 3D clay render, Pixar animation style, soft studio lighting, vibrant colors, matte finish, whimsical proportions.',
    previewUrl: 'https://picsum.photos/seed/pixar/200/200'
  },
  {
    id: 'steampunk',
    name: '蒸汽朋克',
    description: '黄铜、齿轮和维多利亚时代的机械感。',
    prompt: 'converted to steampunk machinery, brass and copper gears, steam pipes, Victorian industrial aesthetic, leather textures, sepia-toned metals.',
    previewUrl: 'https://picsum.photos/seed/steam/200/200'
  },
  {
    id: 'golden',
    name: '皇家金饰',
    description: '精美的金箔、珠宝和神圣的工艺。',
    prompt: 'crafted from solid gold and ivory, encrusted with glowing sapphire gems, intricate filigree, divine royal craftsmanship, shimmering reflections.',
    previewUrl: 'https://picsum.photos/seed/gold/200/200'
  },
  {
    id: 'sketch',
    name: '大师素描',
    description: '细腻的铅笔线条和艺术感的排线。',
    prompt: 'rendered as a professional architectural pencil sketch, detailed cross-hatching, graphite textures, artistic shading on vintage parchment paper.',
    previewUrl: 'https://picsum.photos/seed/sketch/200/200'
  },
  {
    id: 'mecha',
    name: '机甲战士',
    description: '重型装甲、军用镀层和机器人设计。',
    prompt: 'transformed into a heavy tactical mecha robot, military grade armor plating, hydraulic systems, industrial grey and orange safety highlights.',
    previewUrl: 'https://picsum.photos/seed/mecha/200/200'
  }
];
