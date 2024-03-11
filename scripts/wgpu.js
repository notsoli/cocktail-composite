function Pass(ctx, renderPipeline, vertexBuffer, data={}, customBindGroup=null) {
    this.ctx = ctx
    this.renderPipeline = renderPipeline
    this.vertexBuffer = vertexBuffer
    this.data = data
    this.customBindGroup = customBindGroup
}

function Uniform(index, size) {
    this.index = index
    this.values = new Float32Array(size)
    this.buffer = device.createBuffer({
        size: size * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
}

let device, update, defaultBindGroupLayout, pipelineLayout, bindGroup
const passes = [], data = {}

const WGPU = {
    async init(uniforms) {
        if (!navigator.gpu) { throw Error("WebGPU not supported.") }
        
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) { throw Error("Couldn't request WebGPU adapter.") }

        device = await adapter.requestDevice()

        const proxy = new Proxy(uniforms, { set: modifyUniform })

        const bindGroupLayoutEntries = [], bindGroupEntries = []
        Object.entries(uniforms).forEach((entry, index) => {
            const key = entry[0]
            const value = entry[1]

            const size = Array.isArray(value) ? value.length : 1
            const arrayForm = Array.isArray(value) ? value : [value]

            bindGroupLayoutEntries[index] = {
                binding: index,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }

            data[key] = new Uniform(index, size)
            data[key].values.set(arrayForm)
            bindGroupEntries[index] = { binding: index, resource: { buffer: data[key].buffer }}
        })

        defaultBindGroupLayout = device.createBindGroupLayout({
            entries: bindGroupLayoutEntries })
        pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ defaultBindGroupLayout ] })

        bindGroup = device.createBindGroup({
            layout: defaultBindGroupLayout,
            entries: bindGroupEntries
        })

        return proxy
    },
    async create_pass(config) {
        const hasUniforms = (config.uniforms != undefined)

        const vertex = `
            @vertex
            fn vertex_main(@location(0) pos : vec2f) ->  @builtin(position) vec4f {
                return vec4f(pos, 0., 1.); 
            }
        `

        const shaderModule = device.createShaderModule({
            code: vertex + config.fragment })

        const ctx = config.canvas.getContext("webgpu")
        ctx.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "premultiplied",
        })

        const verts = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            1.0, 1.0,
            1.0, 1.0,
            -1.0, 1.0,
            -1.0, -1.0
        ])

        // create & configure vertex buffer
        const vertexBuffer = device.createBuffer({
            size: verts.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(vertexBuffer, 0, verts, 0, verts.length)

        const vertexBuffers = [
            {
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x2"}
                ],
                arrayStride: 8,
                stepMode: "vertex",
            },
        ]

        let newPipelineLayout = pipelineLayout
        let customBindGroup, passData = {}
        if (hasUniforms) {
            const bindGroupLayoutEntries = [], bindGroupEntries = []
            Object.entries(config.uniforms).forEach((entry, index) => {
                const key = entry[0]
                const value = entry[1]
    
                const size = Array.isArray(value) ? value.length : 1
                const arrayForm = Array.isArray(value) ? value : [value]
    
                bindGroupLayoutEntries[index] = {
                    binding: index,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
    
                const newUniform = new Uniform(index, size)
                passData[key] = newUniform
                const values = newUniform.values
                values.set(arrayForm)
                bindGroupEntries[index] = { binding: index, resource: { buffer: newUniform.buffer }}
            })
    
            const bindGroupLayout = device.createBindGroupLayout({
                entries: bindGroupLayoutEntries })
            newPipelineLayout = device.createPipelineLayout({
                bindGroupLayouts: [ defaultBindGroupLayout, bindGroupLayout ] })
    
            const newBindGroup = device.createBindGroup({
                layout: bindGroupLayout,
                entries: bindGroupEntries
            })
            customBindGroup = newBindGroup
        }

        // configure rendering pipeline
        const pipelineDescriptor = {
            vertex: { module: shaderModule, entryPoint: "vertex_main", buffers: vertexBuffers },
            fragment: { module: shaderModule, entryPoint: "fragment_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]},
            primitive: { topology: "triangle-list" },
            layout: newPipelineLayout
        }
        const renderPipeline = device.createRenderPipeline(pipelineDescriptor)

        let passProxy = null, pass
        if (hasUniforms) {
            pass = new Pass(ctx, renderPipeline, vertexBuffer, passData, customBindGroup)
            config.uniforms.source = pass
            passProxy = new Proxy(config.uniforms, { set: modifyPassUniform })
        } else {
            pass = new Pass(ctx, renderPipeline, vertexBuffer)
        }

        passes.push(pass)
        return passProxy
    },
    async run(_update) {
        update = _update

        Object.entries(data).forEach((entry) => {
            const uniform = entry[1]
            device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
        })

        passes.forEach((pass) => {
            Object.entries(pass.data).forEach((entry) => {
                const uniform = entry[1]
                device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
            })
        })

        requestAnimationFrame(render)
    }
}

function render() {
    passes.forEach((pass) => {
        const commandEncoder = device.createCommandEncoder()

        // background color
        const clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }

        const renderPassDescriptor = {
            colorAttachments: [{
                clearValue: clearColor,
                loadOp: "clear",
                storeOp: "store",
                view: pass.ctx.getCurrentTexture().createView()
            }
        ]}

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
        passEncoder.setPipeline(pass.renderPipeline)
        passEncoder.setBindGroup(0, bindGroup)
        if (pass.customBindGroup != null) {
            passEncoder.setBindGroup(1, pass.customBindGroup)
        }
        passEncoder.setVertexBuffer(0, pass.vertexBuffer)

        passEncoder.draw(6)
        passEncoder.end()
        device.queue.submit([commandEncoder.finish()])
    })

    update()
    requestAnimationFrame(render)
}

function modifyUniform(target, key, value) {
    const arrayForm = Array.isArray(value) ? value : [value]
    const values = data[key].values
    values.set(arrayForm)
    device.queue.writeBuffer(data[key].buffer, 0, values)

    target[key] = value
    return value
}

function modifyPassUniform(target, key, value) {
    const arrayForm = Array.isArray(value) ? value : [value]
    const targetData = target.source.data[key]
    targetData.values.set(arrayForm)
    device.queue.writeBuffer(targetData.buffer, 0, targetData.values)

    target[key] = value
    return value
}

export default WGPU