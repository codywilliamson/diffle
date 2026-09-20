// Settings metadata shared by the modal and live Radar integration.
export const RADAR_MODE_EVENT = "loupe:radar-mode";

export const RADAR_MODE_OPTIONS = [
  { value: "off", label: "Off", badge: "private by default",
    description: "Hide Radar and run no review analysis or provider requests." },
  { value: "local", label: "Local only", badge: "no code leaves this machine",
    description: "Rank deterministic Git, syntax, path, and secret evidence without model calls." },
  { value: "jev", label: "Jev", badge: "bounded remote analysis",
    description: "Send redacted review packets to the OpenRouter or Cloudflare provider configured when Loupe starts." },
];
