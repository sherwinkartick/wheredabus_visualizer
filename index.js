const { GMap } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement, Marker } = await google.maps.importLibrary("marker");

let gmap;

const default_stop_location = { "lat": 43.647191, "lng": -79.403999 }; // Queen and Bathurst
let current_coords;
let current_position_marker;

let stop_colours = [];
let direction_colours = [];
// let routes_to_refresh = '["301", "307", "501", "511"]';
let route_direction_to_refresh = '';

const location_markers = {};
const info_windows = {};
const stop_markers = {};
const id_time = {};
const direction_paths = [];

const stopData = new Map();

let singleStopSelectedTag = null;

let fetchDataIntervalId;
let updateInfoWindowsIntervalId;
let isIntervalRunning = false; // Track if the interval is running

let click_timeout = null;

const protocol = location.protocol;
let host = location.hostname;
if (location.hostname != "queenwest.webhop.me") {
    host = location.hostname + ":5000";
} 
const base_url = protocol + '//' + host

async function initMap() {
    gmap = new google.maps.Map(document.getElementById("map"), {
        center: default_stop_location,
        zoom: 16,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: true,
        mapId: "cf811fefe256b068",
        clickableIcons: false
    });

    google.maps.event.addListener(gmap, 'click', (mapsMouseEvent) => {
        click_timeout = setTimeout(function(){
            const latitude = mapsMouseEvent.latLng.lat();
            const longitude = mapsMouseEvent.latLng.lng();
            const coords =  {
                lat: latitude,
                lng: longitude 
            };
            clearStops();
            showPosition(coords);
            //gmap.setCenter(current_position_marker.position)
            fetchNearestStops({ "lat": latitude, "lng": longitude });
        }, 400);   
    });
    // google.maps.event.addListener(gmap, 'dblclick', function(event) {       
    //     clearTimeout(click_timeout);
    // });
}

// function handleIdle() {
//     positionSingleStopInfoWindow();
// }

function isInfoWindowOpen(infoWindow) {
    let map = infoWindow.map;
    return (map !== null && typeof map !== "undefined");
}

function getBackground(route) {
    // const color1 = ["#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];
    const color2 = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"];
    // const color3 = ["#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78"];
    const color4 = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"];

    const combinedColors = [];

    while (combinedColors.length < direction_colours.length) {
        combinedColors.push(...color4, ...color2);
    }

    // const colours = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7", 
    // "#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];
    return combinedColors[direction_colours.indexOf(route)]
}

function getStopBackground(index) {
    const color1 = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"];
    const color2 = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"];
    const combinedColors = [];
    combinedColors.push(...color1, ...color2);
    return combinedColors[index % combinedColors.length]
}

function updateLocations(vlss) {
    const ts = new Date();
    updateStatus("Updating at " + ts.toLocaleString())

    const items = []
    for (let vls of vlss) {
        items.push(`${vls.routeTag} ${vls.dirName}`)
    }
    direction_colours = [...new Set(items)]
    direction_colours.sort()

    updateStatus('VLS: ' + vlss.length + ' Direction colours:' + direction_colours.length)

    outer: for (let key in location_markers) {
        for (let vls of vlss) {
            if (key == vls.id) {
                continue outer;
            }
        }
        location_markers[key].position = null;
        delete location_markers[key];
        delete info_windows[key];
        delete id_time[key];
    }

    for (let vls of vlss) {
        // fast skip things that didn't change
        if (vls.id in id_time) {
            if (vls.time == id_time[vls.id]) {
                continue;
            }
        }
        id_time[vls.id] = vls.time;
        const glyphImg = document.createElement("img");
        glyphImg.src = "arrow-up.svg";
        let getHeading = gmap.getHeading();
        if (getHeading == undefined) {
            getHeading = 0;
        }
        let newHeading = vls.heading-getHeading;
        glyphImg.style.transform = `rotate(${newHeading}deg)`;
        let background = getBackground(`${vls.routeTag} ${vls.dirName}`)
        if (singleStopSelectedTag != null) {
            background =  getStopBackground(stopData.get(singleStopSelectedTag).background_index);
        }
        const glyphSvgPinElement = new PinElement({
            glyph: glyphImg,
            background: background,
            borderColor: '#FFFFFF',
            scale: 1.0
        });
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const timeDelta = currentTimeInSeconds - vls.time;
        const contentString = `
                <div>
                    <div><span class="attribute-label">Update Time:</span> <span class="attribute-value">${ts.toLocaleString()}</span></div>
                    <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
                    <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
                    <div><span class="attribute-label">Direction Tag:</span> <span class="attribute-value">${vls.dirTag}</span></div>
                    <div><span class="attribute-label">Direction Name:</span> <span class="attribute-value">${vls.dirName}</span></div>
                    <div><span class="attribute-label">Heading:</span> <span class="attribute-value">${vls.heading}</span></div>
                    <div><span class="attribute-label">Speed:</span> <span class="attribute-value">${vls.speed}</span></div>
                    <div><span class="attribute-label">Report Age:</span> <span class="attribute-value" id=infowindow_time_${vls.id}>${timeDelta}</span></div>
                </div>`;
        if (!(vls.id in location_markers)) {
            const marker = new AdvancedMarkerElement({
                map: gmap,
                position: vls,
                content: glyphSvgPinElement.element,
                title: vls.id,
                gmpClickable: true
            });
            const infowindow = new google.maps.InfoWindow({
                content: contentString,
            });
            marker.addEventListener("gmp-click", () => {
                infowindow.open({
                    anchor: marker,
                    gmap,
                });
            });
            location_markers[vls.id] = marker;
            info_windows[vls.id] = infowindow;
        } else {
            const marker = location_markers[vls.id];
            marker.position = vls;
            marker.content = glyphSvgPinElement.element;
            const infowindow = info_windows[vls.id];
            infowindow.setContent(contentString);
        }
    }
}


function loadStops(stops) {
    const directionFamilyIndexMap = new Map();
    for (let stop of stops) {
        const key = getDirectionKey(stop);
        if (!directionFamilyIndexMap.has(key)) {
            directionFamilyIndexMap.set(key, directionFamilyIndexMap.size);
        }
        // console.log(key + " " + directionFamilyIndexMap.get(key))
        const background_index = directionFamilyIndexMap.get(key)
        let background = getStopBackground(background_index)
        const pin = new PinElement({
            background: background,
            borderColor: "#000000",
            glyph: "",
            scale: 0.6
        });
        let stop_marker = new AdvancedMarkerElement({
            map: gmap,
            position: stop,
            content: pin.element,
            zIndex: Marker.MAX_ZINDEX,
            gmpClickable: true
        });
        stop_markers[stop.tag] = stop_marker;

        let contentString = `<div><div class="route-title-row"><span class="route-attribute-label">Stop tag:</span> <span class="route-attribute-value">${stop.tag}</span></div><div class="route-table">`;
        for (let route_direction of stop.route_directions) {
            contentString += `<div class="route-row"><div class="route-cell">${route_direction.route_tag}</div><div class="route-cell"><button id="infowindow_stop_${route_direction.direction_tag}" class="route-button">${route_direction.direction_tag}</button></div></div>`;
        }
        contentString += '</div></div>';
        // console.log(contentString)
        stop_marker.addEventListener("gmp-click", () => {
            selectStop(stop_marker, contentString, stop);
        });
        stop.background_index = background_index;
        stopData.set(stop.tag, stop);
    }
    updateStopFitBounds();
}

function selectStop(stop_marker, contentString, stop) {
    clearPoints();
    openStopInfoWindow(stop_marker, contentString, stop.route_directions);
}

function updateStopFitBounds() {
    const bounds = new google.maps.LatLngBounds();
    for (const key in stop_markers) {
        const stop_marker = stop_markers[key];
        bounds.extend(stop_marker.position);
    }
    gmap.fitBounds(bounds);
}

function getDirectionKey(stop) {
    const directionTags = stop.route_directions.map(direction => direction.direction_tag);
    directionTags.sort();
    const key = directionTags.join(',');
    return key;
}

function openStopInfoWindow(stop_marker, contentString, route_directions) {
    singleStopSelectedTag = Object.keys(stop_markers).find(key => stop_markers[key] === stop_marker);
    const selectedStopObj = stopData.get(singleStopSelectedTag);

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = contentString;
    const singleStopDiv = document.createElement('div');
    singleStopDiv.setAttribute('id', 'singleStopDiv');
    singleStopDiv.classList.add('singleStopDiv');
    singleStopDiv.innerHTML = '<div class="close-button-div"><button id="closeSingleStopDivButton" class="close-button">&#x2716;</button></div>';
    singleStopDiv.appendChild(contentDiv);

    // singleStopInfoWindow.setContent(contentString);
    // singleStopInfoWindow.setZindex = 0;
    // google.maps.event.clearListeners(singleStopInfoWindow, 'domready');
    // google.maps.event.addListener(singleStopInfoWindow, 'domready', function () {
    // for (let route_direction of route_directions) {
    //     const id = `infowindow_stop_${route_direction.direction_tag}`;
    //     const dir_button = document.getElementById(id);
    //     if (dir_button == null) {
    //         console.log("dir_button is null: " + id);
    //     } else {
    //         dir_button.addEventListener('click', () => {
    //             selectRouteDirection(route_direction);
    //         });
    //     }
    // }
    // });
    // positionSingleStopInfoWindow();
    // singleStopInfoWindow.open({
    //     // anchor: stop_marker,
    //     map: gmap,
    // });

    const controls_array = gmap.controls[google.maps.ControlPosition.TOP_LEFT]
    if (controls_array.getLength() > 0) {
        document.getElementById('closeSingleStopDivButton').removeEventListener("click", () => {
            closeSingleStopDiv();
        });
        controls_array.clear();
    }
    gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(singleStopDiv);
    document.getElementById('closeSingleStopDivButton').addEventListener("click", () => {
        closeSingleStopDiv();
    });

    for (let route_direction of route_directions) {
        const id = `infowindow_stop_${route_direction.direction_tag}`;
        const dir_button = document.getElementById(id);
        if (dir_button == null) {
            console.log("dir_button is null: " + id);
        } else {
            dir_button.addEventListener('click', () => {
                selectRouteDirection(route_direction);
            });
        }
    }

    const pin = new PinElement({
        background: getStopBackground(selectedStopObj.background_index),
        borderColor: "#000000",
        glyph: "",
        scale: 1.0
    });
    stop_marker.content = pin.element;
    const selectedStopDirections = selectedStopObj.route_directions.map(direction => direction.direction_tag);
    for (const key in stop_markers) {
        if (key == singleStopSelectedTag) continue;
        const loopStop = stopData.get(key)
        const loopStopDirections = loopStop.route_directions.map(direction => direction.direction_tag);
        const commonDirectionTags = selectedStopDirections.filter(tag => loopStopDirections.includes(tag));
        if (commonDirectionTags.length == 0) {
            const stop_marker = stop_markers[key];
            stop_marker.position = null;
        } else {
            const newpin = new PinElement({
                background: getStopBackground(loopStop.background_index),
                borderColor: "#000000",
                glyph: "",
                scale: 0.6
            });
            const newstop_marker = stop_markers[key];
            newstop_marker.content = newpin.element;
        }
    }
}


function selectRouteDirection(route_direction) {
    stopUpdating();
    fetchRouteDirectionPath(route_direction);
    route_direction_to_refresh = JSON.stringify(route_direction);
    fetchRouteDirectionData();
    fetchDataIntervalId = setInterval(fetchRouteDirectionData, 10000);
    updateInfoWindowsIntervalId = setInterval(updateInfoWindows, 1000);
}

function closeSingleStopDiv() {
    console.log("closing single stop div");
    const controls_array = gmap.controls[google.maps.ControlPosition.TOP_LEFT]
    controls_array.clear();

    stopUpdating();
    clearLocations();
    singleStopSelectedTag = null;
    clearPoints();
    for (const key in stop_markers) {
        const stop_marker = stop_markers[key];
        const loopStop = stopData.get(key)
        const newpin = new PinElement({
            background: getStopBackground(loopStop.background_index),
            borderColor: "#000000",
            glyph: "",
            scale: 0.6
        });
        stop_marker.content = newpin.element;
        stop_marker.position = loopStop;
    }
}


function loadPoints(points) {

    const paths = new Map();

    /* this data structure is weird to accommodate the visualizer. A list of points, vs a tree */
    for (let point of points) {
        const index = point.index;
        // console.log("Point: " + point.index + " " + index);
        if (!paths.has(index)) {
            paths.set(index, []);
        }
        paths.get(index).push(point);
    }

    let i = 0;
    // console.log("Paths: " + paths.size);
    let colour =  getStopBackground(Math.floor(Math.random() * 9));
    for (let path of paths.values()){
        // console.log("Path:" + i);
        if (singleStopSelectedTag != null) {
            colour =  getStopBackground(stopData.get(singleStopSelectedTag).background_index);
        }
        let direction_path = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: colour,
            strokeOpacity: 1.0,
            strokeWeight: 4,
        });
        direction_path.setMap(gmap);
        direction_paths.push(direction_path);
        i = i+1;
    }


}


function clearLocations() {
    for (const key in location_markers) {
        const location_marker = location_markers[key];
        location_marker.position = null;
        delete location_markers[key];
        delete info_windows[key]
    }
}

function clearStops() {
    for (const key in stop_markers) {
        const stop_marker = stop_markers[key];
        stop_marker.position = null;
        delete stop_markers[key];
    }
}

function clearPoints() {
    for (let path of direction_paths) {
        path.setMap(null);
    }
}

function fetchData() {

    const url = `${base_url}/routes/locations`
    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: routes_to_refresh,
    })
        .then(response => response.json())
        .then(vlss => {
            updateLocations(vlss)
        })
        .catch(error => {
            updateStatus('Error fetching data:' + error);
            console.error('Error fetching data:', error);
            toggleRefresh()
        });
}

function fetchRouteDirectionData() {
    console.log("Fetching " + route_direction_to_refresh);
    const url = `${base_url}/route/direction/locations`;
    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: route_direction_to_refresh,
    })
        .then(response => response.json())
        .then(vlss => {
            updateLocations(vlss)
        })
        .catch(error => {
            updateStatus('Error fetching data:' + error);
            console.error('Error fetching data:', error);
            stopUpdating();
            // toggleRefresh();
        });
}

function fetchNearestStops(coords) {
    const url = `${base_url}/stops/nearest`;
    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(coords),
    })
        .then(response => response.json())
        .then(stopsNearest => {
            clearStops()
            // console.log(stopsNearest)
            loadStops(stopsNearest)
        })
        .catch(error => {
            updateStatus('Error fetching stop:' + error);
            console.error('Error fetching stops:', error);
        });
}


function fetchRouteDirectionStops(routeDirection) {
    const url = `${base_url}/route/direction/stops`;
    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(routeDirection),
    })
        .then(response => response.json())
        .then(stopsRouteDirection => {
            clearStops()
            // console.log(stopsRouteDirection)
            loadStops(stopsRouteDirection)
        })
        .catch(error => {
            updateStatus('Error fetching direction stop:' + error);
            console.error('Error fetching direction stops:', error);
        });
}


export function fetchRouteDirectionPath(routeDirection) {
    // console.log("fetch fired: " + routeDirection.direction_tag);
    const url = `${base_url}/route/direction/path`;
    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(routeDirection),
    })
        .then(response => response.json())
        .then(pathRouteDirection => {
            // console.log(pathRouteDirection)
            clearPoints();
            loadPoints(pathRouteDirection);
        })
        .catch(error => {
            updateStatus('Error fetching path:' + error);
            console.error('Error fetching path:', error);
        });
}

function updateInfoWindows() {
    for (let key in info_windows) {
        const info_window = info_windows[key]
        const span = document.getElementById(`infowindow_time_${key}`);
        if (span != null) {
            span.textContent = parseInt(span.textContent) + 1;
        }
    }
}

function initControls() {
    let position = default_stop_location
    document.getElementById('resetViewButton').addEventListener("click", () => {
        console.log("Current coords: " + current_coords);
        if (current_coords != undefined) {
            position = current_coords;
        }
        gmap.setHeading(0);
        gmap.setTilt(0);
        gmap.setCenter(position);
        gmap.setZoom(16);
    });
    document.getElementById('currentLocationButton').addEventListener("click", () => {
        getLocation();
    });
}

function stopUpdating() {
    clearInterval(fetchDataIntervalId);
    clearInterval(updateInfoWindowsIntervalId);
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(getCurrentPositionHandler);
    } else {
        updateStatus("Geolocation is not working in this browser.");
    }
}

function getCurrentPositionHandler(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const coords = {"lat":latitude, "lng":longitude};
    console.log("Latitude: " + coords.lat + " Longitude: " + coords.lng);
    showPositionAndStops(coords);
}

function showPositionAndStops(coords) {
    showPosition(coords);
    //gmap.setCenter(current_position_marker.position);
    fetchNearestStops(coords);
}

function showPosition(coords) {
    if (current_position_marker != undefined) {
        current_position_marker.setMap(null);
    }
    current_coords = coords; 
    updateStatus("Latitude: " + coords.lat + " Longitude: " + coords.lng);

    const glyphImg = document.createElement("img");
    glyphImg.src = "bluedot.svg";
    current_position_marker = new AdvancedMarkerElement({
        position: coords,
        map: gmap,
        content: glyphImg
    });
}

function updateStatus(status) {
    const statusElement = document.getElementById("status");
    const currentStatus = statusElement.textContent;
    const now = new Date();
    const formattedDate = now.toLocaleString();
    const newStatusEntry = `[${formattedDate}] ${status}`;
    const lines = currentStatus.split('\n');
    lines.unshift(newStatusEntry);
    if (lines.length > 5) {
        lines.length = 5;
    }
    const newStatus = lines.join('\n');
    statusElement.textContent = newStatus;
}

initMap();
initControls();
