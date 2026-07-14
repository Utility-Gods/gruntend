<script lang="ts">
  import { page } from "$app/state";
  import LoadingSurface from "$lib/components/photoship/LoadingSurface.svelte";
  import type { OrderStatus } from "$lib/types";
  import { ClipboardList, Search, UsersRound } from "@lucide/svelte";
  import {
    getOrders,
    getUsers,
    updateOrderStatusCommand,
  } from "$lib/remote/example.remote";

  const ordersResponse = $derived(getOrders().current);
  const usersResponse = $derived(getUsers().current);
  const orders = $derived(ordersResponse?.orders ?? []);
  const usersById = $derived(
    new Map((usersResponse?.users ?? []).map((user) => [user.userId, user])),
  );

  let status = $state<OrderStatus | "all">("all");
  let search = $state("");
  let updatingOrderId = $state("");
  let updateError = $state("");

  const visibleOrders = $derived(
    orders.filter((order) => {
      const query = search.trim().toLowerCase();
      return (
        (status === "all" || order.status === status) &&
        (!query ||
          order.orderId.toLowerCase().includes(query) ||
          order.tableName.toLowerCase().includes(query) ||
          order.customer.name.toLowerCase().includes(query) ||
          order.lines.some((line) =>
            line.itemName.toLowerCase().includes(query),
          ))
      );
    }),
  );
  const changedOrderIds = $derived(
    new Set(
      (page.url.searchParams.get("changed") ?? "").split(",").filter(Boolean),
    ),
  );
  const paidRevenue = $derived(
    orders.reduce(
      (total, order) =>
        total + (order.payment?.status === "paid" ? order.payment.amount : 0),
      0,
    ),
  );

  const statuses = ["all", "open", "preparing", "served", "cancelled"] as const;

  function customerOrderCount(customerId: string): number {
    return orders.filter((order) => order.customerId === customerId).length;
  }

  function nextStatus(current: OrderStatus): OrderStatus | undefined {
    if (current === "open") return "preparing";
    if (current === "preparing") return "served";
    return undefined;
  }

  async function advanceOrder(orderId: string, current: OrderStatus) {
    const next = nextStatus(current);
    if (!next || updatingOrderId) return;
    updatingOrderId = orderId;
    updateError = "";
    try {
      await updateOrderStatusCommand({ orderId, status: next }).updates(
        getOrders(),
      );
    } catch (caught) {
      updateError =
        caught instanceof Error
          ? caught.message
          : "Unable to update the order.";
    } finally {
      updatingOrderId = "";
    }
  }
</script>

<section class="space-y-5">
  <header
    class="flex flex-col justify-between gap-3 py-1 sm:flex-row sm:items-center"
  >
    <div class="flex min-w-0 items-center gap-3">
      <ClipboardList
        class="shrink-0 text-primary-600"
        size={23}
        strokeWidth={2.2}
      />
      <div class="min-w-0">
        <h1 class="text-xl font-semibold tracking-tight text-slate-950">
          Orders
        </h1>
        <p class="mt-0.5 text-xs text-neutral-500">
          {orders.length} sample orders · ${paidRevenue.toFixed(2)} paid revenue
          in this dataset
        </p>
      </div>
    </div>
    <label class="relative block w-full sm:w-72">
      <span class="sr-only">Search orders</span>
      <Search
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        size={16}
      />
      <input
        bind:value={search}
        class="h-10 w-full border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        placeholder="Customer, table, or item"
      />
    </label>
  </header>

  {#if !ordersResponse}
    <LoadingSurface label="Loading orders from D1..." rows={6} />
  {:else}
    <div
      class="flex overflow-x-auto border border-neutral-200 bg-white p-1 shadow-sm"
      aria-label="Filter orders"
    >
      {#each statuses as option}
        <button
          type="button"
          class={`shrink-0 px-3 py-2 text-xs font-semibold capitalize ${status === option ? "bg-primary-600 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          onclick={() => (status = option)}
        >
          {option}
          <span class="ml-1 opacity-75"
            >{option === "all"
              ? orders.length
              : orders.filter((order) => order.status === option).length}</span
          >
        </button>
      {/each}
    </div>

    {#if updateError}<p
        class="border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {updateError}
      </p>{/if}

    <div class="grid gap-3 lg:grid-cols-2">
      {#each visibleOrders as order}
        <article
          class={`min-w-0 border bg-white p-4 shadow-sm ${changedOrderIds.has(order.orderId) ? "border-emerald-500 ring-2 ring-emerald-100" : "border-neutral-200"}`}
        >
          <div
            class="flex items-start justify-between gap-4 border-b border-neutral-100 pb-3"
          >
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-bold text-slate-950">
                  {order.tableName}
                </h2>
                <span
                  class={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${order.status === "served" ? "bg-emerald-100 text-emerald-800" : order.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-orange-100 text-primary-800"}`}
                  >{order.status}</span
                >
              </div>
              <p class="mt-1 break-words text-xs text-neutral-500">
                {order.orderId} · {order.serviceType} · {new Date(
                  order.createdAt,
                ).toLocaleString()}
              </p>
            </div>
            <strong class="text-base text-primary-700"
              >${order.total.toFixed(2)}</strong
            >
          </div>

          <div class="grid gap-3 py-3 text-xs sm:grid-cols-2">
            <div class="flex items-start gap-2">
              <UsersRound class="mt-0.5 text-neutral-400" size={14} />
              <div>
                <p class="font-semibold text-slate-900">
                  {order.customer.name}
                </p>
                <p class="capitalize text-neutral-500">
                  {order.customer.loyaltyTier} loyalty · {customerOrderCount(
                    order.customerId,
                  )} orders in this dataset
                </p>
              </div>
            </div>
            <div>
              <p class="font-semibold text-slate-900">
                {usersById.get(order.assignedUserId)?.name ??
                  order.assignedUserId}
              </p>
              <p class="capitalize text-neutral-500">
                Assigned {usersById.get(order.assignedUserId)?.role ?? "staff"} ·
                party of {order.partySize}
              </p>
              {#if order.table}<p class="mt-0.5 capitalize text-neutral-500">
                  {order.table.section} · {order.table.seats} seats
                </p>{/if}
            </div>
          </div>

          <ul
            class="space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600"
          >
            {#each order.lines as line}
              <li class="flex min-w-0 justify-between gap-4">
                <span class="min-w-0 break-words"
                  >{line.quantity}× {line.itemName}</span
                ><span class="tabular-nums"
                  >${(line.unitPrice * line.quantity).toFixed(2)}</span
                >
              </li>
            {/each}
          </ul>

          {#if order.payment}
            <p
              class="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500"
            >
              Payment: <span class="font-semibold capitalize text-slate-800"
                >{order.payment.status} · {order.payment.method}</span
              >
              {#if order.payment.tip > 0}
                · ${order.payment.tip.toFixed(2)} tip{/if}
            </p>
          {/if}

          {#if nextStatus(order.status)}
            <button
              type="button"
              class="mt-4 border border-primary-600 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-600 hover:text-white disabled:opacity-50"
              disabled={updatingOrderId === order.orderId}
              onclick={() => advanceOrder(order.orderId, order.status)}
            >
              {updatingOrderId === order.orderId
                ? "Updating..."
                : `Mark ${nextStatus(order.status)}`}
            </button>
          {/if}
        </article>
      {:else}
        <p
          class="border border-neutral-200 bg-white p-6 text-sm text-neutral-500 lg:col-span-2"
        >
          No orders match this filter.
        </p>
      {/each}
    </div>
  {/if}
</section>
