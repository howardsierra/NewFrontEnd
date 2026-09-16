// SillyTavern UI Theme builder (targets ST 1.18.0).
// Exported JSON imports via User Settings → Theme → Import.

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ThemeDraft {
  name: string;
  // Colors
  mainText: string;
  italicsText: string;
  underlineText: string;
  quoteText: string;
  blurTint: string;
  chatTint: string;
  userMesBlurTint: string;
  botMesBlurTint: string;
  shadowColor: string;
  borderColor: string;
  // Numbers
  blurStrength: number;
  shadowWidth: number;
  fontScale: number;
  chatWidth: number;
  // Toggles
  noShadows: boolean;
  reducedMotion: boolean;
  compactInputArea: boolean;
  hotswapEnabled: boolean;
  timestampsEnabled: boolean;
  timestampModelIcon: boolean;
  messageTokenCountEnabled: boolean;
  expandMessageActions: boolean;
  // Custom CSS
  customCss: string;
}

export const DEFAULT_THEME: ThemeDraft = {
  name: "My Theme",
  mainText: "rgba(220, 220, 210, 1)",
  italicsText: "rgba(145, 145, 145, 1)",
  underlineText: "rgba(188, 231, 207, 1)",
  quoteText: "rgba(225, 138, 36, 1)",
  blurTint: "rgba(23, 23, 23, 1)",
  chatTint: "rgba(23, 23, 23, 1)",
  userMesBlurTint: "rgba(30, 30, 30, 0.9)",
  botMesBlurTint: "rgba(30, 30, 30, 0.9)",
  shadowColor: "rgba(0, 0, 0, 1)",
  borderColor: "rgba(0, 0, 0, 1)",
  blurStrength: 10,
  shadowWidth: 2,
  fontScale: 1,
  chatWidth: 50,
  noShadows: false,
  reducedMotion: false,
  compactInputArea: true,
  hotswapEnabled: true,
  timestampsEnabled: true,
  timestampModelIcon: true,
  messageTokenCountEnabled: false,
  expandMessageActions: false,
  customCss: "",
};

/** Build a full, importable SillyTavern theme object. */
export function buildTheme(d: ThemeDraft): Record<string, unknown> {
  return {
    name: d.name,
    blur_strength: d.blurStrength,
    main_text_color: d.mainText,
    italics_text_color: d.italicsText,
    underline_text_color: d.underlineText,
    quote_text_color: d.quoteText,
    blur_tint_color: d.blurTint,
    chat_tint_color: d.chatTint,
    user_mes_blur_tint_color: d.userMesBlurTint,
    bot_mes_blur_tint_color: d.botMesBlurTint,
    shadow_color: d.shadowColor,
    shadow_width: d.shadowWidth,
    border_color: d.borderColor,
    font_scale: d.fontScale,
    fast_ui_mode: false,
    waifuMode: false,
    avatar_style: 0,
    chat_display: 0,
    noShadows: d.noShadows,
    chat_width: d.chatWidth,
    timer_enabled: false,
    timestamps_enabled: d.timestampsEnabled,
    timestamp_model_icon: d.timestampModelIcon,
    mesIDDisplay_enabled: false,
    hideChatAvatars_enabled: false,
    message_token_count_enabled: d.messageTokenCountEnabled,
    expand_message_actions: d.expandMessageActions,
    enableZenSliders: "",
    enableLabMode: "",
    hotswap_enabled: d.hotswapEnabled,
    custom_css: d.customCss,
    bogus_folders: true,
    reduced_motion: d.reducedMotion,
    compact_input_area: d.compactInputArea,
  };
}

export function parseTheme(json: any, fallbackName = "Imported Theme"): ThemeDraft {
  const d: ThemeDraft = { ...DEFAULT_THEME, name: fallbackName };
  const str = (v: any, def: string) => (typeof v === "string" ? v : def);
  const num = (v: any, def: number) => (typeof v === "number" ? v : def);
  const bool = (v: any, def: boolean) => (typeof v === "boolean" ? v : def);
  if (typeof json.name === "string") d.name = json.name;
  d.mainText = str(json.main_text_color, d.mainText);
  d.italicsText = str(json.italics_text_color, d.italicsText);
  d.underlineText = str(json.underline_text_color, d.underlineText);
  d.quoteText = str(json.quote_text_color, d.quoteText);
  d.blurTint = str(json.blur_tint_color, d.blurTint);
  d.chatTint = str(json.chat_tint_color, d.chatTint);
  d.userMesBlurTint = str(json.user_mes_blur_tint_color, d.userMesBlurTint);
  d.botMesBlurTint = str(json.bot_mes_blur_tint_color, d.botMesBlurTint);
  d.shadowColor = str(json.shadow_color, d.shadowColor);
  d.borderColor = str(json.border_color, d.borderColor);
  d.blurStrength = num(json.blur_strength, d.blurStrength);
  d.shadowWidth = num(json.shadow_width, d.shadowWidth);
  d.fontScale = num(json.font_scale, d.fontScale);
  d.chatWidth = num(json.chat_width, d.chatWidth);
  d.noShadows = bool(json.noShadows, d.noShadows);
  d.reducedMotion = bool(json.reduced_motion, d.reducedMotion);
  d.compactInputArea = bool(json.compact_input_area, d.compactInputArea);
  d.hotswapEnabled = bool(json.hotswap_enabled, d.hotswapEnabled);
  d.timestampsEnabled = bool(json.timestamps_enabled, d.timestampsEnabled);
  d.timestampModelIcon = bool(json.timestamp_model_icon, d.timestampModelIcon);
  d.messageTokenCountEnabled = bool(json.message_token_count_enabled, d.messageTokenCountEnabled);
  d.expandMessageActions = bool(json.expand_message_actions, d.expandMessageActions);
  d.customCss = str(json.custom_css, d.customCss);
  return d;
}

/* -------------------- rgba <-> hex helpers -------------------- */

export function parseRgba(s: string): RgbaColor {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i.exec(s || "");
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  }
  const hex = /^#?([0-9a-f]{6})$/i.exec((s || "").trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export function rgbaToCss(c: RgbaColor): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

export function rgbaToHex(c: RgbaColor): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function themeFilename(name: string): string {
  const safe = name.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe || "theme"}.json`;
}
