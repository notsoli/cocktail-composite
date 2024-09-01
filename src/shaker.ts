import { default as App } from './app.js'

import { Node, Config } from './app.js'
import { NodeConfig } from './configs.js'

const localTypes: {[x: string]: string} = {
    'res': 'vec2f'
}

const globalTypes: {[x: string]: string} = {
    'frame': 'f32'
}

async function build(config: Config) {
    // translate node names into their actual config objects
    const configs = App.configs

    // assemble local and global uniform lists
    const localUniforms = assembleUniformList(config.root, "locals", configs)
    const globalUniforms = assembleUniformList(config.root, "globals", configs)

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
        const configFunction = configs[config].function
        if (configFunction !== undefined) shader += configs[config].function + "\n"
    }

    // begin assembling main function
    shader += "@fragment\nfn fragment_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {\n"

    // assemble inline expressions
    shader += assembleInlines(config.root, configs)

    shader += `return ${config.return};\n}\n`
    // console.log(shader)

    return shader
}

function assembleUniformList(node: Node, uniformType: "locals" | "globals", configs: {[x: string]: NodeConfig}, targetArray?: string[]) {
    const uniformArray = (targetArray === undefined) ? [] : targetArray

    // recurse over children
    for (const child of node.children)
        assembleUniformList(child, uniformType, configs, uniformArray)

    // add new uniforms to array if not added already
    const config = configs[node.name]
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
            const input_config = config.inputs[input_name]
            const value = (node.inputs[input_name] !== undefined)
                ? node.inputs[input_name] : input_config.default
            const keyString = "$i{" + input_name + "}"
            while (inline.includes(keyString))
                inline = inline.replace("$i{" + input_name + "}", value)
        }
    }

    for (const output_name in config.outputs) {
        const value = node.outputs[output_name] // if undefined, panic!!!!
        const keyString = "$o{" + output_name + "}"
        while(inline.includes(keyString))
            inline = inline.replace(keyString, value)
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

const Shaker = {
    build
}

export default Shaker