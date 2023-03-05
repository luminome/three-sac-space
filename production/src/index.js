import * as THREE from 'three';

// import {uiBasicLoader as loader}  from 'three-sac/ui-basic-loader.js';
// import {default as scene} from 'three-sac/ui-three-base.js';
// import elements from 'three-sac/ui-three-elements.js';
// import * as util from 'three-sac/ui-util.js';

import {loader, scene, elements, util} from 'three-sac';



// import {uiBasicLoader as loader}  from './three-sac/ui-basic-loader.js';
// import {default as scene} from './three-sac/ui-three-base.js';
// import elements from './three-sac/ui-three-elements.js';
// import * as util from './three-sac/ui-util.js';
import config from './config.js';
import package_detail from '../../package.json';

const dom_target = document.getElementById('module-window');

config.model = new THREE.Object3D();
config.model.objects = {};

const zoom_detail_label = elements.dom_label().init(dom_target, config.view.dom_labels);
zoom_detail_label.set_position(window.innerWidth/2, 8);

const user_pos = elements.dashed_halo(1.0);
config.model.add(user_pos);

/**
* @param {String} type The type of event issuer
* @param {Object} packet The event information
*/
config.event_callback = (type, packet) => {
    //console.log(type, packet);
    let text = `ELEV ${(135.0-util.rad_to_deg(scene.controls.cam.constrain_angle)).toFixed(2)}º`;
    text += ` Z ${scene.controls.cam.camera_scale.toFixed(2)}`;
    text += ` D ${scene.controls.cam.distance.toFixed(2)}`;
    zoom_detail_label.set_text(text);

    if (config.view.features.grid_marks.on && config.model.objects.grid_marks) {
        const pc = scene.controls.v.user.mouse.actual;
        const p = config.view.features.grid_marks.pitch;
        const x = Math.round(pc.x / p) * p;
        const y = Math.round(pc.z / p) * p;
        config.model.objects.grid_marks.position.set(-x, 0.0, -y);
    }

    const pc = scene.controls.v.user.mouse.plane_pos;
    user_pos.position.set(pc.x-config.model.position.x, 0.0, pc.z-config.model.position.z);

    if(type === 'keys'){
        if(packet.active.includes('Tab')) {
            if (!packet.previous.includes('Tab')) {
                config.debug_trace_state = !config.debug_trace_state;
                debug_trace.plane_object.visible = config.debug_trace_state;
            }
        }
        if(packet.active.includes('Space')) {
            if (!packet.previous.includes('Space')) {
                config.animator.animating = !config.animator.animating;
            }
        }
        if (packet.active.includes('ArrowLeft')) {
            config.animator.animating = false;
            animator.get_frame(-1);
        }
        if (packet.active.includes('ArrowRight')) {
            config.animator.animating = false;
            animator.get_frame(1);
        }



    }

    if(type === 'screen'){
        // scene.controls.ray_caster.setFromCamera(scene.controls.v.user.mouse.raw, scene.controls.cam.camera);
        // const intersects = scene.controls.ray_caster.intersectObjects(config.model.children, true);
        // let analog = 'none';
        // if(intersects.length > 0) {
        //     let found = null;
        //     for(let i=0; i<intersects.length; i++){
        //         if (intersects[i].object.name === 'prog_bar') {
        //             found = [i, intersects[i]];
        //             break;
        //         }
        //     }
        //     if(found!==null) {
        //         analog = `prog_bar intersection(${found[0]}) index:${found[1].instanceId}`;
        //         if(packet.meta.action === 'click'){
        //             animator.get_frame(found[1].instanceId, true);
        //         }
        //     }
        // }
        // config.debug.analog = analog;
    }

    return true;
}
// init three.js scene
scene.init(dom_target, config);


Object.entries(config.view.features).map(feat =>{
    const k = feat[0];
    if(config.view.features[k].on){
        config.model.objects[k] = elements[k](config.view.features[k]);
        config.model.objects[k].name = k;
        const target = config.view.features[k].target === 'model' ? config.model : scene.layers[0].scene;
        target.add(config.model.objects[k]);
    }
});

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
console.log('building', package_detail.name, config);

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// set animation callback
/**
* @param {Number} frame The animation frame
*/
config.animation_callback = (frame) => {
    // if(df.vertices.instance) df.update_vertices();
    // debug_trace.trace(frame+' ok');
    return true;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
console.log('built', package_detail.name, config);



























































































































