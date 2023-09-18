const { GMap } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement, Marker } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const default_stop_location = { "lat": 43.64657, "lng": -79.4067199 };
let current_position_marker;

let stop_colours = [];
let direction_colours = [];
let routes_to_refresh = '["301", "307", "501", "511"]';
let route_direction_to_refresh = '{"route_tag": "501","direction_tag": "501_0_501Bbus"}';

const location_markers = {};
const info_windows = {};
const stop_markers = {};
const id_time = {};
const direction_paths = [];

const stopData = new Map();

const singleStopInfoWindow = new google.maps.InfoWindow();
google.maps.event.addListener(singleStopInfoWindow,'closeclick',function(){
    closeStopInfoWindow();
});
let singleStopSelectedTag = null;

let fetchDataIntervalId;
let updateInfoWindowsIntervalId;
let isIntervalRunning = false; // Track if the interval is running

async function initMap() {
    gmap = new google.maps.Map(document.getElementById("map"), {
        center: default_stop_location,
        zoom: 14,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: true,
        mapId: "cf811fefe256b068"
    });
}

function parseLocations() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const vlss = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                const vls = JSON.parse(line);
                vlss.push(vls);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    updateStatus("Location Length: " + vlss.length);
    return vlss;
}

function parseStops() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const stops = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                let stop = JSON.parse(line);
                stops.push(stop);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    updateStatus("Stops Length: " + stops.length);
    return stops;
}

function parseStops2() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const stops = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(line,"text/xml");
                let lat = parseFloat(xmlDoc.getElementsByTagName("point")[0].getAttribute("lat"));
                let lng = parseFloat(xmlDoc.getElementsByTagName("point")[0].getAttribute("lon"));
                stops.push({lat:lat, lng:lng});
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    updateStatus("Stops Length: " + stops.length);
    return stops;
}

function parsePoints() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const points = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                let point = JSON.parse(line);
                points.push(point);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    updateStatus("Points Length: " + points.length);
    return points;
}



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
                title: vls.id
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
            zIndex: Marker.MAX_ZINDEX
        });
        stop_markers[stop.tag] = stop_marker;

        let contentString = `<div><span class="attribute-label">Stop tag:</span> <span class="attribute-value">${stop.tag}</span></div><div class="table">`;
        for (let route_direction of stop.route_directions) {
            contentString += `<div class="row"><div class="cell">${route_direction.route_tag}</div><div class="cell"><button id="infowindow_stop_${route_direction.direction_tag}">${route_direction.direction_tag}</button></div></div>`;
        }
        contentString += '</div>';
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
    singleStopInfoWindow.setContent(contentString);
    singleStopInfoWindow.setZindex = 0;
    google.maps.event.addListenerOnce(singleStopInfoWindow, 'domready', function () {
        for (let route_direction of route_directions) {
            const id = `infowindow_stop_${route_direction.direction_tag}`;
            const dir_button = document.getElementById(id);
            dir_button.addEventListener('click', () => {
                selectRouteDirection(route_direction);
            });
        }
    });
    singleStopInfoWindow.open({
        anchor: stop_marker,
        gmap,
    });

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

function closeStopInfoWindow() {
    // console.log("closing infowindow");
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

    /* this data structure is weired to accommodate the visualizer. A list of points, vs a tree */
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
    fetch('http://192.168.1.204:5000/routes/locations', {
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
    fetch('http://192.168.1.204:5000/route/direction/locations', {
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
    fetch('http://192.168.1.204:5000/stops/nearest', {
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
    fetch('http://192.168.1.204:5000/route/direction/stops', {
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
    fetch('http://192.168.1.204:5000/route/direction/path', {
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
    document.getElementById('resetViewButton').addEventListener("click", () => {
        gmap.setHeading(0);
        gmap.setTilt(0);
        gmap.setCenter(default_stop_location);
    });

    // Add a click event listener to the button
    document.getElementById('toggleLoadWidgets').addEventListener('click', () => {
        // Toggle the "hidden" class on the div
        document.getElementById('loadWidgets').classList.toggle('hidden');

        // Update the button text
        if (document.getElementById('loadWidgets').classList.contains('hidden')) {
            document.getElementById('toggleLoadWidgets').textContent = 'Show Load Widgets';
        } else {
            document.getElementById('toggleLoadWidgets').textContent = 'Hide Load Widgets';
        }
    });

    document.getElementById('loadLocationsButton').addEventListener("click", () => {
        let vlss = parseLocations();
        updateLocations(vlss);
    });

    document.getElementById('clearLocationsButton').addEventListener("click", () => {
        clearLocations();
    });

    document.getElementById('loadStopsButton').addEventListener("click", () => {
        let stops = parseStops();
        loadStops(stops);
    });

    document.getElementById('clearStopsButton').addEventListener("click", () => {
        clearStops();
    });

    document.getElementById('loadPointsButton').addEventListener("click", () => {
        let points = parsePoints();
        loadPoints(points);
    });

    document.getElementById('clearPointsButton').addEventListener("click", () => {
        clearPoints();
    });

    document.getElementById('currentLocationButton').addEventListener("click", () => {
        getLocation();
    });

    document.getElementById('loadNearestStopsButton').addEventListener("click", () => {
        loadNearestStops();
    });

    document.getElementById('loadRouteDirectionStopsButton').addEventListener("click", () => {
        loadRouteDirectionStops();
    });

    document.getElementById('loadRouteDirectionPathButton').addEventListener("click", () => {
        loadRouteDirectionPath();
    });
}

function initUpdating() {
    const toggleRoutesRefreshButton = document.getElementById('toggleRoutesRefreshButton');
    toggleRoutesRefreshButton.addEventListener('click', () => {
        toggleRoutesRefresh();
    });
    const toggleRouteDirectionRefreshButton = document.getElementById('toggleRouteDirectionRefreshButton');
    toggleRouteDirectionRefreshButton.addEventListener('click', () => {
        toggleRouteDirectionRefresh();
    }); 
    document.getElementById('routes_to_refresh').value = routes_to_refresh;
    document.getElementById('route_direction_to_refresh').value = route_direction_to_refresh;
}

function toggleRoutesRefresh() {
    const toggleRoutesRefreshButton = document.getElementById('toggleRoutesRefreshButton');
    if (!isIntervalRunning) {
        // Start the interval and update button text
        routes_to_refresh = document.getElementById('routes_to_refresh').value
        fetchData()
        fetchDataIntervalId = setInterval(fetchData, 10000);
        updateInfoWindowsIntervalId = setInterval(updateInfoWindows, 1000)
        toggleRoutesRefreshButton.textContent = 'Stop Refreshing';
        updateStatus("Starting refreshing");
    } else {
        stopUpdating();
        toggleRoutesRefreshButton.textContent = 'Start Refreshing';
        updateStatus("Stopped refreshing");
    }

    // Toggle the interval running state
    isIntervalRunning = !isIntervalRunning;
}

function stopUpdating() {
    clearInterval(fetchDataIntervalId);
    clearInterval(updateInfoWindowsIntervalId);
}

function toggleRouteDirectionRefresh() {
    const toggleRouteDirectionRefreshButton = document.getElementById('toggleRouteDirectionRefreshButton');
    if (!isIntervalRunning) {
        // Start the interval and update button text
        route_direction_to_refresh = document.getElementById('route_direction_to_refresh').value
        fetchRouteDirectionData()
        fetchDataIntervalId = setInterval(fetchRouteDirectionData, 10000);
        updateInfoWindowsIntervalId = setInterval(updateInfoWindows, 1000)
        toggleRouteDirectionRefreshButton.textContent = 'Stop Refreshing';
        updateStatus("Starting refreshing");
    } else {
        clearInterval(fetchDataIntervalId);
        clearInterval(updateInfoWindowsIntervalId);
        toggleRouteDirectionRefreshButton.textContent = 'Start Refreshing';
        updateStatus("Stopped refreshing");
    }

    // Toggle the interval running state
    isIntervalRunning = !isIntervalRunning;
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        updateStatus("Geolocation is not working in this browser.");
    }
}

function showPosition(position) {
    
    if (current_position_marker != undefined) {
        current_position_marker.setMap(null);
    } 
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    updateStatus("Latitude: " + latitude + " Longitude: " + longitude);
    document.getElementById('nearestStopPosition').value = latitude + "," + longitude;
    let coords = {lat:latitude, lng:longitude};

    current_position_marker = new google.maps.Marker({
        position: coords,
        map: gmap,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillOpacity: 1,
          strokeWeight: 2,
          fillColor: '#5384ED',
          strokeColor: '#ffffff',
        },
      });
  }

  function loadNearestStops() {
    const parts =  document.getElementById('nearestStopPosition').value.split(',');
    const latitude = parts[0];
    const longitude = parts[1];
    const js_coord =     {
        "coords": {
            "latitude": Number(latitude) ,
            "longitude": Number(longitude) 
        }
    };
    showPosition(js_coord);
    gmap.setCenter(current_position_marker.position)
    clearStops();
    fetchNearestStops({ "lat": latitude, "lng": longitude });
    
  }

  function loadRouteDirectionStops() {
    const routeDirection =  JSON.parse(document.getElementById('routeDirectionStops').value);
    clearStops();
    // console.log(routeDirection)
    fetchRouteDirectionStops(routeDirection);
  }

  function loadRouteDirectionPath() {
    const routeDirection =  JSON.parse(document.getElementById('routeDirectionPath').value);
    clearPoints()
    // console.log(routeDirection)
    fetchRouteDirectionPath(routeDirection);
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
initUpdating();



