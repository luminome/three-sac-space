import * as THREE from 'three';
import {loader, scene, elements, util} from 'three-sac';
import {labels, trace} from 'three-sac/ui-labels';
import wedge from 'geodesic-model';
import geo_data from "./custom.geo-med.json"; //https://geojson-maps.ash.ms/
import config from './config.js';
import package_detail from '../../package.json';

const dom_target = document.getElementById('module-window');
const info_target = document.getElementById('instructions-window');

config.model = new THREE.Object3D();
config.model.objects = {};
config.model_overlay = new THREE.Object3D();
config.model_overlay.objects = {};
config.model_overlay.matrixAutoUpdate = false;

const zoom_detail_label = elements.dom_label().init(dom_target, config.view.dom_labels);
zoom_detail_label.set_position(window.innerWidth/2, 8);

const user_pos = elements.dashed_circle_marker(1.0);
user_pos.rotateX(Math.PI/2);
config.model.add(user_pos);

function lon_lat_to_polar(vct, lon, lat, r){
    const phi = Math.PI/-2 + util.deg_to_rad(lat);
    const theta = util.deg_to_rad(lon);
    vct.setFromSphericalCoords(r, phi, theta);
}

function polar_to_lon_lat(vct, r){
    const phi = (util.rad_to_deg(Math.acos(vct.y/r))-90.0)*-1.0;
    const theta = util.rad_to_deg(Math.atan2(vct.x, vct.z));
    return {lon:theta, lat:phi};
}


const geo = {
    all_features: [],
    all_shapes: [],
    geo_feat_stats: ['formal_en', 'region_wb', 'subregion','pop_est', 'pop_rank', 'ne_id'],
    prepare_geodata() {
        console.log(geo_data);
        geo_data.features.map(f => {
            const feat = {};
            geo.geo_feat_stats.map(k => {
                if (f.properties.hasOwnProperty(k)) feat[k] = f.properties[k];
                if (f.geometry.type === 'Polygon') {
                    const cx = f.geometry.coordinates[0].map(c => c[0]);
                    const cy = f.geometry.coordinates[0].map(c => c[1]);
                    feat.centroid = [util.average(cx), util.average(cy)];
                }
            });
            geo.all_features.push(feat);
            //console.log(feat);
        })
    },
    render(model){
        const u = new THREE.Vector3();
        const obj = new THREE.Object3D();

        const get_v = (coord) => {
            lon_lat_to_polar(u, coord[0], coord[1], model.radius);
            return u.toArray();
        }

        const coords_to_object = (part, f, id) => {
            const vertices = [];
            const cx = part.map(cc => cc[0]);
            const cy = part.map(cc => cc[1]);
            const centroid = [util.average(cx), util.average(cy)];

            part.map(c => {
                vertices.push(...get_v(c));
            });

            const material = new THREE.LineBasicMaterial({color: 0xFFFFFF});
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(vertices), 3 ) );
            const line_obj = {
                shape: new THREE.Line( geometry, material ),
                name: f.properties['ne_id'],
                centroid: centroid
            };
            line_obj.shape.name = `${f.properties['ne_id']}-${id}`;
            geo.all_shapes.push(line_obj);
            obj.add(line_obj.shape);
        }

        geo_data.features.map(f => {
            if (f.geometry.type === 'Polygon') {
                coords_to_object(f.geometry.coordinates[0], f, 0);
            }
            if (f.geometry.type === 'MultiPolygon') {
                f.geometry.coordinates.map((c, i) =>{
                    coords_to_object(c[0], f, i);
                })
            }
        })

        //obj.rotateY(Math.PI);
        model.object.add(obj);
    }

}




/**/
function get_new_wedge(){
    wedge.abstract.order = 3;
    wedge.abstract.scale = 4;
    wedge.build.download_new_model(info_target);

}

wedge.config.sources = [
    ["mappings","./sources/mappings.json"],
    ["faces","./sources/faces.json"],
    ["indices","./sources/indices.json"],
    ["vertices","./sources/vertices.json"]
]

//over_write loader callback
wedge.loader.model_post_load = (resources) => {
    const model_timer = util.timer('delta_time').start();
    resources.map(r => {
        wedge.abstract[r.variable] = r.raw[r.variable];
    })
    wedge.ready = true;
    wedge.loader.messages(['model build in', util.formatMs(model_timer.stop())]);
    wedge.abstract.order = 3;
    wedge.abstract.scale = 4;
}


wedge.abstract.scale = 4;
//wedge.loader.model_loader.run();
config.model.add(wedge.get_object());


//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
const util_vector = new THREE.Vector3();
const vu = new THREE.Vector3();



const pos = new THREE.Vector3(0,0.0,0);

labels.set_font('heavy_data', './font/dinregularwebfont.ttf').then(r =>{

    labels.make({
        name: 'center',
        text_array: [{text:'center',size:0.05}],
        origin: pos,
        tick_offset: 0.0,
        look_at_camera: false,
        direction: 'up',
    });

    if(config.flat_model_visible) {
        labels.make({
            name: 'user_pos',
            origin: pos,
            tick: 'L',
            tick_offset: 3.0,
            tick_dashed: true,
            look_at_camera: true,
            dynamic: {anchor: new THREE.Vector3(0, 0, 0), offset: 1.0},
            align: 'left',
        });
        labels.make({
            name: 'ISS',
            text_array: [{text: 'ISS', size: 0.05}],
            origin: pos,
            tick: 'I',
            tick_offset: 1.0,
            tick_dashed: true,
            direction: 'up',
            look_at_camera: false,
            align: 'center'
        });
        labels.make({
            name: 'y-axis',
            range: {
                min: -5,
                max: 5,
                interval: 1.0,
                interval_vector: [0,0,-1],
                start_value: -90,
                end_value: 90,
                size:0.05
            },
            origin: new THREE.Vector3(10.0,0,0),
            tick: 'R',
            tick_offset: 0.5,
            look_at_camera: false,
            direction: 'up',
            align:'right'
        });
        labels.make({
            name: 'x-axis',
            range: {
                min: -10,
                max: 10,
                interval: 2.0,
                interval_vector: [1,0,0],
                start_value: -180,
                end_value: 180,
                size:0.05
            },
            origin: new THREE.Vector3(0,0,5.0),
            tick: 'I',
            tick_offset: 0.5,
            look_at_camera: false,
            direction: 'up',
            align:'center'
        });
    }

    labels.make({
        name: 'user_pos_sphere',
        origin: pos,
        tick: 'L',
        tick_offset: 3.0,
        tick_dashed: true,
        look_at_camera: true,
        dynamic: {anchor: new THREE.Vector3(0,0,0), offset:0.0},
        align:'left',
    });

    labels.make({
        name: 'ISS_sphere',
        text_array: [{text:'ISS',size:0.1},{text:'dat',size:0.05}],
        origin: pos,
        tick:'I',
        tick_offset: 1.0,
        direction: 'up',
        look_at_camera: true,
        align:'center',
        dynamic: {anchor: new THREE.Vector3(0,0,0), offset:0.0},
    });

    labels.make({
        name: 'sphere_zero',
        text_array: [{text:'0.0',size:0.1}],
        origin: pos,
        tick:'I',
        tick_offset: 4.0,
        tick_dashed: true,
        direction: 'up',
        look_at_camera: false,
        align:'center'
    });

    labels.make({
        name: 'sphere_top',
        text_array: [{text:'-90.0',size:0.1}],
        origin: pos,
        tick:'B',
        tick_offset: 4.0,
        tick_dashed: true,
        direction: 'in',
        look_at_camera: false,
        align:'center'
    });
    // labels.make(null, null, pos, 'B', 'BASE 0.92 Snacksy', true);
    config.model_overlay.add(labels.object);

    console.log(labels.groups);

    labels_finish();
});

labels.ready = true;

function labels_finish(){
    util_vector.set(0,0,-5.0);
    SPH.object.worldToLocal(util_vector);
    labels.groups.sphere_zero.object.position.copy(util_vector);

    util_vector.set(0,5.0,0);
    SPH.object.worldToLocal(util_vector);
    labels.groups.sphere_top.object.position.copy(util_vector);
}

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
        //        console.log(packet);

        scene.controls.ray_caster.setFromCamera(scene.controls.v.user.mouse.raw, scene.controls.cam.camera);
        const intersects = scene.controls.ray_caster.intersectObjects(config.model.children, true);
        let analog = 'none';
        if(intersects.length > 0) {
            let found = null;
            for(let i=0; i<intersects.length; i++){
                if (intersects[i].object.name === 'sphere') {
                    found = [i, intersects[i]];
                    break;
                }
            }
            if(found!==null) {
                //console.log(found);
                if(labels.groups.user_pos_sphere){ ///} && scene.controls.v.user.mouse.state === 'click'){
                    util_vector.copy(found[1].point).sub(config.model.position);
                    //SPH.object.localToWorld(util_vector);
                    labels.groups.user_pos_sphere.object.position.copy(util_vector);
                    labels.groups.user_pos_sphere.format.dynamic.anchor.copy(config.model.position);
                    //labels.groups.user_pos_sphere.format.dynamic.anchor.add(util_vector.multiplyScalar(0.95));//config.model.position);

                    util_vector.copy(found[1].point).sub(config.model.position);
                    const polar = polar_to_lon_lat(util_vector, SPH.radius);
                    // //
                    // // util_vector.add(config.model.position);
                    // // ERT.object.worldToLocal(util_vector);
                    // const phi = util.rad_to_deg(Math.acos(util_vector.y/5))-90.0;
                    // const theta = util.rad_to_deg(Math.atan2(util_vector.x, util_vector.z));

                    const scape = scene.controls.cam.camera.position.distanceTo(util_vector.add(config.model.position));
                    const ost = scape/(scene.controls.cam.distance+5);

                    labels.groups.user_pos_sphere.object.scale.setScalar(ost);
                    labels.groups.user_pos_sphere.format.text_array = [
                        {
                            text: `D ${(scape/scene.controls.cam.distance).toFixed(2)}u`,
                            size: 0.1
                        },
                        {
                            text: `LAT ${polar.lat.toFixed(2)}º`,
                            size: 0.1
                        },
                        {
                            text: `LON ${polar.lon.toFixed(2)}º`,
                            size: 0.1
                        },
                        {
                        text:`${found[1].point.x.toFixed(2)}x ${found[1].point.y.toFixed(2)}y ${found[1].point.z.toFixed(2)}z`,
                        size:0.05
                        }
                    ];
                    labels.groups.user_pos_sphere.update();


                }

                // analog = `prog_bar intersection(${found[0]}) index:${found[1].instanceId}`;
                // if(packet.meta.action === 'click'){
                //     animator.get_frame(found[1].instanceId, true);
                // }
            }
        }
        //config.debug.analog = analog;
    }

    return true;
}


// init three.js scene
scene.init(dom_target, config);
const ambient_light = scene.layers[0].scene.children.filter(o => o.type === 'AmbientLight')[0];
ambient_light.intensity = 0.25;

// console.log(scene.layers[0].scene.children.filter(o => o.type === 'AmbientLight'));

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




const flat_earth = () => {

    function init(name){
        F.name = name;
        const mat = new THREE.MeshBasicMaterial({
            color:0x444444,
            depthWrite: false,
        });
        const geom = new THREE.PlaneGeometry(...F.shape);
        const s = config.model_w/F.shape[0];
        //geom.translateZ(1.0);

        F.plane = new THREE.Mesh(geom,mat);
        F.plane.renderOrder = 0;

        F.plane.rotateX(Math.PI/-2);
        F.plane.position.set(0,-1,0);
        F.marker.scale.setScalar(10.0);

        F.object.add(F.plane);
        F.object.add(F.marker);
        F.object.scale.setScalar(s);

        F.object.visible = F.visible;
        return F
    }

    const F = {
        visible: config.flat_model_visible,
        marker: elements.position_marker(),
        shape: [360,180],
        plane: null,
        object: new THREE.Object3D(),
        name: null,
        init
    }

    return F
}

const globe_earth = () => {

    function init(name){
        R.name = name;
        const mat = new THREE.MeshStandardMaterial({
            color:0x333333,
            transparent:true,
            opacity:0.75,
            depthWrite: false,
            side: THREE.DoubleSide
            //wireframe: true,
        });
        const geom = new THREE.SphereGeometry(5, 180, 90);

        //geom.translateZ(1.0);

        R.sphere = new THREE.Mesh(geom, mat);
        R.sphere.name = 'sphere';
        R.sphere.renderOrder = 1;
        //
        //
        // F.plane.rotateX(Math.PI/-2);
        // F.plane.position.set(0,-1,0);
        // F.marker.scale.setScalar(10.0);

        R.object.add(R.sphere);
        R.object.add(R.marker);
        R.marker.scale.setScalar(0.25);


        R.object.rotateY(Math.PI);
        return R
    }

    const R = {
        radius: 5.0,
        marker: elements.position_marker(),
        sphere: null,
        object: new THREE.Object3D(),
        name: null,
        init
    }

    return R


}









const ERT = flat_earth().init('ERT');
config.model.add(ERT.object);

const SPH = globe_earth().init('SPH');
config.model.add(SPH.object);

geo.prepare_geodata();
geo.render(SPH);





function world_to_model(vct){
    //vu.copy(config.model.position).sub(vct);
    vct.sub(config.model.position);
    //vct.set(config.model.position.x-vct.x, config.model.position.x-vct.y, config.model.position.z-vct.z);
}



const get_t_from_dateStamp = (t) => {
    const d_arr = t.split('-');
    const d = {
        month: d_arr[0]-1,
        day: d_arr[1],
        year: d_arr[2],
        hour: d_arr[3],
        minute: d_arr[4]
    }
    const dd = new Date(Date.UTC(d.year, d.month, d.day, d.hour, d.minute));//, 0.0, 0.0);

    const d2 = new Date( dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), dd.getUTCHours(), dd.getUTCMinutes(), dd.getUTCSeconds() );
    ///console.log(t, dd.getTime());
    const dct = d2.getTime();//.valueOf(); //Date.parse(dd.toUTCString());//new Date(d.year, d.month, d.day, d.hour, d.minute);
    //const dct = dd.toUTCString();///new Date(Date.parse(dcft));//

    const spe = d_arr[2]+((d_arr[0]).padStart(2, '0'))+(d_arr[1].padStart(2, '0'))+(d_arr[3].padStart(2, '0'))+(d_arr[4].padStart(2, '0'));
    //    console.log(spe);



    //
    // const options = {
    //     weekday:"long",
    //     day:"2-digit",
    //     year:"numeric",
    //     month:"long",
    //     hour:"2-digit",
    //     minute:"2-digit",
    //     timeZoneName:"long",
    //     hour12:false
    // }

    const d_options = {
        weekday:"long",
        day:"2-digit",
        year:"numeric",
        month:"long",
    };
    const t_options = {
        hour:"2-digit",
        minute:"2-digit",
        hour12:false
    };
    const z_options = {
        timeZoneName:"long",
    };

    return {
        d:dd.toLocaleDateString('en-us', d_options),
        t:dd.toLocaleTimeString('en-us', t_options),
        z:dd.toLocaleDateString('en-us', z_options),
        dd:dd,
        df:spe,
    } // "Jul 2021 Friday"

}


const status = 'initial load';


function update_position(r){
    if(ERT.visible){
        ERT.marker.position.set(r.raw.longitude, 0 , r.raw.latitude*-1.0); // because Z axis inverts
        util_vector.copy(ERT.marker.position);
        ERT.object.localToWorld(util_vector);
        world_to_model(util_vector);
        labels.groups.ISS.object.position.copy(util_vector);
    }

    lon_lat_to_polar(util_vector, r.raw.longitude, r.raw.latitude, SPH.radius);///setFromSphericalCoords(5.0,phi,theta);
    SPH.marker.position.copy(util_vector);
    SPH.marker.lookAt(config.model.position);//
    SPH.marker.rotateX(Math.PI/2);
    SPH.object.localToWorld(util_vector);
    world_to_model(util_vector);

    labels.groups.ISS_sphere.object.position.copy(util_vector);
    labels.groups.ISS_sphere.format.dynamic.anchor.copy(config.model.position);
    labels.groups.ISS_sphere.format.text_array[1] = {
        text: `ALT ${r.raw.elevation.toFixed(2)}km`,
        size: 0.05
    }
    labels.groups.ISS_sphere.update();

    // SPH.marker.lookAt(config.model.position);//
    // // SPH.marker.lookAt(-config.model.position.x,0,-config.model.position.z);//config.model.position.clone().negate());
    // SPH.marker.rotateX(Math.PI/2);

    //util_vector.copy(SPH.marker.position);//.sub(config.model.position);
    //SPH.object.localToWorld(util_vector);


    // labels.groups.ISS_sphere.object.position.copy(util_vector);
    // labels.groups.ISS_sphere.update();

    //     util_vector.copy(found[1].point).sub(config.model.position);
    // //SPH.object.localToWorld(util_vector);
    // labels.groups.user_pos_sphere.object.position.copy(util_vector);
    // labels.groups.user_pos_sphere.format.dynamic.anchor.copy(config.model.position);
    //
    // util_vector.copy(found[1].point).sub(config.model.position);
    // //
    // // util_vector.add(config.model.position);
    // // ERT.object.worldToLocal(util_vector);
    // const phi = util.rad_to_deg(Math.acos(util_vector.y/5))-90.0;
    // const theta = util.rad_to_deg(Math.atan2(util_vector.x, util_vector.z));
    //
    // labels.groups.user_pos_sphere.format.text_array = [
    //     {
    //         text: `LAT ${phi.toFixed(2)}º`,
    //         size: 0.1
    //     },
    //     {
    //         text: `LON ${theta.toFixed(2)}º`,
    //         size: 0.1
    //     },
    //     {
    //     text:`${found[1].point.x.toFixed(2)}x ${found[1].point.y.toFixed(2)}y ${found[1].point.z.toFixed(2)}z`,
    //     size:0.05
    //     }
    // ];
    // labels.groups.user_pos_sphere.update();
    //
}


const queue = [{url:config.paths.ctipe_manifest_path, type:'json', cat:'manifest'}, {url:config.paths.skyfield+'iss', type:'json', cat:'astro'}];

loader(queue, status).then(r => {
    update_position(r[1]);
});

const date = new Date();
const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(),
                date.getUTCDate(), date.getUTCHours(),
                date.getUTCMinutes(), date.getUTCSeconds());

// console.log(new Date(now_utc));

console.log(date.toISOString());
// console.log(time_stamp);
// console.log(date.getUTCHours())

const MS_PER_MINUTE = 60000;

const frame = {
    start: new Date(),
    current: new Date()
}

function time_slide(){
    const k_interval = 1;
    frame.current = new Date(frame.current - k_interval * MS_PER_MINUTE);
    const time_stamp = [
        frame.current.getUTCMonth()+1,
        frame.current.getUTCDate(),
        frame.current.getUTCFullYear(),
        frame.current.getUTCHours(),
        Math.floor(frame.current.getUTCMinutes()/k_interval)*k_interval
    ]
    const ts = time_stamp.join('-');

    const queue = [{url:config.paths.skyfield+'iss:'+ts, type:'json', cat:'astro'}];

    loader(queue, status).then(r => {
        //console.log(r);
        update_position(r[0]);
    });

    setTimeout(time_slide, 1200);
}

time_slide();

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
console.log('built', package_detail.name, config);


/**
* @param {Number} frame The animation frame
*/
config.animation_callback = (frame) => {
    if(labels.ready){
        labels.all.map(c=>{
            if(c.look){
                c.render(scene.controls.cam.cube.quaternion, scene.controls.v.user.mouse.plane_pos);
            }
        });

        if(labels.groups.user_pos){ ///} && scene.controls.v.user.mouse.state === 'click'){
            util_vector.copy(scene.controls.v.user.mouse.plane_pos).sub(config.model.position);
            labels.groups.user_pos.object.position.copy(util_vector);

            util_vector.add(config.model.position);
            ERT.object.worldToLocal(util_vector);

            labels.groups.user_pos.format.text_array[0] = {
                text:`${util_vector.x.toFixed(2)}x ${(-1.0*util_vector.z).toFixed(2)}z`,
                size:0.1
            };
            labels.groups.user_pos.format.align = 'right';
            labels.groups.user_pos.update();
        }

    }
    return true;
}

























































































































