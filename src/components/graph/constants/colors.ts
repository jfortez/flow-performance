// Graph Colors - Centralized color constants for the graph visualization
// These colors are used consistently across the graph components

// Node Colors
export const NODE_FILL_DEFAULT = "#E3F2FD";
export const NODE_FILL_SELECTED = "#A5D6A7";
export const NODE_BORDER_DEFAULT = "#1976D2";
export const NODE_BORDER_MATCH = "#FFC107";
export const NODE_BORDER_HOVERED = "rgba(255, 215, 0, 0.9)";
export const NODE_BORDER_CONNECTED = "#9370DB";
export const NODE_BORDER_LINK_CONNECTED = "#22C55E";

// Link/Edge Colors
export const LINK_STROKE_DEFAULT = "rgba(100, 100, 100, 0.4)";
export const LINK_STROKE_DIMMED = "rgba(150, 150, 150, 0.1)";
export const LINK_STROKE_CONNECTED = "rgba(147, 112, 219, 0.9)";
export const LINK_STROKE_HOVERED = "rgba(34, 197, 94, 0.9)";
export const LINK_STROKE_SELECTED = "rgba(34, 197, 94, 0.6)"; // Verde sutil para seleccionado

// Shadow/Glow Colors
export const LINK_SHADOW_CONNECTED = "rgba(147, 112, 219, 0.6)";
export const LINK_SHADOW_HOVERED = "rgba(34, 197, 94, 0.5)";
export const LINK_SHADOW_SELECTED = "rgba(34, 197, 94, 0.3)";
export const NODE_SHADOW_CONNECTED = "rgba(147, 112, 219, 0.5)";
export const NODE_SHADOW_LINK_CONNECTED = "rgba(34, 197, 94, 0.5)";
export const SHADOW_TRANSPARENT = "transparent";

// Selection Ring Colors
export const SELECTION_RING_STROKE = "#22C55E";
export const SELECTION_RING_FILL = "rgba(34, 197, 94, 0.2)";

// Label Colors
export const LABEL_TEXT_DEFAULT = "#1F2937";
export const LABEL_TEXT_SELECTED = "#16A34A";
export const LABEL_TEXT_CONNECTED = "#9370DB";
export const LABEL_BACKGROUND_HOVERED = "rgba(255, 255, 255, 1)";
export const LABEL_BACKGROUND_DEFAULT = "rgba(255, 255, 255, 0.95)";

// Level Ring Colors (concentric circles)
export const LEVEL_RING_STROKE = (level: number): string => `rgba(200, 200, 200, ${0.3 - level * 0.04})`;
export const LEVEL_LABEL_FILL = (level: number): string => `rgba(150, 150, 150, ${0.7 - level * 0.1})`;

// Badge Colors
export const BADGE_FILL_ROOT = "#7B1FA2";
export const BADGE_FILL_CHILD = "#3B82F6";
export const BADGE_FILL_CONNECTED = "#9370DB";
export const BADGE_STROKE = "white";
export const BADGE_TEXT = "white";

// Child Count Badge
export const CHILD_COUNT_FILL = "#10B981";
export const CHILD_COUNT_TEXT = "white";

// Expand/Collapse Button
export const EXPAND_BUTTON_FILL = "rgba(255, 255, 255, 0.9)";
export const EXPAND_BUTTON_STROKE = "#64748b";

// Opacity Values
export const OPACITY_DIMMED = 0.25;
export const OPACITY_FULL = 1;

// Line Widths (base values, will be divided by transform.k in rendering)
export const LINE_WIDTH_THIN = 0.5;
export const LINE_WIDTH_DEFAULT = 1;
export const LINE_WIDTH_MEDIUM = 1.2;
export const LINE_WIDTH_THICK = 1.5;
export const LINE_WIDTH_BOLD = 2;
export const LINE_WIDTH_EXTRA_BOLD = 2.5;
export const LINE_WIDTH_HEAVY = 3;
export const LINE_WIDTH_SELECTION = 3;
export const LINE_WIDTH_HOVER = 4;

// Shadow Blur Values (base values, will be divided by transform.k in rendering)
export const SHADOW_BLUR_DEFAULT = 10;
export const SHADOW_BLUR_LARGE = 12;

// Font Sizes (base values, will be divided by transform.k in rendering)
export const FONT_SIZE_SMALL = 8;
export const FONT_SIZE_DEFAULT = 9;
export const FONT_SIZE_MEDIUM = 10;
export const FONT_SIZE_LARGE = 11;

// Thresholds
export const HOVER_THRESHOLD = 8;
export const ZOOM_THRESHOLD_LABELS = 0.5;
export const ZOOM_THRESHOLD_CHILD_COUNT = 0.6;
export const ZOOM_THRESHOLD_EXPAND_BUTTON = 0.6;
export const ZOOM_THRESHOLD_NODE_LABELS = 0.7;

// Dash Patterns (base values, will be divided by transform.k in rendering)
export const DASH_PATTERN_LEVEL_RING = [5, 5];
