const { Map } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const default_stop_location = { "lat": 43.64657, "lng": -79.4067199 };
let current_position_marker;


let stop_colours = []
let direction_colours = [];
let routes_to_refresh = '["301", "307", "501", "511"]'

const location_markers = {};
const info_windows = {};
const stop_markers = {};
const id_time = {};

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
    let i = 0;
    for (let stop of stops) {
        let background = getStopBackground(i)
        const pin = new PinElement({
            background: background,
            borderColor: "#FFFFFF",
            glyphColor: "#FFFFFF",
            scale: 0.75
        });
        let stop_marker = new AdvancedMarkerElement({
            map: gmap,
            position: stop,
            content: pin.element,
            title: `${stop.tag} - ${stop.title}`,
        });
        stop_markers[stop.tag] = stop_marker;
        i = i + 1;
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
            loadStops(stopsNearest)
        })
        .catch(error => {
            updateStatus('Error fetching stop:' + error);
            console.error('Error fetching stops:', error);
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

    document.getElementById('currentLocationButton').addEventListener("click", () => {
        getLocation();
    });

    document.getElementById('loadNearestStopsButton').addEventListener("click", () => {
        loadNearestStops();
    });
}

function initUpdating() {
    const toggleRefreshButton = document.getElementById('toggleRefreshButton');
    toggleRefreshButton.addEventListener('click', () => {
        toggleRefresh();
    });
    document.getElementById('routes_to_refresh').value = routes_to_refresh;
}

function toggleRefresh() {
    const toggleRefreshButton = document.getElementById('toggleRefreshButton');
    if (!isIntervalRunning) {
        // Start the interval and update button text
        document.getElementById('toggleLoadWidgets').textContent
        routes_to_refresh = document.getElementById('routes_to_refresh').value
        fetchData()
        fetchDataIntervalId = setInterval(fetchData, 10000);
        updateInfoWindowsIntervalId = setInterval(updateInfoWindows, 1000)
        toggleRefreshButton.textContent = 'Stop Refreshing';
        updateStatus("Starting refreshing");
    } else {
        clearInterval(fetchDataIntervalId);
        clearInterval(updateInfoWindowsIntervalId);
        toggleRefreshButton.textContent = 'Start Refreshing';
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



