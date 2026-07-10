<script lang="ts">
  import { base } from "$app/paths";
</script>

<section class="space-y-10">
  <header class="max-w-3xl space-y-4">
    <p
      class="text-sm font-semibold uppercase tracking-[0.12em] text-orange-600"
    >
      Example app
    </p>
    <h1
      class="text-3xl font-medium tracking-tight text-neutral-950 md:text-2xl"
    >
      A real app shell for Gruntend agents.
    </h1>
    <p class="text-base leading-7 text-neutral-600">
      Restaurant data runs locally from seeded memory and can persist to
      Cloudflare D1. The agent produces code plans, runs app-owned tools, and
      returns compiled tagged-template UI.
    </p>
    <div class="flex flex-wrap gap-3 pt-2">
      <a
        class="bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700"
        href={`${base}/agent`}>Open agent</a
      >
      <a
        class="border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
        href={`${base}/menus`}
      >
        Browse menus
      </a>
    </div>
  </header>

  <section class="grid gap-4 md:grid-cols-3" aria-label="Application summary">
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">Tools</div>
      <h2 class="mt-3 text-lg font-semibold">App capabilities</h2>
      <p class="mt-1 text-neutral-600">
        Menus and users are exposed through app-owned Gruntend tools.
      </p>
    </article>
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">JS</div>
      <h2 class="mt-3 text-lg font-semibold">Code plans</h2>
      <p class="mt-1 text-neutral-600">
        Generated plans run through the sandboxed Gruntend runtime.
      </p>
    </article>
    <article class="border border-neutral-200 bg-white p-5">
      <div class="text-2xl font-semibold text-neutral-950">html</div>
      <h2 class="mt-3 text-lg font-semibold">Tagged templates</h2>
      <p class="mt-1 text-neutral-600">
        Generated UI uses <code>html</code> templates and delegated
        <code>data-gr-*</code> events.
      </p>
    </article>
  </section>
</section>
