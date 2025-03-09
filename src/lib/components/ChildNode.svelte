<script lang="ts">
    import { tree, formatOutputToColor, type Node } from "$lib/scripts/tree.svelte";
    import { build } from "$lib/scripts/builder";
    import { editor } from "$lib/scripts/editor.svelte";
    import { createPass, removePass, type Pass } from "devolute";
    import OutputConnector from "./parameters/OutputConnector.svelte";

    const { node }: { node: Node } = $props();

    let canvas: HTMLCanvasElement;

    $effect(() => {
        // set canvas dimensions
        canvas.width = 100;
        canvas.height = 100;

        // generate a fragment shader
        const returnValue = formatOutputToColor(node.outputs[Object.keys(node.outputs)[0]]);
        const frag = build(node, returnValue, tree.configs);
        if (!frag) return;

        // create a pass
        let pass: Pass;
        createPass({
            canvas,
            uniforms: {
                res: { type: "vec2f", value: [ 100, 100 ] }
            },
            fragment: frag
        }).then((passInfo) => {
            pass = passInfo.pass;
        });

        // remove the pass when the node or configs change
        return () => {
            removePass(pass);
        };
    });
</script>

<div
    class="node"
    role="button" tabindex=0
    onclick={() => {editor.focusedNode = node}}
    onkeypress={(e) => {if (e.key === "Enter") editor.focusedNode = node}}
>
    <div class="node-connectors">
        {#each Object.values(node.outputs) as output}
            <OutputConnector {output} />
        {/each}
    </div>
    <h2>{node.display_name}</h2>
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .node {
        display: flex;
        position: relative;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        border: var(--border-width) solid var(--accent-color);
        border-radius: var(--large-radius);
        min-width: 10rem;
        height: 10rem;
        padding: var(--medium-gap);
        cursor: pointer;
    }

    canvas {
        width: 100px;
        height: 100px;
    }

    .node-connectors {
        position: absolute;
        top: 0;
        margin-top: calc( -0.5em - var(--border-width) );
        display: flex;
        justify-content: space-around;
        width: 100%;
    }
</style>