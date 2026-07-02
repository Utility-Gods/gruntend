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
    color: #bae6fd;
    margin-bottom: 18px;
    text-decoration: none;
  }

  .page-heading {
    margin-bottom: 24px;
  }

  .items {
    display: grid;
    gap: 12px;
  }

  article {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 18px;
    padding: 14px 16px;
    background: rgba(2, 6, 23, 0.45);
  }

  h3 {
    margin: 0 0 4px;
  }

  article p {
    margin: 0;
    color: #94a3b8;
  }

  strong {
    color: #e0f2fe;
    white-space: nowrap;
  }

  .agent-hint {
    margin-top: 16px;
  }
</style>
