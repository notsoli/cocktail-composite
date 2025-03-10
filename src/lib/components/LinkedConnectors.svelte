<script lang="ts">
    import { editor, type LinkedConnectors } from "$lib/scripts/editor.svelte";
    
    const { linkedConnectors } : { linkedConnectors: LinkedConnectors } = $props();
    
    let c1Rect = $state(linkedConnectors.c1.getBoundingClientRect());
    let c2Rect = $state(linkedConnectors.c2.getBoundingClientRect());

    const c1Position = $derived({ x: c1Rect.x + c1Rect.width / 2, y: c1Rect.y + c1Rect.height / 2 });
    const c2Position = $derived({ x: c2Rect.x + c2Rect.width / 2, y: c2Rect.y + c2Rect.height / 2 });

    $effect(() => {
        // make sure the linked connectors are updated when the selected effect changes,
        // since editor actions will push nodes around
        editor.selectedEffect;
        resetPositions();

        window.addEventListener("resize", resetPositions);
        return () => {
            window.removeEventListener("resize", resetPositions);
        };
    });

    function resetPositions() {
        c1Rect = linkedConnectors.c1.getBoundingClientRect();
        c2Rect = linkedConnectors.c2.getBoundingClientRect();
    }
</script>

<svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
    <line 
        x1={c1Position.x} 
        y1={c1Position.y} 
        x2={c2Position.x} 
        y2={c2Position.y}
        stroke="var(--accent-color)"
        stroke-width="4"
    />
</svg>