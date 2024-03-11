import { default as WGPU } from './wgpu.js'
import { default as Shaker } from './shaker.js'

window.onload = async () => {
    const c1 = document.querySelector("#c1")
    c1.width = window.innerWidth
    c1.height = window.innerHeight

    const config = {
        root: {
            name: "example",
            inputs: [ "grid_pos" ],
            outputs: [ "c" ],
            children: [
                { name: "grid",
                inputs: [ "norm_pos" ],
                outputs: [ "grid_pos", "grid_index" ],
                children: [
                    { name: "normalized_pos",
                    inputs: [],
                    outputs: [ "norm_pos" ],
                    children: [] }
                ] }
            ] },
        return: "c"
    }
    
    const c1_frag = await Shaker.build(config)

    const wgpuconfig = {
        data: { frame: 0 },
        p1: { res: [ window.innerWidth, window.innerHeight ] }
    }

    const data = await WGPU.init(wgpuconfig.data)
    const p1 = await WGPU.create_pass({ canvas: c1, fragment: c1_frag, uniforms: wgpuconfig.p1 })

    WGPU.run(() => {
        data.frame++
    })

    window.onresize = () => {
        c1.width = window.innerWidth
        c1.height = window.innerHeight
        p1.res = [ window.innerWidth, window.innerHeight ]
    }
}