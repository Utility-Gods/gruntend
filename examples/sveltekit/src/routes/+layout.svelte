<script lang="ts">
  import AppShell from "$lib/components/photoship/AppShell.svelte";
  import { Toaster } from "svelte-sonner";
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Gruntend Kitchen | Generated UI Demo</title>
  <meta
    name="description"
    content="Try interpreted JavaScript plans, typed application capabilities, and task-specific generated UI with Gruntend."
  />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="application-name" content="Gruntend Kitchen" />
  <link rel="canonical" href="https://demo.gruntend.com/" />
  <meta name="theme-color" content="#ff5a1f" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="Gruntend" />
  <meta property="og:title" content="Gruntend Kitchen | Generated UI Demo" />
  <meta
    property="og:description"
    content="Try interpreted JavaScript plans, typed application capabilities, and task-specific generated UI with Gruntend."
  />
  <meta property="og:url" content="https://demo.gruntend.com/" />
  <meta property="og:image" content="https://demo.gruntend.com/og-image.png" />
  <meta
    property="og:image:secure_url"
    content="https://demo.gruntend.com/og-image.png"
  />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="Gruntend Kitchen — try the live Gruntend demo"
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Gruntend Kitchen | Generated UI Demo" />
  <meta
    name="twitter:description"
    content="Try interpreted JavaScript plans, typed application capabilities, and task-specific generated UI with Gruntend."
  />
  <meta name="twitter:image" content="https://demo.gruntend.com/og-image.png" />
  <meta
    name="twitter:image:alt"
    content="Gruntend Kitchen — try the live Gruntend demo"
  />
</svelte:head>

<AppShell>
  {@render children()}
</AppShell>

<Toaster
  position="top-right"
  theme="light"
  closeButton
  duration={5000}
  offset={24}
  toastOptions={{ class: "juniper-toast", unstyled: true }}
/>
