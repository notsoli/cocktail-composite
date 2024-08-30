import { default as App } from './app.js'

const Shaker = {
    localTypes: {
        'res': 'vec2f'
    },
    globalTypes: {
        'frame': 'f32'
    },
    async build(config) {
        // translate node names into their actual config objects
        const configs = App.configs

        // assemble local and global uniform lists
        const localUniforms = this.assembleUniformList(config.root, "locals", configs)
        const globalUniforms = this.assembleUniformList(config.root, "globals", configs)

        // begin assembling shader, insert required uniforms
        let shader = ""

        localUniforms.forEach((uniform, idx) => {
            const type = this.localTypes[uniform]
            if (type === undefined) console.error(`Unknown local uniform ${uniform}`)
            shader += `@group(1) @binding(${idx}) var<uniform> ${uniform}: ${type};\n`
        })

        globalUniforms.forEach((uniform, idx) => {
            const type = this.globalTypes[uniform]
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
        shader += this.assembleInlines(config.root, configs)

        shader += `return ${config.return};\n}\n`
        // console.log(shader)

        return shader
    },
    assembleUniformList(node, uniformType, configs, targetArray) {
        const uniformArray = (targetArray === undefined) ? [] : targetArray

        // recurse over children
        for (const child of node.children)
            this.assembleUniformList(child, uniformType, configs, uniformArray)

        // add new uniforms to array if not added already
        const config = configs[node.name]
        if (config[uniformType] !== undefined) {
            for (const uniform of config[uniformType]) {
                if (!uniformArray.includes(uniform)) uniformArray.push(uniform)
            }
        }

        return uniformArray
    },
    assembleInlines(node, configs) {
        let inlineString = ""

        // recurse over children
        for (const child of node.children)
            inlineString += this.assembleInlines(child, configs)

        // format inline expression and add it to string
        const config = configs[node.name]
        if (config.inline != undefined) {
            let newInline = config.inline
            newInline = this.formatInlineIO(newInline, node, config)
            newInline = this.formatInline(newInline, "$id{}", node.id)
            inlineString += newInline + "\n"
        }

        return inlineString
    },
    formatInlineIO(expression, node, config) {
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
    },
    formatInline(expression, keyString, value) {
        if (value === undefined) return expression

        let inline = expression
        while (inline.includes(keyString))
            inline = inline.replace(keyString, value)

        return inline
    }
}

export default Shaker