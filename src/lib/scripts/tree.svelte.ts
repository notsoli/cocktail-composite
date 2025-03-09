// Type imports
import type { Type, NumberType, NodeConfig } from './config'

// State
export const tree: Config = $state({
    root: null,
    configs: {}
});

// Variables
let node_id = 0;

// Types
export type Config = {
    root: Node | null
    configs: {[x: string]: NodeConfig}
}

export type Node = {
    id: number
    name: string
    display_name: string
    inputs: {[x: string]: Input}
    outputs: {[x: string]: Output}
    children: Node[]
}

export type DisplayInput = {
    input_type: "display"
    data_type: Type
    value: string | Output
    display_name: string
}

export type NumberInput = {
    input_type: "number"
    data_type: NumberType
    value: number | number[] | Output
    display_name: string
}

export type Input = DisplayInput | NumberInput

export type Output = {
    data_type: Type
    text: string
    display_name: string
}

/**
 * Creates a new `Node` from a node config.
 * @todo change the name of this function
 * 
 * @param nodeid The ID for the new node
 * @param config The new node's `NodeConfig`
 * @returns The new node
 */
export function formatNodeConfig(nodeid: number, config: NodeConfig): Node {
    const inputs: {[x: string]: Input} = {}
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs) {
            const input_config = config.inputs[input_name]
            const name = (input_config.display_name) ? input_config.display_name : input_name

            if (input_config.input_type === "display") {
                const new_input: DisplayInput = {
                    data_type: input_config.data_type,
                    input_type: "display",
                    value: input_config.default,
                    display_name: name
                }

                inputs[input_name] = new_input;
            } else {
                // Create copy of default value if it's an array
                // as to not modify the default value in the config
                const value = (Array.isArray(input_config.default)) ?
                    [ ...input_config.default ] : input_config.default;

                const new_input: NumberInput = {
                    data_type: input_config.data_type,
                    input_type: "number",
                    value,
                    display_name: name
                }

                inputs[input_name] = new_input;
            }
        }
    }
  
    const outputs: {[x: string]: Output} = {}
    for (const output_name in config.outputs) {
        const output_config = config.outputs[output_name]
        const name = (output_config.display_name) ? output_config.display_name : output_name
        outputs[output_name] = {
            data_type: output_config.data_type,
            text: `${output_name}_${nodeid}`,
            display_name: name
        };
    }
  
    return {
        id: nodeid, name: config.name,
        display_name: config.display_name ?? config.name,
        inputs, outputs, children: []
    }
}

/**
 * Transforms a specified type (f32, vec2f, vec3f, and vec4f)
 * into one that can be displayed as an output color (`vec4`).
 * 
 * @param output The output to convert
 * @returns A string representing a `vec4` that can be used as an output color
 */
export function formatOutputToColor(output: Output) {
    switch (output.data_type) {
        case "f32":
            return `vec4f(vec3f(${output.text}), 1.)`
        case "vec2f":
            return `vec4f(${output.text}, 0., 1.)`
        case "vec3f":
            return `vec4f(${output.text}, 1.)`
        case "vec4f":
            return output.text
    }
}

/**
 * Converts a `DisplayInput` to a color format.
 * 
 * @param input The input to convert
 * @returns A string representing a `vec4` that can be used as an output color
 */
export function formatDisplayInputToColor(input: DisplayInput) {
    if (typeof input.value !== "string") return formatOutputToColor(input.value);
    switch (input.data_type) {
        case "f32":
            return `vec4f(vec3f(${input.value}), 1.)`
        case "vec2f":
            return `vec4f(${input.value}, 0., 1.)`
        case "vec3f":
            return `vec4f(${input.value}, 1.)`
        case "vec4f":
            return input.value
    }
}

/**
 * Recursively searches for a node by its ID within a tree structure.
 * @param id The ID of the node to search for
 * @param root The root node of the tree
 * @returns The found node or null if not found
 */
export function getParentNode(node: Node, root: Node): Node | null {
    for (const child of root.children) {
        if (child.id === node.id) return root;
        const parent = getParentNode(node, child);
        if (parent) return parent
    }

    return null;
}

export function addParentNode(child: Node, config: NodeConfig): Node {
    if (!tree.root) throw new Error("Tree root is null");
    const new_node = formatNodeConfig(node_id++, config);
    if (tree.root.id === child.id) {
        // child is root, add new node as root
        new_node.children.push(child);
        tree.root = new_node;
        return tree.root;
    } else {
        // child is not root, insert new node between parent and child
        const parent = getParentNode(child, tree.root);
        if (!parent) throw new Error("Parent node not found");

        parent.children.filter(c => c.id !== child.id);
        new_node.children.push(child);
        parent.children = [...parent.children, new_node];
        return parent.children[parent.children.length - 1];
    }
}

/**
 * Adds a child node to a parent node in the tree, or the root if the parent is the root.
 * @param parent 
 * @param config 
 */
export function addChildNode(parent: Node | null, config: NodeConfig): Node {
    const new_node = formatNodeConfig(node_id++, config);
    if (!parent) {
        // parent is null, add new node as root
        tree.root = new_node;
        return tree.root;
    } else {
        parent.children = [...parent.children, new_node];
        return parent.children[parent.children.length - 1];
    }
}

/**
 * Removes a node from the tree and returns the parent node.
 * @param node The node to remove
 * @returns If successful, the parent node or null if the root was removed.
 * If unsuccessful, null.
 */
export function removeNode(node: Node): Node | null {
    if (!tree.root) return null;
    if (tree.root && node.id === tree.root.id) {
        if (node.children.length == 0) {
            // root node has no children, clear tree
            tree.root = null;
            return null;
        } else if (node.children.length == 1) {
            // root node has one child, set child as new root
            tree.root = node.children[0];
            return tree.root;
        } else {
            // root node has multiple children, do nothing
            return node;
        }
    }

    // find parent node
    const parent = getParentNode(node, tree.root);
    if (!parent) return node;
    
    // assemble list of output text values to search for later
    const node_output_texts = [];
    for (const output_name in node.outputs)
        node_output_texts.push(node.outputs[output_name].text);

    // if any inputs in parent are linked to the removed node, unlink them
    for (const input_name in parent.inputs) {
        const input = parent.inputs[input_name];

        // make sure input is linked to the removed node
        if (typeof input.value === "object" && "text" in input.value && 
            node_output_texts.includes(input.value.text)) {

            // set input value to default
            const config = tree.configs[parent.name];
            const input_config = config.inputs![input_name];
            input.value = input_config.default;
        }
    }

    // remove node from parent
    parent.children = parent.children.filter(c => c.id !== node.id);

    // add children of removed node to parent
    parent.children = [...parent.children, ...node.children];

    return parent;
}

/**
 * Checks if two data types are compatible for linking.
 * 
 * @param input The input to check
 * @param output The output to check
 * @returns True if the data types are compatible, false otherwise
 */
export function isCompatible(input: Input, output: Output): boolean {
    if (input.data_type === output.data_type) return true;

    if (typeof input.value === "number") {
        if (input.data_type === "float" && output.data_type === "f32") return true;
    }

    if (Array.isArray(input.value)) {
        if (input.data_type === "float" && input.value.length == 2 && output.data_type === "vec2f") return true;
        if (input.data_type === "float" && input.value.length == 3 && output.data_type === "vec3f") return true;
        if (input.data_type === "float" && input.value.length == 4 && output.data_type === "vec4f") return true;
    }

    if (typeof input.value === "object" && "text" in input.value) {
        if (input.value.data_type === output.data_type) return true;
    }

    return false;
}