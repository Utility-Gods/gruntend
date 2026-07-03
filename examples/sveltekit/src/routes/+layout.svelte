<script lang="ts">
  import AppShell from "$lib/components/photoship/AppShell.svelte";
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Gruntend Kitchen</title>
</svelte:head>

<AppShell>
  {@render children()}
</AppShell>
