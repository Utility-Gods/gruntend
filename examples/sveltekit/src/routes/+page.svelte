<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const itemCountHint = "Open the menus route to inspect nested items served by API routes.";
</script>

<section class="hero">
  <p class="eyebrow">Example app</p>
  <h1>A real-ish app for Gruntend agents.</h1>
  <p>
    This SvelteKit app has seeded restaurant data, API routes, normal pages, and an agent route that asks an LLM for
    Gruntend code plans through the SDK boundary.
  </p>
  <div class="actions">
    <a class="button" href="/agent">Open agent</a>
    <a class="secondary" href="/menus">Browse menus</a>
  </div>
</section>

<section class="grid stats" aria-label="Application summary">
  <article class="panel">
    <span>{data.menus.length}</span>
    <h2>Menus</h2>
    <p>{itemCountHint}</p>
  </article>
  <article class="panel">
    <span>{data.users.length}</span>
    <h2>Users</h2>
    <p>Seeded users are available through <code>/api/users</code> and Gruntend tools.</p>
  </article>
  <article class="panel">
    <span>LLM</span>
    <h2>Generation seam</h2>
    <p>The agent route calls pi-ai/OpenAI on the server, then executes the generated plan through Gruntend tools.</p>
  </article>
</section>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin-top: 1.5rem;
  }
</style>
