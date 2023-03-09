import * as THREE from 'three';
import {loader, scene, elements, util} from 'three-sac';
import {labels, trace} from 'three-sac/ui-labels';
import wedge from 'geodesic-model';
import geo_countries from "./custom.geo-med.json"; //https://geojson-maps.ash.ms/
//import geo_seams from "./blocks_seams_10m.json"; //https://geojson-maps.ash.ms/
import geo_marine from "./marine_polys_50m.json"; //https://geojson-maps.ash.ms/


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

const geo_layers = {}


function geo_layer(){

    function slate(){
        const zone_lon = Math.ceil(360/G._s);
        const zone_lat = Math.ceil(180/G._s);
        for(let x = 0; x < zone_lon; x++) {
            G.data_cross.push([]);
            for(let y = 0; y < zone_lat; y++) {
                G.data_cross[x].push([]);
            }
        }
    }

    function init(properties) {
        Object.entries(properties).map(p =>{
            G[p[0]] = p[1];
        })

        const fields = G.custom_fields === null ? G.source.meta : G.custom_fields;
        G.slate();
        const dat = G.custom_fields === null ? G.source.data : G.source.features;

        dat.map((f,i) => {
            const feat = {};
            fields.map(k => {
                if (f.properties.hasOwnProperty(k)) feat[k] = f.properties[k];

                // if (f.geometry.type === 'Polygon') {
                //     const cx = f.geometry.coordinates[0].map(c => c[0]);
                //     const cy = f.geometry.coordinates[0].map(c => c[1]);
                //     feat.centroid = [util.average(cx), util.average(cy)];
                // }
            });
            f.properties.id = i;
            G.all_features[i] = feat;
            //G.all_features[feat['ne_id']] = feat;
        });
        return G
    }

    function render(){
        const u = new THREE.Vector3();
        const obj = new THREE.Object3D();

        const get_v = (coord) => {
            lon_lat_to_polar(u, coord[0], coord[1], G.model.radius);
            return u.toArray();
        }

        const filter = (res, value) => {
             return Math.round(value/(res*2))*res*2;
        }


        function add_to_list(int_lon, int_lat, id){
            let x = (int_lon + 180)/G._s;
            if(x >= G.data_cross.length) x = 0;
            let y = (int_lat + 90)/G._s;
            if(y >= G.data_cross[0].length) y = 0;
            if(!G.data_cross[x][y].includes(id)) G.data_cross[x][y].push(id);
        }

        const coords_to_object = (part, f, id) => {
            const shape_id = `${f.properties.id}-${id}`;
            const vertices = [];
            const cx = part.map(cc => cc[0]);
            const cy = part.map(cc => cc[1]);

            // check every point in contour
            part.map(cc => {
                const pb = [filter(G._s, cc[0]), filter(G._s, cc[1])];
                add_to_list(pb[0], pb[1], shape_id);
            });
            // check point_in+poly for all canon coords.
            // bounds first
            const bounds = [
                filter(G._s, Math.min(...cx)),
                filter(G._s, Math.min(...cy)),
                filter(G._s, Math.max(...cx)),
                filter(G._s, Math.max(...cy))
            ]

            const centroid = [util.average(cx), util.average(cy)];
            const sector_raw = {
                'lon': filter(G._s,centroid[0]),
                'lat': filter(G._s,centroid[1])
            }

            add_to_list(sector_raw.lon, sector_raw.lat, shape_id);

            // get limits
            if(bounds[0] !== bounds[2] && bounds[1] !== bounds[3]){
                for(let x = bounds[0]; x < bounds[2]; x += G._s) {
                    for(let y = bounds[1]; y < bounds[3]; y += G._s) {
                        const point = {x:x, y:y};
                        if(util.point_in_poly(point, cx, cy)) add_to_list(x, y, shape_id);
                    }
                }
            }

            part.map(c => {
                vertices.push(...get_v(c));
            });

            const material = new THREE.LineBasicMaterial({color: G.color});
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(vertices), 3 ) );
            const line_obj = {
                shape: new THREE.Line( geometry, material ),
                coords_flat: [cx, cy],
                name: f.properties['ne_id'],
                centroid: centroid
            };
            line_obj.shape.name = shape_id;
            G.all_shapes[shape_id] = line_obj;
            obj.add(line_obj.shape);
        }

        function coords_paired(arr){
            const cp = [];
            for(let i=0; i<arr.length; i+=2){
                cp.push([arr[i],arr[i+1]]);
            }
            return cp;
        }

        const dat = G.custom_fields === null ? G.source.data : G.source.features;
        dat.map(f => {
            if (f.geometry.type === 'Polygon' || f.geometry.type === 'LineString') {
                if(G.custom_fields === null){
                    coords_to_object(coords_paired(f.geometry.coordinates), f, 0);
                }else{
                    coords_to_object(f.geometry.coordinates[0], f, 0);
                }
            }
            if (f.geometry.type === 'MultiPolygon' || f.geometry.type === 'MultiLineString') {
                f.geometry.coordinates.map((c, i) =>{
                    if(G.custom_fields === null){
                        coords_to_object(coords_paired(c), f, i);
                    }else{
                        coords_to_object(c[0], f, i);
                    }
                })
            }
        })

        if(G.add_to_model) G.model.object.add(obj);
        return G
    }


    const G = {
        name: null,
        source: null,
        color: null,
        data_cross: [],
        all_features: {},
        all_shapes: {},
        custom_fields: null,
        model: null,
        add_to_model: false,
        _s: null,
        init,
        slate,
        render
    }

    return G

}

const geo = {
    data_cross: [],
    all_features: {},
    all_shapes: {},
    geo_feat_stats: ['name', 'formal_en', 'region_wb', 'subregion','pop_est', 'pop_rank', 'ne_id'],

    geo_slate(){
        const zone_lon = Math.ceil(360/SPH.sector_scale);
        const zone_lat = Math.ceil(180/SPH.sector_scale);
        for(let x = 0; x < zone_lon; x++) {
            geo.data_cross.push([]);
            for(let y = 0; y < zone_lat; y++) {
                geo.data_cross[x].push([]);
            }
        }
        console.log(zone_lon, zone_lat);
    },

    prepare_geodata() {
        geo.geo_slate();
        geo_countries.features.map(f => {
            const feat = {};
            geo.geo_feat_stats.map(k => {
                if (f.properties.hasOwnProperty(k)) feat[k] = f.properties[k];
                if (f.geometry.type === 'Polygon') {
                    const cx = f.geometry.coordinates[0].map(c => c[0]);
                    const cy = f.geometry.coordinates[0].map(c => c[1]);
                    feat.centroid = [util.average(cx), util.average(cy)];
                }
            });
            geo.all_features[feat['ne_id']] = feat;
        })
    },

    render(model){
        const u = new THREE.Vector3();
        const obj = new THREE.Object3D();

        const get_v = (coord) => {
            lon_lat_to_polar(u, coord[0], coord[1], model.radius);
            return u.toArray();
        }

        const filter = (res, value) => {
             return Math.round(value/(res*2))*res*2;
        }


        function add_to_list(int_lon, int_lat, id){
            let x = (int_lon + 180)/SPH.sector_scale;
            if(x >= geo.data_cross.length) x = 0;
            let y = (int_lat + 90)/SPH.sector_scale;
            if(y >= geo.data_cross[0].length) y = 0;
            if(!geo.data_cross[x][y].includes(id)) geo.data_cross[x][y].push(id);
        }

        const coords_to_object = (part, f, id) => {
            const shape_id = `${f.properties['ne_id']}-${id}`;
            const vertices = [];
            const cx = part.map(cc => cc[0]);
            const cy = part.map(cc => cc[1]);

            // check every point in contour
            const ctl = part.map(cc => {
                const pb = [filter(SPH.sector_scale, cc[0]), filter(SPH.sector_scale, cc[1])];
                add_to_list(pb[0], pb[1], shape_id);
            });
            // check point_in+poly for all canon coords.
            // bounds first
            const bounds = [
                filter(SPH.sector_scale, Math.min(...cx)),
                filter(SPH.sector_scale, Math.min(...cy)),
                filter(SPH.sector_scale, Math.max(...cx)),
                filter(SPH.sector_scale, Math.max(...cy))
            ]

            const centroid = [util.average(cx), util.average(cy)];
            const sector_raw = {
                'lon': filter(SPH.sector_scale,centroid[0]),
                'lat': filter(SPH.sector_scale,centroid[1])
            }

            add_to_list(sector_raw.lon, sector_raw.lat, shape_id);

            // get limits
            if(bounds[0] !== bounds[2] && bounds[1] !== bounds[3]){
                for(let x = bounds[0]; x < bounds[2]; x += SPH.sector_scale) {
                    for(let y = bounds[1]; y < bounds[3]; y += SPH.sector_scale) {
                        const point = {x:x, y:y};
                        if(util.point_in_poly(point, cx, cy)) add_to_list(x, y, shape_id);
                    }
                }
            }

            part.map(c => {
                vertices.push(...get_v(c));
            });

            const material = new THREE.LineBasicMaterial({color: 0xFFFFFF});
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(vertices), 3 ) );
            const line_obj = {
                shape: new THREE.Line( geometry, material ),
                coords_flat: [cx, cy],
                name: f.properties['ne_id'],
                centroid: centroid
            };
            line_obj.shape.name = shape_id;
            geo.all_shapes[shape_id] = line_obj;
            obj.add(line_obj.shape);
        }



        geo_countries.features.map(f => {
            if (f.geometry.type === 'Polygon') {
                coords_to_object(f.geometry.coordinates[0], f, 0);
            }
            if (f.geometry.type === 'MultiPolygon') {
                f.geometry.coordinates.map((c, i) =>{
                    coords_to_object(c[0], f, i);
                })
            }
        })

        //console.log(geo.data_cross);

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
const v = {
    a: new THREE.Vector3(0, 0, 0),
    b: new THREE.Vector3(0, 0, 0),
    c: new THREE.Vector3(0, 0, 0),
    d: new THREE.Vector3(0, 0, 0),
    e: new THREE.Vector3(0, 0, 0),
    up: new THREE.Vector3(0,1.0,0),
    right: new THREE.Vector3(1.0,0,0),
};


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
        scene.controls.ray_caster.setFromCamera(scene.controls.v.user.mouse.raw, scene.controls.cam.camera);
        const intersects = scene.controls.ray_caster.intersectObjects(config.model.children, true);
        if(intersects.length > 0) {
            let found = null;
            for(let i=0; i<intersects.length; i++){
                if (intersects[i].object.name === 'sphere') {
                    found = [i, intersects[i]];
                    break;
                }
            }
            if(found!==null) {
                if(labels.groups.user_pos_sphere){
                    util_vector.copy(found[1].point).sub(config.model.position);
                    labels.groups.user_pos_sphere.object.position.copy(util_vector);
                    labels.groups.user_pos_sphere.format.dynamic.anchor.copy(config.model.position);

                    util_vector.copy(found[1].point).sub(config.model.position);
                    const polar = polar_to_lon_lat(util_vector, SPH.radius);

                    const scape = scene.controls.cam.camera.position.distanceTo(util_vector.add(config.model.position));
                    const ost = scape/(scene.controls.cam.distance+5);

                    labels.groups.user_pos_sphere.object.scale.setScalar(ost);
                    //D ${(scape/scene.controls.cam.distance).toFixed(2)}u
                    labels.groups.user_pos_sphere.format.text_array = [
                        {
                            text: `—`,
                            size: 0.05
                        },
                        {
                            text: `LAT ${polar.lat.toFixed(2)}º`,
                            size: 0.05
                        },
                        {
                            text: `LON ${polar.lon.toFixed(2)}º`,
                            size: 0.05
                        },
                        {
                            text:`${found[1].point.x.toFixed(2)}x ${found[1].point.y.toFixed(2)}y ${found[1].point.z.toFixed(2)}z`,
                            size:0.025
                        }
                    ];
                    labels.groups.user_pos_sphere.update();

                    SPH.lon_lat_to_sector(polar.lon, polar.lat);
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

    function lon_lat_to_sector(lon, lat){
        const lo = Math.round(lon/(R.sector_scale*2))*R.sector_scale*2;
        const la = Math.round(lat/(R.sector_scale*2))*R.sector_scale*2;
        const point = {x:lon, y:lat};

        const g_c = geo_layers['countries'];

        let x = (lo + 180)/R.sector_scale;
        if(x >= g_c.data_cross.length) x = 0;
        let y = (la + 90)/R.sector_scale;
        if(y >= g_c.data_cross[0].length) y = 0;


        function get_valid(layer){
            const result = [];
            layer.data_cross[x][y].map(e =>{
                if(util.point_in_poly(point, layer.all_shapes[e].coords_flat[0], layer.all_shapes[e].coords_flat[1])){
                    const ref = e.split('-')[0];
                    if(!result.includes(ref)) result.push(ref);
                }
            })
            return result.length ? result : 'Undefined';
        }


        const validate = {
            'countries': get_valid(g_c),
            'marine': null,
            'final': 'Undefined'
        }

        if(validate.countries !== 'Undefined'){
            const term = g_c.all_features[validate.countries[0]].name;
            validate.final = `${term}`;
        }else{
            const g_M = geo_layers['marine'];
            validate.marine = get_valid(g_M);
            if(validate.marine !== 'Undefined') {
                const k_indx = validate.marine.length-1;
                const term = g_M.all_features[validate.marine[k_indx]].label;
                validate.final = `${term}`;
            }
        }

        //console.log(result.map(c => geo.all_features[c].name));
        // let name = result.length ? g_c.all_features[result[0]].name : 'Undefined';
        //
        // if(name === 'Undefined'){
        //     const g_M = geo_layers['marine'];
        //
        //     const result = [];
        //     g_M.data_cross[x][y].map(e =>{
        //         if(util.point_in_poly(point, g_M.all_shapes[e].coords_flat[0], g_M.all_shapes[e].coords_flat[1])){
        //             const ref = e.split('-')[0];
        //             if(!result.includes(ref)) result.push(ref);
        //         }
        //     })
        //
        //     name = result.length ? g_M.all_features[result[0]].name : 'Marine Undefined';
        //
        // }
        if(validate.final !== 'Undefined'){
            labels.groups.user_pos_sphere.format.text_array[0] = {
                text: `${validate.final}`,
                size: 0.075
            }

            labels.groups.user_pos_sphere.update();
        }



        lon_lat_to_polar(v.a, lo, la, R.radius);
        R.sector.up.copy(v.up);
        R.sector.lookAt(config.model.position);
        R.sector.position.copy(v.a);

    }

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


        //sector
        const a = util.deg_to_rad(R.sector_scale);
        v.a.set(0,0,5).applyAxisAngle(v.up, a);
        v.b.set(0,0,5).applyAxisAngle(v.right, a);
        v.c.set(0,0,5);
        const w = (v.a.distanceTo(v.c))*2.0;
        const h = (v.b.distanceTo(v.c))*2.0;

        const sector_geom = new THREE.PlaneGeometry(w,h);
        const sector_mat = new THREE.MeshStandardMaterial({
            color:0x00FF00,
            transparent:true,
            opacity:0.75,
            side: THREE.DoubleSide
        });
        R.sector = new THREE.Mesh(sector_geom, sector_mat);
        R.sector.position.setZ(-R.radius);
        R.sector.visible = false;

        R.object.add(R.sphere);
        R.object.add(R.marker);
        R.object.add(R.sector);

        R.marker.scale.setScalar(0.25);

        R.object.rotateY(Math.PI);
        return R
    }

    const R = {
        radius: 5.0,
        marker: elements.position_marker(),
        sector: null,
        sector_scale: 2.0,
        sphere: null,
        object: new THREE.Object3D(),
        name: null,
        lon_lat_to_sector,
        init
    }

    return R


}









const ERT = flat_earth().init('ERT');
config.model.add(ERT.object);

const SPH = globe_earth().init('SPH');
config.model.add(SPH.object);



const marine = {
    name: 'marine',
    color: 0x00FFFF,
    source: geo_marine,
    _s: SPH.sector_scale,
    add_to_model: false,
    model: SPH
}

const countries = {
    name: 'countries',
    color: 0xBBBBBB,
    source: geo_countries,
    _s: SPH.sector_scale,
    custom_fields: ['name', 'formal_en', 'region_wb', 'subregion','pop_est', 'pop_rank', 'ne_id'],
    add_to_model: true,
    model: SPH
}

// geo_layers.seams = geo_layer('seams', 0xFF0000, geo_seams, SPH.sector_scale).init().render(SPH);
geo_layers.marine = geo_layer().init(marine).render(SPH, false);
geo_layers.countries = geo_layer().init(countries).render(SPH, true);


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

























































































































