// Reusable sendMessage option objects for grammY
export const HTML_OPTIONS = {
  parse_mode: "HTML" as const,
};

export const HTML_NO_PREVIEW = {
  parse_mode: "HTML" as const,
  link_preview_options: { is_disabled: true },
};
