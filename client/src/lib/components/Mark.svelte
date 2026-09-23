<script lang="ts">
  // diffle "hunk" mark — a code tile with the line under review highlighted. themes via
  // currentColor (frame + context lines) and var(--accent) (the reviewed band).
  let { size = 24, animated = false }: { size?: number; animated?: boolean } = $props();
</script>

<svg class="mark" class:animated width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <rect x="4" y="4" width="24" height="24" rx="6.5" stroke="currentColor" stroke-width="2" />
  <rect class="line" x="8.5" y="9" width="11" height="2.75" rx="1.375" fill="currentColor" fill-opacity="0.55" />
  <rect class="band" x="7" y="13.75" width="18" height="4.5" rx="2.25" fill="var(--accent)" />
  <rect class="line late" x="8.5" y="20.25" width="7.5" height="2.75" rx="1.375" fill="currentColor" fill-opacity="0.55" />
</svg>

<style>
  .mark {
    flex: none;
  }
  .animated rect {
    transform-box: fill-box;
    transform-origin: 0% 50%;
  }
  .animated .line {
    animation: draw-line 2.4s cubic-bezier(0.2, 0.9, 0.25, 1) infinite;
  }
  .animated .late {
    animation-delay: 0.1s;
  }
  .animated .band {
    animation: sweep-band 2.4s cubic-bezier(0.2, 0.9, 0.25, 1) infinite;
  }
  @keyframes draw-line {
    0% { transform: scaleX(0); opacity: 1; }
    20%, 75% { transform: none; opacity: 1; }
    90%, 100% { transform: none; opacity: 0; }
  }
  @keyframes sweep-band {
    0%, 18% { transform: scaleX(0); opacity: 1; }
    40%, 75% { transform: none; opacity: 1; }
    90%, 100% { transform: none; opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .animated rect {
      animation: none;
    }
  }
</style>
