<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-10">
  <header class="max-w-3xl space-y-4">
    <p class="text-sm font-semibold uppercase tracking-[0.12em] text-orange-600">Example app</p>
    <h1 class="text-3xl font-medium tracking-tight text-neutral-950 md:text-2xl">A real app shell for Gruntend agents.</h1>
    <p class="text-base leading-7 text-neutral-600">
      Restaurant data is persisted in SQLite. The agent produces code plans, runs app-owned tools, and returns hydrated
      hypermedia controls.
    </p>
    <div class="flex flex-wrap gap-3 pt-2">
      <a class="bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700" href="/agent">Open agent</a>
      <a class="border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100" href="/menus">
        Browse menus
      </a>
    </div>
  </header>

  <section class="grid gap-4 md:grid-cols-3" aria-label="Application summary">
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">{data.menus.length}</div>
      <h2 class="mt-3 text-lg font-semibold">Menus</h2>
      <p class="mt-1 text-neutral-600">Live menus backed by SQLite and exposed through app tools.</p>
    </article>
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">{data.users.length}</div>
      <h2 class="mt-3 text-lg font-semibold">Team members</h2>
      <p class="mt-1 text-neutral-600">Users are available to both normal pages and code-plan handlers.</p>
    </article>
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">HTML</div>
      <h2 class="mt-3 text-lg font-semibold">Hypermedia</h2>
      <p class="mt-1 text-neutral-600">The chat hydrates semantic <code>gr-href</code> controls returned from runtime results.</p>
    </article>
  </section>
</section>
