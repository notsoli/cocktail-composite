<script lang="ts">
    import type { NumberInputConfig } from "$lib/scripts/config";
    import type { NumberInput } from "$lib/scripts/tree.svelte";
    const { input, config } : { input: NumberInput, config: NumberInputConfig } = $props();

    function modifyValue(target: EventTarget & HTMLInputElement) {
        // Check if the new value is valid
        const floatForm = parseFloat(target.value);
        if (!isNaN(floatForm)) input.value = floatForm;
        // if not, revert to the previous value
        else target.value = input.value.toString();
    }

    function modifyValueArray(target: EventTarget & HTMLInputElement, index: number) {
        // Make sure the input value is a number and within bounds
        if (!Array.isArray(input.value))
            throw new Error("Input value is not an array");
        if (index < 0 || index >= input.value.length)
            throw new Error("Index out of bounds");

        // Check if the new value is valid
        const floatForm = parseFloat(target.value);
        if (!isNaN(floatForm)) input.value[index] = floatForm;
        // if not, revert to the previous value
        else target.value = input.value[index].toString();
    }
</script>

<div>
    {#if typeof input.value === "number"}
        <input
            aria-label="x" placeholder="x" type="number"
            defaultValue={input.value}
            onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
            onblur={(e) => modifyValue(e.currentTarget)}
        />
    {:else if Array.isArray(input.value)}
        {#if input.value.length >= 1}
            <input
                aria-label="x" placeholder="x" type="number"
                defaultValue={input.value[0]}
                onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
                onblur={(e) => modifyValueArray(e.currentTarget, 0)}
            />
        {/if}
        {#if input.value.length >= 2}
            <input
                aria-label="y" placeholder="y" type="number"
                defaultValue={input.value[1]}
                onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
                onblur={(e) => modifyValueArray(e.currentTarget, 1)}
            />
        {/if}
        {#if input.value.length >= 3}
            <input
                aria-label="z" placeholder="z" type="number"
                defaultValue={input.value[2]}
                onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
                onblur={(e) => modifyValueArray(e.currentTarget, 2)}
            />
        {/if}
        {#if input.value.length >= 4}
            <input
                aria-label="w" placeholder="w" type="number"
                defaultValue={input.value[3]}
                onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
                onblur={(e) => modifyValueArray(e.currentTarget, 3)}
            />
        {/if}
    {/if}
</div>

<style>
    div {
        display: flex;
        gap: 0.5rem;
    }

    input {
        width: 3rem;
        border-radius: var(--small-radius);
        border: var(--border-width) solid var(--accent-color);
        background-color: var(--darker-accent-color);
        color: var(--background-color);
        padding: 0.1rem 0.2rem;
        font-size: var(--small-text);
    }

    ::placeholder {
        opacity: 0.5;
    }

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        display: none;
        -webkit-appearance: none;
        margin: 0;
    }
</style>