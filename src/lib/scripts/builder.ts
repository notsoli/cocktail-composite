import type { Node, Input } from './tree.svelte'
import type { NodeConfig, Type } from './config'

const localTypes: {[x: string]: Type} = {
    'res': 'vec2f'
}

const globalTypes: {[x: string]: Type} = {
    'frame': 'f32'
}

export function build(root: Node, returnValue: string, configs: {[x: string]: NodeConfig}) {
    // make sure root node exists
    if (root === null) return;

    // assemble local and global uniform lists
    const localUniforms = assembleUniformList(root, "locals", configs)
    const globalUniforms = assembleUniformList(root, "globals", configs)

    // begin assembling shader, insert required uniforms
    let shader = ""

    localUniforms.forEach((uniform, idx) => {
        const type = localTypes[uniform]
        if (type === undefined) console.error(`Unknown local uniform ${uniform}`)
        shader += `@group(1) @binding(${idx}) var<uniform> ${uniform}: ${type};\n`
    })

    globalUniforms.forEach((uniform, idx) => {
        const type = globalTypes[uniform]
        if (type === undefined) console.error(`Unknown global uniform ${uniform}`)
        shader += `@group(0) @binding(${idx}) var<uniform> ${uniform}: ${type};\n`
    })

    // insert needed functions
    for (const config in configs) {
        const configFunction = configs[config].function;
        if (configFunction !== undefined) shader += configs[config].function + "\n"
    }

    // begin assembling main function
    shader += "@fragment\nfn fragment_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {\n"

    // assemble inline expressions
    shader += assembleInlines(root, configs)

    // add return value
    shader += `return ${returnValue};\n}\n`

    return shader
}

function assembleUniformList(node: Node, uniformType: "locals" | "globals", configs: {[x: string]: NodeConfig}, targetArray?: string[]) {
    const uniformArray = (targetArray === undefined) ? [] : targetArray

    // recurse over children
    for (const child of node.children)
        assembleUniformList(child, uniformType, configs, uniformArray)

    // add new uniforms to array if not added already
    const config = configs[node.name];
    if (config[uniformType] !== undefined) {
        for (const uniform of config[uniformType]) {
            if (!uniformArray.includes(uniform)) uniformArray.push(uniform)
        }
    }

    return uniformArray
}

function assembleInlines(node: Node, configs: {[x: string]: NodeConfig}) {
    let inlineString = ""

    // recurse over children
    for (const child of node.children)
        inlineString += assembleInlines(child, configs)

    // format inline expression and add it to string
    const config = configs[node.name]
    if (config.inline != undefined) {
        let newInline = config.inline
        newInline = formatInlineIO(newInline, node, config)
        newInline = formatInline(newInline, "$id{}", node.id.toString())
        inlineString += newInline + "\n"
    }

    return inlineString
}

function formatInlineIO(expression: string, node: Node, config: NodeConfig) {
    let inline = expression

    if (config.inputs !== undefined) {
        for (const input_name in config.inputs) {
            const input = node.inputs[input_name]
            const keyString = "$i{" + input_name + "}"
            while (inline.includes(keyString))
                inline = inline.replace("$i{" + input_name + "}", formatInlineValue(input))
        }
    }

    for (const output_name in config.outputs) {
        const output = node.outputs[output_name] // if undefined, panic!!!!
        const keyString = "$o{" + output_name + "}"
        while(inline.includes(keyString))
            inline = inline.replace(keyString, output.text)
    }

    return inline
}

function formatInline(expression: string, keyString: string, value: string) {
    if (value === undefined) return expression

    let inline = expression
    while (inline.includes(keyString))
        inline = inline.replace(keyString, value)

    return inline
}

function formatInlineValue(input: Input) {
    // if a string, number, or array, coerce input value to a valid string
    if (typeof input.value === "string") return input.value;
    if (typeof input.value === "number") return input.value.toString();
    if (Array.isArray(input.value)) {
        if (input.data_type === "float")
            return `vec${input.value.length}f(${input.value.join(", ")})`;
        throw new Error("Invalid input data type");
    }

    // if linked to another node, get the value from the linked node
    if ("text" in input.value) return input.value.text;

    throw new Error("Invalid input value");
}

export function buildTemplate(returnValue: string) {
    // assemble local and global uniform lists
    const localUniforms = [ "res"]
    const globalUniforms = [ "frame" ]

    // begin assembling shader, insert required uniforms
    let shader = ""

    localUniforms.forEach((uniform, idx) => {
        const type = localTypes[uniform]
        if (type === undefined) console.error(`Unknown local uniform ${uniform}`)
        shader += `@group(1) @binding(${idx}) var<uniform> ${uniform}: ${type};\n`
    })

    globalUniforms.forEach((uniform, idx) => {
        const type = globalTypes[uniform]
        if (type === undefined) console.error(`Unknown global uniform ${uniform}`)
        shader += `@group(0) @binding(${idx}) var<uniform> ${uniform}: ${type};\n`
    })

    // begin assembling main function
    shader += "@fragment\nfn fragment_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {\n"

    // add return value
    shader += `return ${returnValue};\n}\n`

    return shader
}