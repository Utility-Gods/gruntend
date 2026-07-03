<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<a class="back" href="/menus">← Menus</a>

<section class="page-heading">
  <p class="eyebrow">{data.menu.menuId}</p>
  <h1>{data.menu.name}</h1>
  <p>{data.menu.description}</p>
</section>

<section class="panel">
  <h2>Menu items</h2>
  <div class="items">
    {#each data.items as item}
      <article>
        <div>
          <h3>{item.name}</h3>
          <p>{item.tags.join(" · ") || "No tags"}</p>
        </div>
        <strong>${item.price.toFixed(2)}</strong>
      </article>
    {/each}
  </div>
</section>

<section class="panel agent-hint">
  <h2>Try the agent</h2>
  <p>
    Ask the agent to copy this menu to a new one, add vegetarian items, or create a user. The agent will call the same
    API through Gruntend handlers.
  </p>
  <a class="button" href="/agent">Open agent</a>
</section>

<style>
  .back {
    display: inline-flex;
    color: var(--color-primary-700);
    margin-bottom: 1.25rem;
    font-weight: 800;
    text-decoration: none;
  }

  .page-heading {
    margin-bottom: 2rem;
  }

  .items {
    display: grid;
    gap: 0.9rem;
  }

  article {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: 0.9rem;
    padding: 1rem 1.15rem;
    background: var(--color-surface-soft);
  }

  h3 {
    margin: 0 0 0.35rem;
  }

  article p {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: 1.55;
  }

  strong {
    color: var(--color-primary-700);
    white-space: nowrap;
  }

  .agent-hint {
    margin-top: 1.25rem;
  }
</style>
