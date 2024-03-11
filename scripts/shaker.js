const Shaker = {
    localTypes: {
        'res': 'vec2f'
    },
    globalTypes: {
        'frame': 'f32'
    },
    async build(config) {
        // translate node names into their actual config objects
        const configs = await this.loadConfigs(config.root)

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
        console.log(shader)

        return shader
    },
    async loadConfigs(node, targetObject) {
        const configObject = (targetObject === undefined) ? {} : targetObject

        // recurse over children
        for (const child of node.children)
            await this.loadConfigs(child, configObject)

        // load configs based on element name if not added already
        if (configObject[node.name] === undefined) {
            const configText = await fetch(`../configs/${node.name}.json`)
            const config = await configText.json()
            configObject[node.name] = config
        }

        return configObject
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
            newInline = this.formatInline(newInline, "#", node.inputs)
            newInline = this.formatInline(newInline, "$", node.outputs)
            inlineString += newInline + "\n"
        }

        return inlineString
    },
    formatInline(expression, keyChar, values) {
        if (values === undefined || values.length == 0) return expression

        let inline = expression
        while(inline.includes(keyChar))
            inline = inline.replace(keyChar, values.shift())

        return inline
    }
}

export default Shaker