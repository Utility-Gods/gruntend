<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>Gruntend Kitchen</title>
</svelte:head>

<div class="shell">
  <header>
    <a class="brand" href="/">Gruntend Kitchen</a>
    <nav aria-label="Main navigation">
      <a href="/menus">Menus</a>
      <a href="/users">Users</a>
      <a href="/agent">Agent</a>
    </nav>
  </header>

  {@render children()}
</div>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 36rem),
      #0f172a;
    color: #e5e7eb;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  :global(a) {
    color: inherit;
  }

  :global(button),
  :global(input),
  :global(select),
  :global(textarea) {
    font: inherit;
  }

  .shell {
    width: min(1120px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 24px 0 64px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 40px;
  }

  .brand {
    text-decoration: none;
    font-weight: 900;
    letter-spacing: -0.04em;
    font-size: 1.35rem;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  nav a {
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 999px;
    padding: 8px 13px;
    color: #cbd5e1;
    text-decoration: none;
  }

  nav a:hover {
    border-color: rgba(56, 189, 248, 0.7);
    color: #e0f2fe;
  }

  :global(.eyebrow) {
    margin: 0 0 8px;
    color: #38bdf8;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  :global(h1) {
    margin: 0 0 16px;
    font-size: clamp(2.2rem, 6vw, 4.5rem);
    line-height: 1;
    letter-spacing: -0.07em;
  }

  :global(h2) {
    margin-top: 0;
  }

  :global(p) {
    color: #cbd5e1;
    line-height: 1.65;
  }

  :global(.panel) {
    background: rgba(15, 23, 42, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 24px;
    padding: 22px;
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.28);
  }

  :global(.grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  :global(.button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 14px;
    background: #38bdf8;
    color: #082f49;
    padding: 11px 16px;
    font-weight: 900;
    text-decoration: none;
    cursor: pointer;
  }

  :global(.muted) {
    color: #94a3b8;
  }
</style>
